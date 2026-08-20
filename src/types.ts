/**
 * Type Definitions
 *
 * This file contains shared type definitions and custom error classes
 * used throughout the application.
 */

/**
 * Custom Application Error class
 * Provides structured error handling with error codes and context
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly context?: any;

  constructor(code: string, message: string, context?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Patient data structure
 */
export interface Patient {
  id: string;
  name?: string;
  elmodel?: string;
  [key: string]: any;
}

/**
 * Stimulation data structure
 */
export interface StimulationData {
  mode?: string;
  type?: string;
  path?: string;
  filepath?: string;
  patientname?: string | string[];
  patientfolders?: string[][];
  labels?: string[];
  label?: string;
  S?: any;
  stimDir?: string;
  electrodeModels?: string[];
  elmodel?: string;
  leadpath?: string;
  [key: string]: any;
}

/**
 * Timeline data structure
 */
export interface Timeline {
  timeline: string;
  hasClinical: boolean;
  hasStimulation: boolean;
}

/**
 * Historical data structure for file operations
 */
export interface Historical {
  patient: Patient;
  timeline: string;
  directoryPath: string;
  leadDBS: boolean;
}

/**
 * Window state structure
 */
export interface WindowState {
  width: number;
  height: number;
  isMaximized: boolean;
}

/**
 * User preferences structure
 */
export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  autoSave: boolean;
  showDebugInfo: boolean;
}

/**
 * Application configuration structure
 */
export interface AppConfig {
  version: string;
  buildDate: string;
  platform: string;
  arch: string;
}
