import {RepositoryConfig} from "./RepositoryConfig";

export interface SyncOptions {
    repo: RepositoryConfig;
    tags?:string|Array<string>;
    copyRemoteLayers?: boolean;
    ignoreExists?: boolean;
}
