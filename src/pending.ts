export const pending = (): PendingTracker => {
  // tslint:disable-next-line:no-any
  const active: {[k: string]: Promise<any>} = {};
  let inc = 0;
  return {
    // so you can Promise.all() these active promises
    active: () => {
      return Object.values(active);
    },
    track: <T>(p: Promise<T>): Promise<T> => {
      if (inc + 1 === inc) inc = -1;
      active[inc++] = p;
      const _inc = inc;
      if (p.finally) {
        p.finally(() => {
          delete active[_inc];
        });
        return p;
      }

      // tslint:disable-next-line:no-any
      let resolve: any, reject: any;
      const proxy = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });

      p.then((value) => {
         delete active[_inc];
         resolve(value);
       }).catch((e) => {
        delete active[_inc];
        reject(e);
      });
      return proxy as Promise<T>;
    }
  };
};


export type PendingTracker = {
  // tslint:disable-next-line:no-any
  active: () => Array<Promise<any>>,
  track: <T>(p: Promise<T>) => Promise<T>
};
