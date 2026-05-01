export const Storage = {
  get: (keys) =>
    new Promise((resolve) => chrome.storage.local.get(keys, resolve)),

  set: (obj) =>
    new Promise((resolve) => chrome.storage.local.set(obj, resolve))
};