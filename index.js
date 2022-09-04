import Koa from 'koa';
import router from './routes/routeRedis.js';
import koa2 from 'koa2-cors';
import bodyparser from 'koa-bodyparser';
import useRedis from './hooks/useRedis.js'


const app = new Koa();

//允许跨域
app.use(koa2());

//koa-bodyparser中间件可以把koa2上下文的formData数据解析到ctx.request.body中
// app.use(require('koa-bodyparser')());
app.use(bodyparser());

// 中间件包括: 应用级中间件 / 路由中间件 /错误处理中间件 /第三方中间件
// 中间件代码执行后,必须通过 next(),来继续中断的流程,类似于vue的路由导航守卫
// 其中应用级中间件必须通过 async+await next() 来实现.
// 其他中间件在调用next的时候不需要await
app.use(async (ctx, next) => {
    // 路由生效前输出
    // console.log('1、这是第一个中间件01,你可以设置全局变量');

    //全局的G变量
    // ctx.state.G = {
    //     url: 'http://www.itying.com',
    //     prevPage: ctx.request.headers['referer']   /*上一页的地址*/
    // }
    // 必须执行 next ,后面的路由才会继续匹配
    await next();

    // 路由结束后输出
    // console.log('1.1,先进后出')
})
// 错误处理中间件
app.use(async (ctx, next) => {
    // 路由生效前输出
    // console.log('2、这是第二个中间件02,获取全局变量,并加入错误处理逻辑');
    // console.log(ctx.state.G);
    await next();

    // 路由结束后输出,遵循后进先出的原则
    // console.log('2.1,后进先出的次序触发')
    if (ctx.status == 404) {
        ctx.status = 404;
        // ctx.body="这是一个404页面"
        console.log('路由匹配失败', ctx.URL.href)
    }
})

// 启动路由
// router.allowedMethods()用在了路由匹配router.routes()之后,所以在当所有路由中间件最后调用.此时根据ctx.status设置response响应头
app.use(router.routes(), router.allowedMethods());

// 下面这个中间件如果要执行,必须路由中执行 next(),
app.use(async (ctx, next) => {
    // console.log('这个中间件在路由执行完成后触发-路由代码中必须有next()')
})

// error-handling
// app.on('error', (err, ctx) => {
//     console.error('server error', err, ctx)
// });

app.listen(3000, async () => {
    // 启动消费服务
    const { client, startConsum } = await useRedis(true);
    await startConsum(client);

    console.log('starting at port 3000');
});