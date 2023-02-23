import {ImageLocation} from "./ImageLocation";
const DEFAULT_REGISTRY_ALIAS = 'docker.io';
export const parse = (specifier: string): ImageLocation => {
  const parts = specifier.split('/');

  const match = /([^/]+\/)?(.+\/)?([^/]+)?$/;
  let matches: any = specifier.match(match);

  if (!matches) {
    throw new Error('invalid image specifier: ' + specifier);
  }
  // discard  the everything match
  matches.shift();
  matches = matches.filter((v: any) => v);

  const trimSlashes = /^\/|\/$/g;

  let image: string = matches[matches.length - 1];
  if (image) image = image.replace(trimSlashes, '');

  let namespace: string|undefined = matches[matches.length - 2];
  if (namespace) namespace = namespace.replace(trimSlashes, '');

  let registry: string|undefined = matches[matches.length - 3];
  if (registry) registry = registry.replace(trimSlashes, '');

  if (!registry) {
    registry = namespace;
    namespace = undefined;
  }

  if (registry === DEFAULT_REGISTRY_ALIAS || !registry) {
    namespace = 'library';
    registry = 'index.docker.io';
  }

  if (registry.indexOf('docker.io') > -1 && !namespace) {
    namespace = 'library';
  }


  const imageProps: {[k: string]: string} = {};

  ['@', ':'].forEach((c) => {
    if (image.indexOf(c) > -1) {
      const imageParts = image.split(c);
      imageProps[c] = imageParts.pop() || '';
      // ignores multiple @s and tags :shrug:
      image = imageParts.join(c);
    }
  });

  const digest = imageProps['@'];
  const tag = imageProps[':'] || 'latest';
  const protocol = boldlyAssumeProtocol(registry);
  const url = `${protocol}://${registry}/${namespace}/${image}:${tag}`;
  return {url,protocol, registry, namespace, image, tag, digest};
};

function boldlyAssumeProtocol(registry: string) {
  if (/.*\.local(?:host)?(?::\d{1,5})?$/.test(registry)) return 'http';
  // Detect the loopback IP (127.0.0.1)
  if (registry.indexOf('localhost:') > -1) return 'http';
  if (registry.indexOf('127.0.0.1') > -1) return 'http';
  if (registry.indexOf('::1') > -1) return 'http';

  return 'https';
}
