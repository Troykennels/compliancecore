const originalFetch = globalThis.fetch;
globalThis.fetch = (target, ...args) => {
  const url = new URL(typeof target === 'string' || target instanceof URL ? target : target.url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    return Promise.reject(new Error('External network access is disabled in the local verification fixture.'));
  }
  return originalFetch(target, ...args);
};
