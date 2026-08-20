/**
 * File Manager
 *
 * Handles file operations and directory management
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';

export class FileManager {
  private logger: Logger;
  private userDataPath: string = '';

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize the file manager
   */
  public async initialize(): Promise<void> {
    try {
      if (!this.userDataPath) {
        this.userDataPath = app.getPath('userData');
      }

      // Ensure user data directory exists
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true });
      }

      this.logger.info('FileManager initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize FileManager:', error);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  public async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read a JSON file
   */
  public async readJSONFile<T>(filePath: string): Promise<T> {
    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Failed to read JSON file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Write a JSON file
   */
  public async writeJSONFile<T>(filePath: string, data: T): Promise<void> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await fs.promises.writeFile(filePath, jsonString, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to write JSON file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get user data path
   */
  public getUserDataPath(): string {
    return this.userDataPath;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up FileManager...');
    } catch (error) {
      this.logger.error('Error cleaning up FileManager:', error);
    }
  }
}
