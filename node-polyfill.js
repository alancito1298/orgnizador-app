// Polyfills para ejecutar Expo SDK 58 / Metro en Node.js 20.17.x
if (typeof URL !== 'undefined' && typeof URL.parse !== 'function') {
  URL.parse = function parse(url, base) {
    try {
      return base !== undefined ? new URL(url, base) : new URL(url);
    } catch {
      return null;
    }
  };
}

if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Object.groupBy !== 'function') {
  Object.groupBy = function groupBy(items, callbackFn) {
    const obj = Object.create(null);
    let i = 0;
    for (const item of items) {
      const key = callbackFn(item, i++);
      if (obj[key] === undefined) {
        obj[key] = [item];
      } else {
        obj[key].push(item);
      }
    }
    return obj;
  };
}

if (typeof Map.groupBy !== 'function') {
  Map.groupBy = function groupBy(items, callbackFn) {
    const map = new Map();
    let i = 0;
    for (const item of items) {
      const key = callbackFn(item, i++);
      const list = map.get(key);
      if (list === undefined) {
        map.set(key, [item]);
      } else {
        list.push(item);
      }
    }
    return map;
  };
}

