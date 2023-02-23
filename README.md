# node-oci-image-builder

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
