# 说明

https://www.npmjs.com/package/node-oci-image-builder
不依赖与docker 等工具 打镜像包；

工作原理是使用 docker registry v2 restful api 来实现

https://docs.docker.com/registry/spec/api/；

执行步骤先做镜像同步，然后将加入新层，目前主要适用于前端打包；

目前有2个方法，

1. sync 同步镜像

   目前同步采用先下载，下载完成后上传，下次内容在内存。对于大文件可能会存在超时问题，后续需要改造一下；

2. build 同步镜像+添加新层；


例子
========================================

```javascript
const{Client}=require("node-oci-image-builder");
Client.build(
    {
        url:"nginx:latest",
        // 可选，不填即匿名
        auth:{  
                username:"User Name",
                password:"Password"}
    },
    [
        {
            dir:"dist",
            target:"/usr/share/nginx/html/archive/"
        },
        {
            dir:"dist",
            target:"/usr/share/nginx/html/casecenter/"
        },
        {
            dir:"deploy/nginx.conf",
            target:"/etc/nginx/conf.d/default.conf"
        }
    ],
    {
        repo:{
            url: "registry.cn-beijing.aliyuncs.com/namespace/imagename",
            auth:{
                username:"User Name",
                password:"Password"}
        },
        tags:["0.1.5","latest"]
    }
);
```

# 后续计划

1. 修复大文件同步问题；
2. 增加打包tar文件本地功能；
3. 增加tar文件导入功能；
