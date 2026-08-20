/**
 * Window Manager
 *
 * Handles creation and management of Electron windows
 */

import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import { Logger } from '../utils/Logger';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Create the main application window
   */
  public async createMainWindow(): Promise<void> {
    try {
      this.logger.info('Creating main window...');

      // In development, preload is in .erb/dll; in production, it's in the app directory
      const preloadPath = process.env.NODE_ENV === 'development'
        ? path.join(app.getAppPath(), '.erb', 'dll', 'preload.js')
        : path.join(__dirname, 'preload.js');
      const iconPath = path.join(app.getAppPath(), 'assets', 'icon.png');

      this.logger.info(`Preload path: ${preloadPath}`);
      this.logger.info(`Icon path: ${iconPath}`);

      this.mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false,
        icon: iconPath,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: preloadPath,
        },
      });

      // Load the application
      await this.loadApplication();

      // Show window when ready
      this.mainWindow.once('ready-to-show', () => {
        this.logger.info('Main window ready to show');
        if (this.mainWindow) {
          this.mainWindow.show();
        }
      });

      // Handle window closed
      this.mainWindow.on('closed', () => {
        this.logger.info('Main window closed');
        this.mainWindow = null;
      });

      this.logger.info('Main window created successfully');

    } catch (error) {
      this.logger.error('Failed to create main window:', error);
      throw error;
    }
  }

  /**
   * Load the application in the main window
   */
  private async loadApplication(): Promise<void> {
    try {
      if (!this.mainWindow) {
        throw new Error('Main window not created');
      }

      const port = process.env.PORT || 1212;
      const url = `http://localhost:${port}`;

      this.logger.info(`Loading application from development server on port ${port}`);
      await this.mainWindow.loadURL(url);
      this.logger.info('Loaded application from development server on port 1212');

    } catch (error) {
      this.logger.error('Failed to load application:', error);
      throw error;
    }
  }

  /**
   * Get the main window
   */
  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      if (this.mainWindow) {
        this.mainWindow.close();
        this.mainWindow = null;
      }
      this.logger.info('Cleaning up WindowManager...');
    } catch (error) {
      this.logger.error('Error cleaning up WindowManager:', error);
    }
  }
}
