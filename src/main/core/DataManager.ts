/**
 * Data Manager
 *
 * This class handles all data management operations including storing,
 * retrieving, and managing application state and configuration data.
 * It provides a centralized interface for data operations with proper error handling.
 */

import { app } from 'electron';
import { Logger } from '../utils/Logger';
import { AppError } from '../../types';

/**
 * Data Manager class for handling all data operations
 */
export class DataManager {
  private logger: Logger;
  private data: Record<string, any> = {};
  private isInitialized: boolean = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize the data manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('DataManager already initialized');
      return;
    }

    try {
      this.logger.info('Initializing DataManager...');

      // Initialize default data
      this.initializeDefaultData();

      this.isInitialized = true;
      this.logger.info('DataManager initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize DataManager:', error);
      throw new AppError('DATA_MANAGER_INIT_FAILED', 'Failed to initialize DataManager', error);
    }
  }

  /**
   * Cleanup data manager resources
   */
  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up DataManager...');

    // Clear all data
    this.data = {};

    this.isInitialized = false;
  }

  /**
   * Get data by key
   */
  public getData<T = any>(key: string): T | undefined {
    try {
      this.logger.debug(`Getting data for key: ${key}`);

      if (!this.isInitialized) {
        throw new AppError('DATA_MANAGER_NOT_INITIALIZED', 'DataManager not initialized');
      }

      const value = this.data[key];
      this.logger.debug(`Retrieved data for key: ${key}, type: ${typeof value}`);

      return value;

    } catch (error) {
      this.logger.error(`Failed to get data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set data by key
   */
  public setData<T = any>(key: string, value: T): void {
    try {
      this.logger.debug(`Setting data for key: ${key}, type: ${typeof value}`);

      if (!this.isInitialized) {
        throw new AppError('DATA_MANAGER_NOT_INITIALIZED', 'DataManager not initialized');
      }

      this.data[key] = value;
      this.logger.debug(`Successfully set data for key: ${key}`);

    } catch (error) {
      this.logger.error(`Failed to set data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if data exists for a key
   */
  public hasData(key: string): boolean {
    try {
      this.logger.debug(`Checking if data exists for key: ${key}`);

      if (!this.isInitialized) {
        throw new AppError('DATA_MANAGER_NOT_INITIALIZED', 'DataManager not initialized');
      }

      const exists = key in this.data;
      this.logger.debug(`Data exists for key ${key}: ${exists}`);

      return exists;

    } catch (error) {
      this.logger.error(`Failed to check data existence for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete data by key
   */
  public deleteData(key: string): boolean {
    try {
      this.logger.debug(`Deleting data for key: ${key}`);

      if (!this.isInitialized) {
        throw new AppError('DATA_MANAGER_NOT_INITIALIZED', 'DataManager not initialized');
      }

      if (key in this.data) {
        delete this.data[key];
        this.logger.debug(`Successfully deleted data for key: ${key}`);
        return true;
      } else {
        this.logger.debug(`No data found for key: ${key}`);
        return false;
      }

    } catch (error) {
      this.logger.error(`Failed to delete data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all data keys
   */
  public getAllKeys(): string[] {
    try {
      this.logger.debug('Getting all data keys');

      if (!this.isInitialized) {
        throw new AppError('DATA_MANAGER_NOT_INITIALIZED', 'DataManager not initialized');
      }

      const keys = Object.keys(this.data);
      this.logger.debug(`Retrieved ${keys.length} data keys`);

      return keys;

    } catch (error) {
      this.logger.error('Failed to get all data keys:', error);
      throw error;
    }
  }

  /**
   * Get all data
   */
  public getAllData(): Record<string, any> {
    try {
      this.logger.debug('Getting all data');

      if (!this.isInitialized) {
        throw new AppError('DATA_MANAGER_NOT_INITIALIZED', 'DataManager not initialized');
      }

      const data = { ...this.data };
      this.logger.debug(`Retrieved all data with ${Object.keys(data).length} keys`);

      return data;

    } catch (error) {
      this.logger.error('Failed to get all data:', error);
      throw error;
    }
  }

  /**
   * Clear all data
   */
  public clearAllData(): void {
    try {
      this.logger.debug('Clearing all data');

      if (!this.isInitialized) {
        throw new AppError('DATA_MANAGER_NOT_INITIALIZED', 'DataManager not initialized');
      }

      const keyCount = Object.keys(this.data).length;
      this.data = {};
      this.logger.debug(`Cleared ${keyCount} data entries`);

    } catch (error) {
      this.logger.error('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * Get data size (number of keys)
   */
  public getDataSize(): number {
    try {
      this.logger.debug('Getting data size');

      if (!this.isInitialized) {
        throw new AppError('DATA_MANAGER_NOT_INITIALIZED', 'DataManager not initialized');
      }

      const size = Object.keys(this.data).length;
      this.logger.debug(`Data size: ${size} keys`);

      return size;

    } catch (error) {
      this.logger.error('Failed to get data size:', error);
      throw error;
    }
  }

  /**
   * Initialize default data
   */
  private initializeDefaultData(): void {
    try {
      this.logger.debug('Initializing default data');

      // Set default application state
      this.data = {
        // Application state
        isInitialized: true,
        currentDirectory: null,
        isLeadDBSFolder: false,
        patients: [],
        currentPatient: null,
        currentTimeline: null,

        // UI state
        windowState: {
          width: 1200,
          height: 800,
          isMaximized: false
        },

        // User preferences
        preferences: {
          theme: 'light',
          language: 'en',
          autoSave: true,
          showDebugInfo: false
        },

        // Application configuration
        config: {
          version: app.getVersion(),
          buildDate: new Date().toISOString(),
          platform: process.platform,
          arch: process.arch
        }
      };

      this.logger.debug('Default data initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize default data:', error);
      throw error;
    }
  }

  /**
   * Validate data key
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new AppError('INVALID_KEY', 'Data key must be a non-empty string');
    }

    if (key.length > 100) {
      throw new AppError('INVALID_KEY', 'Data key must be 100 characters or less');
    }
  }

  /**
   * Validate data value
   */
  private validateValue(value: any): void {
    if (value === undefined) {
      throw new AppError('INVALID_VALUE', 'Data value cannot be undefined');
    }

    // Check for circular references
    try {
      JSON.stringify(value);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('circular')) {
        throw new AppError('INVALID_VALUE', 'Data value contains circular references');
      }
      throw error;
    }
  }
}
