/**
 * Main Application Class
 *
 * This class manages the overall application lifecycle and coordinates
 * between different managers and services.
 */

import { app } from 'electron';
import { DataManager } from './DataManager';
import { FileManager } from './FileManager';
import { WindowManager } from './WindowManager';
import { IPCManager } from './IPCManager';
import { Logger } from '../utils/Logger';

export class Application {
  private static instance: Application | null = null;
  private logger: Logger;
  private dataManager: DataManager;
  private fileManager: FileManager;
  private windowManager: WindowManager;
  private ipcManager: IPCManager;
  private isInitialized: boolean = false;

  private constructor() {
    this.logger = new Logger();
    this.dataManager = new DataManager(this.logger);
    this.fileManager = new FileManager(this.logger);
    this.windowManager = new WindowManager(this.logger);
    this.ipcManager = new IPCManager(this.logger, this.dataManager, this.fileManager);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): Application {
    if (!Application.instance) {
      Application.instance = new Application();
    }
    return Application.instance;
  }

  /**
   * Initialize the application
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing application...');

      // Initialize logger first
      await this.logger.initialize();
      this.logger.info('Logger initialized successfully');

      // Initialize data manager
      await this.dataManager.initialize();
      this.logger.info('DataManager initialized successfully');

      // Initialize file manager
      await this.fileManager.initialize();
      this.logger.info('FileManager initialized successfully');

      // Initialize IPC manager
      await this.ipcManager.initialize();
      this.logger.info('IPC manager initialized successfully');

      this.isInitialized = true;
      this.logger.info('Application initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Application not initialized');
      }

      this.logger.info('Starting application...');

      // Create main window
      await this.windowManager.createMainWindow();
      this.logger.info('Application started successfully');

    } catch (error) {
      this.logger.error('Failed to start application:', error);
      throw error;
    }
  }

  /**
   * Shutdown the application
   */
  public async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down application...');

      // Clean up managers
      await this.dataManager.cleanup();
      this.logger.info('Cleaning up DataManager...');

      await this.fileManager.cleanup();
      this.logger.info('Cleaning up FileManager...');

      await this.windowManager.cleanup();
      this.logger.info('Cleaning up WindowManager...');

      await this.ipcManager.cleanup();
      this.logger.info('Cleaning up IPCManager...');

      this.logger.info('Application shutdown complete');

    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught exception:', error);
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled rejection:', reason);
    });
  }
}
