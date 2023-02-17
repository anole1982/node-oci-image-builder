import { ImageLocation } from "./ImageLocation";
import { PackOptions } from './packer';
export class Image {
    private _location: ImageLocation

    constructor(location: ImageLocation) {
        this._location = location;
    }

    /**
     * 获取配置信息
     */
    async getImageConfig() {

    }

    /**
     * 获取镜像数据
     */
    async getImageData() {


    }

    /**
     * * 加载镜像数据
     * @param image
     */
    private async loadImageData(image?: ImageLocation) {

    }

    /**
     * 添加层
     * @param digest
     * @param uncompressedDigest
     * @param size
     * @param urls
     */
    async addLayer( digest: string, uncompressedDigest: string, size: number, urls?: string[]){

    }

    /**
     * 移除层
     * @param digest
     */
    async removeLayer(digest: string){

    }

    addFiles( dir: string|{[dir: string]: string}, targetDir?: string|PackOptions, options?: PackOptions) {

    }

    /**
     * * 保存镜像数据
     * @param image
     */
    async save() {

    }
    /**
     * * 同步镜像数据
     * @param image
     */
    async sync(image: ImageLocation) {

    }

}
