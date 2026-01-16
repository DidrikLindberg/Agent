import winston from 'winston';
import path from 'path';
import fs from 'fs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function createLogger(level: LogLevel, logDir?: string): winston.Logger {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${metaStr}`;
        })
      ),
    }),
  ];

  if (logDir) {
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `agent-${dateStr}.log`);

    transports.push(
      new winston.transports.File({
        filename: logFile,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );
  }

  return winston.createLogger({
    level,
    transports,
  });
}

// Default logger instance
let defaultLogger: winston.Logger | null = null;

export function getLogger(): winston.Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger('info');
  }
  return defaultLogger;
}

export function setDefaultLogger(logger: winston.Logger): void {
  defaultLogger = logger;
}
