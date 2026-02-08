type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// In development, show all logs. In production, only warn and above.
const LOG_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
    return levels[level] >= levels[LOG_LEVEL];
}

function formatMessage(level: LogLevel, msg: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${msg}`;
}

/**
 * Centralized logger with log levels.
 * - In development: shows all logs (debug, info, warn, error)
 * - In production: shows only warn and error
 */
export const logger = {
    debug: (msg: string, ...args: unknown[]) => {
        if (shouldLog('debug')) {
            console.debug(formatMessage('debug', msg), ...args);
        }
    },

    info: (msg: string, ...args: unknown[]) => {
        if (shouldLog('info')) {
            console.info(formatMessage('info', msg), ...args);
        }
    },

    warn: (msg: string, ...args: unknown[]) => {
        if (shouldLog('warn')) {
            console.warn(formatMessage('warn', msg), ...args);
        }
    },

    error: (msg: string, ...args: unknown[]) => {
        if (shouldLog('error')) {
            console.error(formatMessage('error', msg), ...args);
        }
    },

    /**
     * Log with explicit level
     */
    log: (level: LogLevel, msg: string, ...args: unknown[]) => {
        switch (level) {
            case 'debug':
                logger.debug(msg, ...args);
                break;
            case 'info':
                logger.info(msg, ...args);
                break;
            case 'warn':
                logger.warn(msg, ...args);
                break;
            case 'error':
                logger.error(msg, ...args);
                break;
        }
    },
};
