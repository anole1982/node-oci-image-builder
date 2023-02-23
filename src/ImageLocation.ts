export interface ImageLocation {
    url: string;
    protocol: string;
    registry: string;
    namespace?: string;
    image?: string;
    tag?: string;
    digest?: string;
}
