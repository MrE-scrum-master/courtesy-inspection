export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  data?: any;
}

export class Logger {
  private readonly service: string;
  private readonly logLevel: LogLevel;

  constructor(service: string) {
    this.service = service;
    this.logLevel = this.getLogLevel();
  }

  debug(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log(LogLevel.DEBUG, message, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log(LogLevel.INFO, message, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log(LogLevel.WARN, message, data);
    }
  }

  error(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log(LogLevel.ERROR, message, data);
    }
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      service: this.service,
      message,
    };

    if (data !== undefined) {
      entry.data = data;
    }

    const logOutput = this.formatLogEntry(entry);

    if (level >= LogLevel.ERROR) {
      console.error(logOutput);
    } else if (level >= LogLevel.WARN) {
      console.warn(logOutput);
    } else {
      console.log(logOutput);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const baseLog = `[${entry.timestamp}] ${entry.level} [${entry.service}] ${entry.message}`;
    
    if (entry.data) {
      if (typeof entry.data === 'object') {
        return `${baseLog} ${JSON.stringify(entry.data)}`;
      }
      return `${baseLog} ${entry.data}`;
    }

    return baseLog;
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    
    switch (envLevel) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }
}