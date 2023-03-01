import { RepositoryConfig } from "./RepositoryConfig";
import { PackOptions,pack } from './packer';
import { ImageManifest } from "./ImageManifest";
import { ImageConfig } from "./ImageConfig";
import { parse as parseSpecifier } from "./image-specifier";
// @ts-ignore
import { createClient } from 'docker-registry-client';
import {IncomingMessage} from "http";
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import {ImageLayer} from "./ImageLayer";
import {SyncOptions} from "./SyncOptions";
let Duplex = require("stream").Duplex;
export class Client {
    /**
     * 构建前端部署镜像
     *
     * @param source 基础镜像
     * @param files  添加文件
     * @param target 目标镜像
     */
    static build(source: RepositoryConfig,
                 files:[{
                     dir: string | { [dir: string]: string },
                     target?: string | PackOptions
                 }],
                 target: SyncOptions

    ) {
        let targetClient:any;
        let targetImage:any;
        let targetTags:any;
        Client.image(source).then((res)=>{
            let {image,client} = res;
            return Client.syncImage(client,image,target);
        }).then((res)=>{
            //:{ image: any,client: any,tags: Array<string>}
            console.log("获取镜像数据完成");
            targetClient = res.client;
            targetImage = res.image;
            targetTags = res.tags;
            let fileTasks : Array<Promise<any>> = [];
            files.forEach((file)=>{
                let p = Client.addFiles(targetClient,targetImage,file.dir,file.target);
                fileTasks.push(p);
            });
            return Promise.all(fileTasks);
        }).then((res)=>{
            res.forEach((result)=>{
                Client.addLayer(targetClient,targetImage,result.digest,result.uncompressedDigest,result.size);
            });
            return Client.putImageConfig(targetClient,targetImage);
        }).then((res)=>{
            if(res!=targetImage.manifest.config.digest) {
                throw new Error("签名不一致");
            }
            console.log("更新配置层完成");
            return Client.putManifests(targetClient,targetImage,targetTags);
        }).then((res)=>{
            console.log("更新清单层完成");
            console.log(JSON.stringify(res,null,4));
        });
    }
    static sync(source: RepositoryConfig,
                 target: SyncOptions){
        Client.image(source).then((res)=>{
            let {image,client} = res;
            return Client.syncImage(client,image,target);
        }).then((res)=>{
            // console.log(res);
            console.log("镜像同步完成");
        });
    }
    /**
     * 获取镜像数据
     */
    static async image(repo: RepositoryConfig,tag?:string) {
        let client = await this.buildClient(repo);
        console.log("加载清单文件")
        let manifest: ImageManifest = await this.getManifest(client,tag);
        console.log("获取配置文件")
        const config = await Client.getImageConfig(client,manifest.config.digest);
        let image = {manifest:manifest, config:config};
        return {image:image,client: client};
    }
    static syncImage(sourceClient:any,sourceImage:any,options: SyncOptions): Promise<{image:any,client:any,tags:Array<string>}> {
        let tags:Array<string> = [];
        if(!options.tags){
            tags.push("latest");
        }else if(typeof(options.tags)=="string"){
            tags.push(options.tags);
        }else {
            tags.push(...options.tags);
        }
        let layerMediaType = 'application/vnd.oci.image.layer.v1.tar+gzip';
        if (sourceImage.manifest.mediaType.indexOf('docker') > -1) {
            layerMediaType = 'application/vnd.docker.image.rootfs.diff.tar.gzip';
        }
        console.log("开始同步");
        options = Object.assign({copyRemoteLayers: true, ignoreExists: true}, options);
        return Client.buildClient(options.repo).then((targetClient)=>{
            const copyTasks: Array<Promise<any>> = this.syncLayers(sourceClient,targetClient,sourceImage,true);
            copyTasks.push(this.syncConfig(sourceClient,targetClient,sourceImage,layerMediaType));
            return new Promise((resolve, reject) => {
                Promise.all(copyTasks).then((ress)=>{
                    return Client.syncManifest(targetClient,sourceImage,tags);
                }).then((res)=>{
                    resolve({image:sourceImage,client: targetClient,tags: tags});
                })
            });
        });
    }

