import { DEBUG_MODE } from '../config';

/**
 * Debug log. Only outputs to console if DEBUG_MODE in config.js is true.
 * @param  {...any} args - Arguments to log.
 */
export const dlog = (...args) => {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
};

/**
 * Debug warn. Only outputs to console if DEBUG_MODE in config.js is true.
 * @param  {...any} args - Arguments to warn.
 */
export const dwarn = (...args) => {
  if (DEBUG_MODE) {
    console.warn('[DEBUG]', ...args);
  }
};

/**
 * Debug error. Only outputs to console if DEBUG_MODE in config.js is true.
 * @param  {...any} args - Arguments to error.
 */
export const derr = (...args) => {
  if (DEBUG_MODE) {
    console.error('[DEBUG]', ...args);
  }
};

/**
 * Debug info. Only outputs to console if DEBUG_MODE in config.js is true.
 * @param  {...any} args - Arguments to info.
 */
export const dinfo = (...args) => {
  if (DEBUG_MODE) {
    console.info('[DEBUG]', ...args);
  }
};

/**
 * Debug table. Only outputs to console if DEBUG_MODE in config.js is true.
 * @param {any} data - Data to display as a table.
 * @param {string[] | undefined} columns - Optional array of column names.
 */
export const dtable = (data, columns) => {
  if (DEBUG_MODE) {
    console.table(data, columns);
  }
}; 