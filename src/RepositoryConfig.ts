import { ImageCredential } from "./ImageCredential";
export interface RepositoryConfig {
    url: string
    auth?: ImageCredential;
}
