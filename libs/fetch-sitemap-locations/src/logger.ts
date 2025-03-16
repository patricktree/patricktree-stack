import { AsyncLocalStorage } from 'node:async_hooks';

type LoggerAsyncLocalStorageStore = {
  enableLogging: boolean;
};

export const loggerAsyncLocalStorage = new AsyncLocalStorage<LoggerAsyncLocalStorageStore>();

export function log(message: string): void {
  const enableLogging = !!loggerAsyncLocalStorage.getStore()?.enableLogging;
  if (enableLogging) {
    console.log(message);
  }
}
