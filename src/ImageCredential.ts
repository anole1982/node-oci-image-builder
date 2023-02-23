export interface BasicCredential {
    username: string
    password: string
}
export interface TokenCredential {
    token: string
}
export type ImageCredential = BasicCredential|TokenCredential;
