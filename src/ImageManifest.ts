import { ImageLayer } from "./ImageLayer";

export interface ImageManifest {
    schemaVersion: number;
    mediaType: string;
    config: ImageLayer;
    layers: ImageLayer[];
}
