import { createClient } from 'redis'
import { v4 as uuidv4 } from 'uuid'
import HTTP from 'http'
import md5 from 'md5-node'

const key = '36c75e3f460371bc86b193a7d94877b6'
//各个医院队对应的消费api地址,php发起的请求中需要加上医院key
const CONSUM_API = {
  dev:'/lis_server/apiLis.php',//开发环境
  xj:'/lis_xj/apiLis.php',//薛家
  sj:'',//三井
}

// 存在多个医院多个地址的情况
const POST_OPTIONS = {
  host: '127.0.0.1',
  port: 80,
  path: '/lis_server/apiLis.php',//改为动态获得
  method: 'POST',
  headers: '',
}

// 阻塞等待超时时间,默认600
const blockTimeout = 20
// 消息队列key
const msgKey = 'msgKey'
// 备份队列key
const msgKeyBak = 'msgKeyBak'

// 模拟消费,2s消费一次
const doConsum = (client, task) => {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      //模拟消费失败,期望:备份队列的消息保留,
      // return reject('消费失败'+task);

      // 消费成功,真实的消费是向php发送api请求.
      console.log('消费成功:', task)
      await client.lRem(msgKeyBak, 1, task)
      console.log(
        '从备份队列中删除消息,删除后备份队列:',
        await client.lRange(msgKeyBak, 0, -1)
      )
      return resolve('ok')
    }, 2000)
  })
}

//真实消费,请求php接口进行消费,
const doConsum1 = (client, task) => {
  const tmp = Date.parse(new Date()).toString().substring(0, 10)
  const POST_DATA = {
    method: 'lis.async.updateTask',
    timestamp: tmp,
    version: 'lis',
  }

  POST_DATA['params'] = task
  POST_DATA['token'] = createToken(POST_DATA)
  const bodyString = JSON.stringify(POST_DATA)
  console.log(bodyString)
  POST_OPTIONS['headers'] = {
    'Content-Type': 'application/json',
    'Content-Length': bodyString.length,
  }
  return new Promise((resolve, reject) => {
    // 创建 http 连接
    // const REQUEST = HTTP.request(POST_OPTIONS, requestOnResponse)
    const REQUEST = HTTP.request(POST_OPTIONS, function (serverFeedback) {
      if (serverFeedback.statusCode == 200) {
        var body = ''
        serverFeedback
          .on('data', function (data) {
            body += data
          })
          .on('end', async () => {
            console.log('http body', body)
            var resultObject = JSON.parse(body)
            if (resultObject.rsp == 'succ') {
              await client.lRem(msgKeyBak, 1, task)
              console.log(
                '从备份队列中删除消息,删除后备份队列:',
                await client.lRange(msgKeyBak, 0, -1)
              )
              return resolve('ok')
            }
          })
      } else {
        console.log('end data 500 ')
      }
    })
    // 添加事件监听
    REQUEST.on('error', requestOnError)
    // REQUEST.on('timeout', requestOnTimeout)
    // 设置超时
    REQUEST.setTimeout(6000)
    console.log('http write')
    // 通过连接发送数据
    REQUEST.write(bodyString, 'utf8')
    REQUEST.end()
  })
}

// 模拟重复消费:上次消费失败后,重启消费服务时需要重试,
const retryConsum = async (client) => {
  const listTask = await client.lRange(msgKeyBak, 0, -1)
  if (listTask.length > 0) {
    console.log('重试上次失败的消费任务', listTask)
    for (const task of listTask) {
      const result = await doConsum(client, task).catch((e) => {
        console.log('重试消费失败', e)
      })
      if (result !== 'ok') {
        return false
      }
    }
  }
  return true
}

// 启动消费服务
const startConsum = async (client) => {
  const key = msgKey
  const key1 = msgKeyBak

  // 重试上次失败的消费
  const retryResult = await retryConsum(client)
  if (!retryResult) {
    // console.log('中断等待/或者扔到失败队列中,继续消费');
    console.log('重试消费终止')
    client.quit()
    return
  }

  //阻塞等待时间,超时后重新等待,不要设置为0,可能导致socket连接失效的问题,一般可以设置600s超时
  console.log(
    `开始阻塞等待任务,${blockTimeout}s后重连,${msgKey} 队列长度:`,
    await client.lLen(key),
    `,${msgKeyBak} 队列长度:`,
    await client.lLen(msgKeyBak)
  )

  // 注意设置timeout,不能无限等待,可能导致socket连接失效的问题
  const res = await client.brPopLPush(key, key1, blockTimeout)
  if (res === null) {
    //重新阻塞等待
    console.log('消费等待超时重新启动消费')
    await startConsum(client)
    return
  }
  console.log(
    '发现待消费任务:',
    res,
    '原队列拉取后长度:',
    await client.lLen(key),
    '备份队列插入后:',
    await client.lRange(key1, 0, -1)
  )
  const _res = await doConsum(client, res).catch((e) => {
    console.log('error fired', e)
    return
  })
  if (_res !== 'ok') {
    console.log('中断等待/或者扔到失败队列中,继续消费')
    client.quit()
    return
  }
  //重新阻塞等待
  await startConsum(client)
}