    private static syncLayers(sourceClient:any,targetClient:any,sourceImage: any,ignoreExists:boolean){
        let manifest = sourceImage.manifest;
        const copyTasks: Array<Promise<any>> = [];
        manifest.layers.forEach((layer: { digest: string; size: number; }) => {
            let p = Client.existBlob(targetClient, layer.digest).then((exists: boolean) => {
                console.log("判断目标仓库是否存在了数据");
                if (!exists || !ignoreExists) {
                    console.log("不存在进行复制数据");
                    return Client.getBlob(sourceClient,layer.digest).then((data) => {
                        console.log("获取数据成功");
                        return new Promise((uploadResolve,updateReject)=>{
                            let stream = Client.bufferToStream(data);
                            let upOpt = {contentLength:layer.size,digest:layer.digest,stream: stream,};
                            targetClient.blobUpload(upOpt,function(err:Error, res:Response){
                                if(!!err) {
                                    console.log("上传数据失败");
                                    updateReject(err);
                                } else {
                                    console.log("上传数据成功",layer.digest,layer.size);
                                    const layerResult = {
                                        type: "LAYER",
                                        // @ts-ignore
                                        digest: layer.digest,
                                        size: layer.size
                                    };
                                    uploadResolve(layerResult);
                                }
                            });
                        });
                    });
                } else {
                    return false;
                }
            });
            copyTasks.push(p);
        });
        return copyTasks;
    }
    private static syncConfig(sourceClient:any,targetClient:any,sourceImage:any,mediaType:string): Promise<ImageLayer> {
        return Client.getBlob(sourceClient,sourceImage.manifest.config.digest).then((data: Uint8Array)=>{
            let stream = Client.bufferToStream(data);
            let upOpt = {contentLength: sourceImage.manifest.config.size, digest: sourceImage.manifest.config.digest, stream: stream};
            return new Promise((uploadResolve,updateReject)=>{
                targetClient.blobUpload(upOpt,function(err:Error, res:Response) {
                    if (!err) {
                        console.log("上传配置信息数据成功");
                        const layerResult = {
                            type: "CONFIG",
                            // @ts-ignore
                            digest: res.headers['docker-content-digest'],
                            mediaType: mediaType,
                            uncompressedDigest: sourceImage.manifest.config.digest,
                            size: sourceImage.manifest.config.size
                        };
                        // @ts-ignore
                        uploadResolve(layerResult);
                    } else {
                        console.log("上传配置信息数据失败");
                        updateReject(err);
                    }
                });
            });
        });
    }
    private static syncManifest(targetClient:any,sourceImage:any,tags:Array<string>):Promise<any>{
        const tagTasks: Array<Promise<any>> = [];
        console.log("层已经同步，进行清单")
        tags.forEach((tag)=>{
            let p = Client.putManifest(targetClient,sourceImage,tag);
            tagTasks.push(p);
        });
        return Promise.all(tagTasks);
    }
    /**
     * * 加载镜像清单数据
     * @param image
     */
    static getManifest(client:any,tag?: string): Promise<ImageManifest> {
        let cTag = tag ? tag : "latest";
        return new Promise<ImageManifest>((resolve, reject) => {
            client.getManifest({ref: cTag, maxSchemaVersion: 2}, function (err: Error, manifest: any) {
                if (err) {
                    reject(err);
                } else {
                    client.close();
                    resolve(manifest);
                }
            });
        });
    }

