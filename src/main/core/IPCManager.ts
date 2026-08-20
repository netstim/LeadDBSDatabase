/**
 * IPC Manager
 *
 * Handles Inter-Process Communication setup and management
 */

import { Logger } from '../utils/Logger';
import { DataManager } from './DataManager';
import { FileManager } from './FileManager';
import registerFileHandlers from '../ipc/ipcHandlers';

export class IPCManager {
  private logger: Logger;
  private dataManager: DataManager;
  private fileManager: FileManager;
  private initialized: boolean = false;

  constructor(logger: Logger, dataManager: DataManager, fileManager: FileManager) {
    this.logger = logger;
    this.dataManager = dataManager;
    this.fileManager = fileManager;
  }

  /**
   * Initialize IPC handlers
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing IPC handlers...');
      registerFileHandlers();
      this.initialized = true;
      this.logger.info('IPC handlers initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize IPC handlers:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up IPCManager...');
      this.initialized = false;
    } catch (error) {
      this.logger.error('Error cleaning up IPCManager:', error);
    }
  }
}
