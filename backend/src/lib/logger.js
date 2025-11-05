export const logger = {
  debug: (...args) => {
    if (process.env.NODE_ENV === "development") console.debug(...args);
  },
  log: (...args) => {
    if (process.env.NODE_ENV === "development") console.log(...args);
  },
  warn: (...args) => {
    if (process.env.NODE_ENV === "development") console.warn(...args);
  },
  error: (...args) => {
    if (process.env.NODE_ENV === "development") console.error(...args);
  },
};