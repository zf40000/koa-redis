
import koaRouter from 'koa-router';
import useTest from '../hooks/useTest.js'
import useRedis from '../hooks/useRedis.js'
const router = koaRouter();

// 控制面板\系统和安全\Windows Defender 防火墙

// router.get('/', async (ctx, next) => {
//     console.log('路由 /')
//     // 这里有next 会继续往下匹配,否则就会中断执行,
//     next()
// })
router.get('/', function (ctx, next) {
    // console.log('这里第二次匹配到路由 /');
    ctx.body = `
    <pre>
        1.测试get参数 <a href='/get?a=aa&b=bb'>访问带get参数的页面</a>
        2,<a href='/test-redis'>测试redis</a>
    </pre>
    `;
})

// 测试get
router.get('/get', (ctx, next) => {
    let url = ctx.url;
    //从request中获取GET请求
    let request = ctx.request;
    let req_query = request.query;
    let req_querystring = request.querystring;

    //从上下文中直接获取
    let ctx_query = ctx.query;
    let ctx_querystring = ctx.querystring;

    ctx.body = {
        url,
        req_query,
        req_querystring,
        ctx_query,
        ctx_querystring
    }
    // console.log('router /get')
});

// 测试post
router.post('/post', (ctx, next) => {
    // 获得post参数
    const post = ctx.request.body;
    console.log('post数据:',post);

    ctx.body={
        "success":true,
        'params':post,
        "message":'增加数据成功'
    };
    //有了这句会执行后面的中间件
    next();
});

router.get('/test-redis',async (ctx, next) => {
    const {client,test} =  await useTest();
    // console.log(res);
    const arr = await test(client);
    ctx.body= arr.map(item=>{
        return `<p>${item}</p>`;
    }).join('');
});

router.get('/test-block',async (ctx, next) => {
    const {client,testBlock} =  await useTest();
    // console.log(res);
    const arr = await testBlock(client);
    ctx.body= arr;
});
router.get('/test-block-wait',async (ctx, next) => {
    const {client,testBlockWait} =  await useTest();
    // console.log(res);
    testBlockWait(client);
    ctx.response.type = 'html';
    ctx.body= `阻塞等待成功, <a href="./test-block-wait?type=produce" target="_blank">点击生产消息</a>`;
});

router.get('/testConsum',async (ctx, next) => {
    const {client,testConsum} =  await useTest();
    // console.log(res);
    testConsum(client);
    ctx.response.type = 'html';
    ctx.body= `消费服务启动(开始阻塞等待新消息), <a href="./test-block-produce" target="_blank">点击生产消息</a>`;
});
// 模拟生产
router.get('/test-block-produce',async (ctx, next) => {
    const {client,testBlockProduce} =  await useTest();
    // console.log(res);
    await testBlockProduce(client);
    ctx.body="生产消息完成,观察控制台";
})

// lis请求响应
router.get('/saveLisData',async (ctx, next) => {
    const {client,produceMsg} =  await useRedis();
    const data = [];

    // 创建数据接口样本
    const demoItem = {
        InstrID:12,
        TestID:98,
        BarcodeID:'',
        TestTime:'2018-04-24T08:40:00',
        ItemID:'WBC',
        Result:'5.99',
        Result2:'',
        Result3:'',
        Result4:'',
        Flag:0,
        Remark:'',
        CreateTime:'2022-06-15T15:02:43.103723+08:00',
    };
    for(let i=0;i<1;i++) {
        data.push(demoItem)
    }
    // console.log('开始生产');
    
    const res = await produceMsg(client,data);
    // console.log('produceMsg over',res);

    // client.quit();console.log('quit');const res='quit';
    ctx.body=res;
    
})

router.get('/info',async (ctx, next) => {
    const {client,produceMsg} =  await useRedis();
    const info = await client.info();
    // client.quit();
    ctx.body = info;
})

// // 正式的监听
// router.get('/testConsum',async (ctx, next) => {
//     const {client,testConsum} =  await useTest();
//     // console.log(res);
//     testConsum(client);
//     ctx.response.type = 'html';
//     ctx.body= `消费服务启动(开始阻塞等待新消息), <a href="./test-block-produce" target="_blank">点击生产消息</a>`;
// });

// module.exports = router;
export default router;