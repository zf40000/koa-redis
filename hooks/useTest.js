import { createClient, commandOptions } from 'redis';
// import {RedisClientType} from "redis";

// 简单读写
const test = async (client) => {

  const arr = [];

  // string set
  await client.set('key', 'demo-value');
  arr.push("set string kv: await client.set(key, value')");

  //string get
  const value = await client.get('key');
  arr.push("get string value: await client.get(key); the value of 'key' is:" + value);

  // hash set
  await client.hSet('hashKey', 'field1', 'value1');
  await client.hSet('hashKey', 'field2', 'value2');
  arr.push("set hash kv: await client.hSet('hashKey', 'field1', 'value1')");

  const hashValue = await client.hGetAll('hashKey');
  arr.push("get hash value: await client.hGetAll('hashKey'),the value:" + JSON.stringify(hashValue));

  const hashValues = await client.hVals('hashKey');
  arr.push("get hash values: await client.hVals('hashKey'),the value:" + JSON.stringify(hashValues));


  // 分别从左边和右边push
  await client.lPush('listKey', ['left1', 'left2']);
  await client.rPush('listKey', ['right1', 'right2']);
  arr.push("list : await client.lPush('listKey', ['left1', 'left2'])");

  //获取列表长度
  const listLen = await client.lLen('listKey');
  arr.push("list length:" + listLen);

  // 获取所有元素
  const listValue = await client.lRange('listKey', 0, listLen - 1);
  arr.push('list清单: ', JSON.stringify(listValue));

  //获取指定位置的元素
  arr.push("获取指定位置(2)的值:" + await client.lIndex('listKey', 2));

  // 移出并获取列表的第一个元素， 如果列表没有元素会阻塞列表直到等待超时或发现可弹出元素为止。
  // BLPOP key1[key2] timeout
  let popValue = await client.lPop('listKey');
  arr.push("移出并获取列表的第一个元素:" + JSON.stringify(popValue));

  // 移出并获取列表的最后一个元素， 如果列表没有元素会阻塞列表直到等待超时或发现可弹出元素为止。
  // BLPOP key1[key2] timeout
  popValue = await client.rPop('listKey');
  arr.push("移出并获取列表的最后一个元素，:" + JSON.stringify(popValue));

  arr.push('list清单: ', await client.lRange('listKey', 0, listLen - 1));


  // 删除某个健
  await client.del('listKey');

  // sendCommand
  const commandValues = await client.sendCommand(['HGETALL', 'hashKey']);
  arr.push("sendCommand result: await client.sendCommand(['HGETALL', 'hashKey']) ,the value:" + JSON.stringify(commandValues));


  return arr;
}

// 测试阻塞拉取
const testBlock = async (client) => {
  const key = 'keyBlock';
  // const arr = [];

  //BRPOP key1 [key2 ] timeout
  console.log('开始阻塞拉取brpop,会新开一个连接等待,有了结果后,连接会自动关闭');
  //第2个参数表示timeout,超过后会断开连接
  client.brPop(commandOptions({ isolated: true }), key, 10).then(async (res) => {
    console.log('发现队列中出现消息,开始拉取,', res);
    const r = await client.lRange(key, 0, 10);
    console.log('拉取后结果', r);
    console.log('清除key');
    await client.del(key);
  });

  // 模拟3秒后开始生产消息
  console.log('3s后开始生产消息');
  setTimeout(async () => {
    console.log('开始产生消息,插入abc')
    await client.lPush(key, ['a', 'b', 'c']);
  }, 3000);
  return "观察控制台";
}

// 模拟阻塞等待
const testBlockWait = async (client) => {
  const key = 'keyBlock';
  console.log('开始阻塞拉取brpop,这里不用新开一个连接');

  const res = await client.brPop(key, 0);
  console.log('发现队列中出现消息,开始拉取,', res);
  console.log('拉取后结果', await client.lRange(key, 0, -1));
  console.log('清除key');
  await client.del(key);
  client.quit();
}

// 模拟阻塞时生产
const testBlockProduce = async (client) => {
  const key = 'keyBlock';
  console.log('开始产生消息,插入1,2,3')
  await client.lPush(key, ['1', '2', '3']);
  console.log('生产后结果', await client.lRange(key, 0, -1));
  client.quit();
}

// 模拟阻塞 BRPOPLPUSH source destination timeout
// 当队列中存在消息后:
// 1, 拉取一个放到备份队列中,
// 2, 消费(可能失败)
// 3  消费成功后从备份队列中删除
// 4, 重复1,直到为空
// 5, 继续阻塞等待
const testConsum = async (client) => {
  const key = 'keyBlock';
  const key1 = 'keyBlockBak'

  // 重试上次失败的消费
  const retryResult = await reConsum(client);
  if(!retryResult) {
    // console.log('中断等待/或者扔到失败队列中,继续消费');
    console.log('重试消费终止');
    client.quit();
    return;
  }

  //阻塞等待时间,超时后重新等待,不要设置为0,可能导致socket连接失效的问题,一般可以设置600s超时
  const timeout = 5;
  console.log('开始brPopLPush,队列长度:',await client.lLen(key));

  // 注意设置timeout,不能无限等待,可能导致socket连接失效的问题
  const res = await client.brPopLPush(key, key1, timeout);
  if (res === null) {
    //重新阻塞等待
    console.log('超时重新阻塞');
    await testConsum(client);
    return;
  }
  console.log('发现待消费任务:', res,'原队列拉取后:', await client.lRange(key, 0, -1),'备份队列插入后:', await client.lRange(key1, 0, -1));
  const _res = await doConsum(client,res).catch(e=> {
    console.log('error fired',e);
    return;
  });
  if(_res!=='ok') {
    console.log('中断等待/或者扔到失败队列中,继续消费');
    client.quit();
    return;
  }  
  //重新阻塞等待
  await testConsum(client);

  // console.log('清除key');
  // await client.del(key);
  // await client.del(key1);
  // client.quit();
}

// 模拟消费
const doConsum = (client,task) => {
  const key1 = 'keyBlockBak';
  return new Promise((resolve,reject) => {
    setTimeout(async () => {
      //模拟消费失败,期望:备份队列的消息保留,
      // return reject('消费失败'+task);

      // 消费成功
      console.log("消费成功:",task);
      await client.lRem(key1,1,task);
      console.log('从备份队列中删除消息,删除后备份队列:',await client.lRange(key1, 0, -1))
      return resolve('ok')
    }, 2000);
  });
}

// 模拟重复消费:上次消费失败后,重启消费服务时需要重试,
const reConsum = async (client) =>{
  const key1 = 'keyBlockBak';
  const listTask  = await client.lRange(key1, 0, -1);
  if(listTask.length>0) {
    console.log('重试上次失败的消费任务',listTask);
    for(const task of listTask) {
      const result = await doConsum(client,task).catch(e=>{
        console.log('重试消费失败',e);
      });
      if(result!=='ok') {
        return false;
      }
    }
    
  }
  return true;
}

export default async function () {
  // 创建一个新得redis连接
  const client = createClient({
    host: '127.0.0.1',
    port: 6379
  });
  // client.lRem(key,count,value);
  client.on('error', (err) => console.log('Redis Client Error', err));
  await client.connect();
  console.log('redis server connected');


  return { client, test, testBlock, testBlockWait, testBlockProduce, testConsum };
}