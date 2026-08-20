/**
 * Logger Utility
 *
 * Handles logging throughout the application
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logToFile: boolean = true;
  private logFilePath: string = '';

  constructor() {
    // Initialize log file path in initialize() method
  }

  /**
   * Initialize the logger
   */
  public async initialize(): Promise<void> {
    try {
      if (!this.logFilePath) {
        this.logFilePath = path.join(app.getPath('userData'), 'logs', 'app.log');
      }

      // Ensure log directory exists
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      this.logToFile = true;
      this.logLevel = LogLevel.INFO;

      this.info('Logger initialized successfully');
      this.info(`Log level: ${LogLevel[this.logLevel]}`);
      this.info(`Log to file: ${this.logToFile}`);
      this.info(`Log file path: ${this.logFilePath}`);

    } catch (error) {
      console.error('Failed to initialize logger:', error);
      this.logToFile = false;
    }
  }

  /**
   * Log debug message
   */
  public debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Log info message
   */
  public info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * Log warning message
   */
  public warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * Log error message
   */
  public error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level < this.logLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const logMessage = `[${timestamp}] [${levelName}] ${message}`;

    // Console output
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, ...args);
        break;
      case LogLevel.INFO:
        console.info(logMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, ...args);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, ...args);
        break;
    }

    // File output
    if (this.logToFile && this.logFilePath) {
      this.logToFileAsync(logMessage, args);
    }
  }

  /**
   * Log to file asynchronously
   */
  private async logToFileAsync(message: string, args: any[]): Promise<void> {
    try {
      if (!this.logFilePath) {
        return;
      }

      const fullMessage = args.length > 0
        ? `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}\n`
        : `${message}\n`;

      await fs.promises.appendFile(this.logFilePath, fullMessage);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}
