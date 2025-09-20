export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

class ConsoleLogger implements Logger {
  debug(message: string, meta: Record<string, unknown> = {}): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(message, meta);
    }
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    console.info(message, meta);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    console.warn(message, meta);
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    console.error(message, meta);
  }
}

export const logger: Logger = new ConsoleLogger();
