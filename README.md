[# node-oci-image-builder

使用例子

const{Client}=require("node-oci-image-builder");
Client.build(
    {
        url:"nginx:latest",
        auth:{username:"XXX",password:"XXXX"}
    },
    [
        {
            dir:"dist",
            target:"/usr/share/nginx/html/"
        },
        {
            dir:"deploy/conf/nginx.conf",
            target:"/etc/nginx/conf.d/default.conf"
        }
    ],
    {
        repo:{
            url:"registry.cn-beijing.aliyuncs.com/XXns/XXXpack",
            auth:{
                username:"XXX",
                password:"XXXXX"}
        },
        tags:["0.0.7","latest"]
    }
);
](https://www.npmjs.com/package/node-oci-image-builder
不依赖与docker 等工具 打镜像包；

工作原理是使用 docker registry v2 restful api 来实现

https://docs.docker.com/registry/spec/api/；

执行步骤先做镜像同步，然后将加入新层，目前主要适用于前端打包；

目前有2个方法，

1. sync 同步镜像
2. build 同步镜像+添加新层；



例子
----------------------------------------

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
);)
