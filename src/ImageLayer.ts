export interface ImageLayer {
    mediaType: string;
    size: number;
    digest: string;
    uncompressedDigest?: string;
    urls?: string[];
    type?: "CONFIG"|"LAYER";
}
