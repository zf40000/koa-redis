import koaRouter from 'koa-router'
// import useTest from '../hooks/useTest.js'
import useRedis from '../hooks/useRedis.js'
const router = koaRouter()

// 控制面板\系统和安全\Windows Defender 防火墙

// router.get('/', async (ctx, next) => {
//     console.log('路由 /')
//     // 这里有next 会继续往下匹配,否则就会中断执行,
//     next()
// })
// router.get('/', function (ctx, next) {
//   // console.log('这里第二次匹配到路由 /');
//   ctx.body = `
//     <pre>
//         1.测试get参数 <a href='/get?a=aa&b=bb'>访问带get参数的页面</a>
//         2,<a href='/test-redis'>测试redis</a>
//     </pre>
//     `
// })

// // 测试get
router.get('/get', (ctx, next) => {
  let url = ctx.url
  //从request中获取GET请求
  let request = ctx.request
  let req_query = request.query
  let req_querystring = request.querystring

  //从上下文中直接获取
  let ctx_query = ctx.query
  let ctx_querystring = ctx.querystring

  ctx.body = {
    url,
    origin:request.origin,
    originalUrl:request.originalUrl,
    href:request.href,
    path:request.path
  }
  // console.log('router /get')
})

// 测试post
// router.post('/post', (ctx, next) => {
//   // 获得post参数
//   const post = ctx.request.body
//   console.log('post数据:', post)

//   ctx.body = {
//     success: true,
//     params: post,
//     message: '增加数据成功',
//   }
//   //有了这句会执行后面的中间件
//   next()
// })

// router.get('/test-redis', async (ctx, next) => {
//   const { client, test } = await useTest()
//   // console.log(res);
//   const arr = await test(client)
//   ctx.body = arr
//     .map((item) => {
//       return `<p>${item}</p>`
//     })
//     .join('')
// })

// router.get('/test-block', async (ctx, next) => {
//   const { client, testBlock } = await useTest()
//   // console.log(res);
//   const arr = await testBlock(client)
//   ctx.body = arr
// })
// router.get('/test-block-wait', async (ctx, next) => {
//   const { client, testBlockWait } = await useTest()
//   // console.log(res);
//   testBlockWait(client)
//   ctx.response.type = 'html'
//   ctx.body = `阻塞等待成功, <a href="./test-block-wait?type=produce" target="_blank">点击生产消息</a>`
// })

// router.get('/testConsum', async (ctx, next) => {
//   const { client, testConsum } = await useTest()
//   // console.log(res);
//   testConsum(client)
//   ctx.response.type = 'html'
//   ctx.body = `消费服务启动(开始阻塞等待新消息), <a href="./test-block-produce" target="_blank">点击生产消息</a>`
// })
// // 模拟生产
// router.get('/test-block-produce', async (ctx, next) => {
//   const { client, testBlockProduce } = await useTest()
//   // console.log(res);
//   await testBlockProduce(client)
//   ctx.body = '生产消息完成,观察控制台'
// })

// lis请求响应,如果要测试这个接口,请使用apifox进行测试
router.all('/saveLisData', async (ctx, next) => {
  const post = ctx.request.body
  if (!post) {
    return
  }
  const { client, produceMsg } = await useRedis()
  const data = []
  data.push(post)
  await produceMsg(client, data)
  ctx.body = {success:true,msg:'保存成功',post}
})

// 显示redis的系统信息
router.get('/info', async (ctx, next) => {
  const { client, produceMsg } = await useRedis()
  const info = await client.info()
  // client.quit();
  ctx.body = info
})

export default router