    static putManifest(client:any,image:any,tag:string):Promise<{ location:string, digest:string,tag:string}> {
        const manifestStr = JSON.stringify(image.manifest);
        const manifestBuf = Buffer.isBuffer(image.manifest) ?  image.manifest :Buffer.from(manifestStr);
        const digest = 'sha256:' + crypto.createHash('sha256').update(manifestBuf).digest('hex');
        if (!tag) {
            tag = digest;
        }
        var manifestOpts = {
            manifest: manifestStr,
            ref: tag
        };
        return new Promise((resolve, reject) => {
            client.putManifest(manifestOpts,function(err:Error, res:Response, digest:string, location:string){
                if(err){
                    reject(err);
                } else {
                    resolve({digest, location,tag});
                }
            });
        });
    }
    static putManifests(client:any,image:any,tags:Array<string>):Promise<Array<{ location:string, digest:string,tag:string}>> {
        let manifestTasks: Array<any> = [];
        tags.forEach((tag)=>{
            manifestTasks.push(Client.putManifest(client,image,tag));
        })
        return  new Promise<Array<{location: string; digest: string,tag:string}>>((resolve,reject)=>{
            Promise.all(manifestTasks).then((res)=>{
                resolve(res);
            })
        });
    }
    static async getImageConfig(client:any,digest: string): Promise<{config:ImageConfig,data:Uint8Array}> {
        let data: Uint8Array = await Client.getBlob(client,digest);
        let configString = new TextDecoder().decode(data);
        let config = JSON.parse(configString);
        return config;
    }
    static putImageConfig(client:any,image:any):Promise<string> {
        let data = Buffer.from(JSON.stringify(image.config));
        let stream = Client.bufferToStream(data);
        let size =data.length;
        let digest = 'sha256:' + crypto.createHash('sha256').update(data).digest('hex');
        let upOpt = {contentLength: size, digest: digest, stream: stream};
        return new Promise((resolve,reject)=>{
            client.blobUpload(upOpt,function(err:Error, res:Response) {
                if(!!err) {
                    console.log("上传配置信息数据失败");
                    reject(err);
                } else {
                    console.log("上传配置信息数据成功");
                    // @ts-ignore
                    resolve(res.headers['docker-content-digest']);
                }
            });
        });
    }
    static getBlob(client:any,digest: string): Promise<Uint8Array> {
        return new Promise<Uint8Array>((resolve, reject) => {
            client.createBlobReadStream({digest: digest}, function (err: Error, stream: IncomingMessage, res: any) {
                if (err) {
                    reject(err);
                } else {
                    Client.readAll(stream).then((data)=>{
                        // @ts-ignore
                        resolve(data);
                    });
                }
            });
        });
    }

