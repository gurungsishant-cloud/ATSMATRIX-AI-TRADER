/**
 * Structured logging with timestamp and level.
 * All audit events go through audit log, not console.
 */

const LOG_LEVELS = Object.freeze({
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
});

class Logger {
  constructor(name = 'ATSMATRIX') {
    this.name = name;
  }

  format(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.name}] [${level}]`;
    return data ? `${prefix} ${message} ${JSON.stringify(data)}` : `${prefix} ${message}`;
  }

  debug(message, data) {
    if (process.env.DEBUG) console.log(this.format(LOG_LEVELS.DEBUG, message, data));
  }

  info(message, data) {
    console.log(this.format(LOG_LEVELS.INFO, message, data));
  }

  warn(message, data) {
    console.warn(this.format(LOG_LEVELS.WARN, message, data));
  }

  error(message, data) {
    console.error(this.format(LOG_LEVELS.ERROR, message, data));
  }
}

const logger = new Logger('ATSMATRIX');
export { logger, Logger };