// 生产消息 
// saveLisData接口中调用,用来处理php的请求
const produceMsg = async (client, data) => {
  //为每个元素生成uid
  const _data = data.map((item) => {
    item.uid = uuidv4()
    return JSON.stringify(item)
  })
  const res = await client.lPush(msgKey, _data)
  console.log(res, '生产消息成功')
  // client.quit();
  return res
}

let _client = null

const createAClient = async () => {
  const client = createClient({
    // 4.0以后的新格式: https://github.com/redis/node-redis/blob/HEAD/docs/client-configuration.md#reconnect-strategy
    socket: {
      port: 6379,
      // 下面貌似没什么鸟用
      connectTimeout: 3000,
      // 以下只会在redis down掉时触发,正常timeout导致的重连不会触发
      reconnectStrategy: function (options) {
        console.log('reconnectStrategy fired', options)
        //分别为重试次数,错误,
        const { attempt, total_retry_time, error, times_connected } = options
        if (error && error.code === 'ECONNREFUSED') {
          return new Error('The server refused the connection')
        }
        return undefined
      },
    },
  })
    .on('connect', () => {
      console.log('redis connected')
    })
    .on('ready', () => {
      // console.log("redis ready");
    })
    .on('reconnecting', () => {
      // timeout后会触发重连,这里需要断开连接,释放内尺寸
      console.log('redis reconnecting')
      // 如果quit和end同时发生可能产生错误,这里使用了延迟,避免同时触发,但最好能判断待处理命令是否为空,如果空再进行退出比较安全,to do 判断idle事件
      // setTimeout(() => {
      //   client.quit();
      // }, 2000);
    })
    .on('end', () => {
      //当已和Redis服务器建立的连接被关闭时，client将触发end事件。
      console.log('*************redis end*******************')
    })
    .on('error', async (err) => {
      console.log('Redis Error', err)
    })
    .on('idle', async (err) => {
      console.log('Redis idle', err)
    })
  await client.connect()
  return client
}

// 接受返回的数据
function requestOnResponse(incomingMessage) {
  let data = []
  incomingMessage.on('data', (chunk) => {
    data.push(...chunk)
  })

  incomingMessage.on('end', () => {
    let _date = JSON.parse(new TextDecoder().decode(new Uint8Array(data)))
    console.log('end data: ', data)
  })
}

// 超时 事件处理器
function requestOnTimeout() {
  REQUEST.destroy()
}

// 错误  事件处理器
function requestOnError(err) {
  console.log('err: ', err)
}

function createToken(param) {
  let stringSignTemp =
    'timestamp=' + param['tmp'] + '&method=' + param['method'] + '&key=' + key

  let token = md5(stringSignTemp).toString()
  return token
}

export default async function (newClient = false) {
  let client
  if (newClient === true) {
    // 需要新建连接
    client = await createAClient()
  } else {
    // 使用已建立的client
    if (_client === null) {
      client = await createAClient()
      _client = client
    } else {
      client = _client
    }
    // _client = client;
  }
  // 创建一个新得redis连接
  //配置参数的说明参考: https://tuzhu008.github.io/gitbook-Node_cn/Library/node_redis/

  return { client, startConsum, produceMsg }
}

/*
待实现接口:

LREM key count value  移除列表元素

LSET key index value
通过索引设置列表元素的值

LTRIM key start stop
对一个列表进行修剪(trim)，就是说，让列表只保留指定区间内的元素，不在指定区间之内的元素都将被删除。

BRPOPLPUSH source destination timeout
从列表中弹出一个值，将弹出的元素插入到另外一个列表中并返回它； 如果列表没有元素会阻塞列表直到等待超时或发现可弹出元素为止。

RPOPLPUSH source destination
移除列表的最后一个元素，并将该元素添加到另一个列表并返回
*/
