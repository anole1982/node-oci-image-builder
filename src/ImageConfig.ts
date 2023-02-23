export interface ImageConfig {
    rootfs: {
        diff_ids: string[],
        type: string
    };
    config: {
        Hostname: string,
        Domainname: string,
        User: string,
        AttachStdin: boolean,
        AttachStdout: boolean,
        AttachStderr: boolean,
        Tty: boolean,
        OpenStdin: boolean,
        StdinOnce: boolean,
        Env: string[],
        Cmd: string[],
        ArgsEscaped: boolean,
        Image: string,
        Volumes: any,
        WorkingDir: string,
        Entrypoint: null|string[],
        OnBuild: any,
        Labels: any
    },
    os: string,
    container: string
    ;
}
