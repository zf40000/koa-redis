# to do 
1. 改造 watch,使得发生变动时,自动重启node服务 OK
使用 nodemon 来代替 supervisor 来进行监控任务。相比 supervisor ，nodemon 的优点包括：更轻量级，内存占用更小。使用更加方便，更容易进行扩展等。
pnm i -g nodemon
nodemon index
做成script: 
 "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "serve": "nodemon ./index.js"
  },
可以通过npm run serve启动了,保持和其他项目一致

1. commandjs 改造成es6 OK
https://juejin.cn/post/7088612410105266190

2. 模拟创建队列任务

3. 模拟消费,需要轮询消费,或者触发订阅等. 
google 搜索 redis 消息队列

4 Lua Scripts 确保一致性

# 压测方法
为了快速让配置修改生效,在redis目录下增加了restart.bat文件,通过powershell执行,可以快速载入最新的配置后重启redis,提高调试速度,
为了观察redis的状态,增加了 /info路由,显示需要关注的信息,在网页中打开,
jmeter进行压测

# redis应用误区
不需要每次web请求都创建一个client,多个web请求共享一个client即可,client可以在nodesj服务启动时及创建,timeout设置为10分钟,可以在10分钟自动重连(保活),
路由中复用这个client即可,