export const logger = {
  debug: (...args) => {
    if (import.meta.env?.DEV) console.debug(...args);
  },
  log: (...args) => {
    if (import.meta.env?.DEV) console.log(...args);
  },
  warn: (...args) => {
    if (import.meta.env?.DEV) console.warn(...args);
  },
  error: (...args) => {
    if (import.meta.env?.DEV) console.error(...args);
  },
};