    static existBlob(client:any, digest: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            client.headBlob({digest: digest}, function (err: any, res: any) {
                if (err) {
                    if(err.body && err.body.code=="NotFoundError"){
                        resolve(false);
                    }else {
                        reject(err);
                    }
                } else {
                    resolve(res[0].statusCode === 200);
                }
            });
        });
    }
    static addFiles(tagetClient:any,imageData:any,dir: string | { [dir: string]: string }, targetDir?: string | PackOptions, options?: PackOptions) {
        if (typeof targetDir === 'string') {
            if (typeof dir !== 'string') {
                throw new Error(
                    'specifying a target directory name when the dir is an object of name:target doesn\'t make sense. try addFiles({dir:target})');
            }
            dir = {[targetDir]: dir};
        } else if (targetDir) {
            // options!
            options = targetDir;
        }
        const tarStream = pack(dir, options);
        let uncompressedDigest:string;
        return Client.streamToBuffer(tarStream).then((tar)=>{
            return new Promise((resolve, reject) => {
                // @ts-ignore
                uncompressedDigest = 'sha256:' + crypto.createHash('sha256').update(tar).digest('hex');
                // @ts-ignore
               zlib.gzip(tar,(err,zipdata)=>{
                   if(!!err){
                       reject(err);
                   } else {
                       resolve(zipdata);
                   }
               });
            });
            // @ts-ignore
        }).then((gzip:Buffer)=>{
            let stream = Client.bufferToStream(gzip);
            let digest = 'sha256:' + crypto.createHash('sha256').update(gzip).digest('hex');
            let upOpt = {contentLength:gzip.byteLength,digest:digest,stream: stream};
            return new Promise((uploadResolve,updateReject)=>{
                tagetClient.blobUpload(upOpt,function(err:Error, res:Response){
                    if(!!err) {
                        console.log("上传静态资源层数据失败");
                        updateReject(err);
                    } else {
                        console.log("上传静态资源层数据成功");
                        // @ts-ignore
                        uploadResolve( {digest: res.headers['docker-content-digest'], uncompressedDigest:uncompressedDigest, size:gzip.byteLength});
                    }
                });
            });
        });
    }
    /**
     * 添加层
     * @param image
     * @param digest
     * @param uncompressedDigest
     * @param size
     * @param urls
     */
    static addLayer(client:any,image:any,digest: string, uncompressedDigest: string, size: number, urls?: string[]) {
        let layerMediaType = 'application/vnd.oci.image.layer.v1.tar+gzip';
        if (image.manifest.mediaType.indexOf('docker') > -1) {
            layerMediaType = 'application/vnd.docker.image.rootfs.diff.tar.gzip';
        }
        const layerResult = {mediaType: layerMediaType, digest, size, urls};
        image.manifest.layers.push(layerResult);
        image.config.rootfs.diff_ids.push(uncompressedDigest);
        let data = Buffer.from(JSON.stringify(image.config));
        let configlayerDigest = 'sha256:' + crypto.createHash('sha256').update(data).digest('hex');
        image.manifest.config.digest = configlayerDigest;
        image.manifest.config.size = data.length;
        return Object.assign({}, layerResult, {uncompressedDigest});
    }
    static readAll(stream:IncomingMessage):Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            let data: Uint8Array = new Uint8Array(0);
            let numBytes = 0;
            stream.on('error', function (err: Error) {
                reject(err);
            });
            stream.on('data', function (chunk: Uint8Array) {
                numBytes += chunk.length;
                let mergedArray = new Uint8Array(numBytes);
                if (data.length > 1) {
                    mergedArray.set(data);
                }
                mergedArray.set(chunk, data.length);
                data = mergedArray;
            });
            stream.on('end', function () {
                resolve(data);
            })
            stream.resume();
        });
    }
    // @ts-ignore
    static streamToBuffer(stream):Promise<ArrayBuffer> {
        // @ts-ignore
        return new Promise((resolve, reject) => {
            // @ts-ignore
            let buffers = [];
            stream.on('error', reject);
            // @ts-ignore
            stream.on('data', (data) => {
                // @ts-ignore
                buffers.push(data);
            });
            // @ts-ignore
            stream.on('end', () => {
                // @ts-ignore
                resolve(Buffer.concat(buffers));
            });
        });
    }
    static bufferToStream(buffer:ArrayBuffer) {
        let stream = new Duplex();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }
    static buildClient(repo: RepositoryConfig): Promise<any> {
        let location = parseSpecifier(repo.url);
        return new Promise((resolve, reject) => {
            // @ts-ignore
            if (repo.auth && "username" in repo.auth && repo.auth.username) {
                createClient({
                    name: `${location.protocol}://${location.registry}/${location.namespace}/${location.image}`,
                    // @ts-ignore
                    username: repo.auth.username,
                    // @ts-ignore
                    password: repo.auth.password,
                    version: 2
                }, function (err: Error, client: any) {
                    resolve(client);
                });
            }else if (repo.auth && "token" in repo.auth && repo.auth.token) {

            } else {
                createClient({
                    name: `${location.protocol}://${location.registry}/${location.namespace}/${location.image}`,
                    username :"",
                    password :"",
                    version: 2
                }, function (err: Error, client: any) {
                    resolve(client);
                });
            }
        });
    }
}
