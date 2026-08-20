/**
 * Renderer Process Entry Point
 * 
 * This file initializes the React application and renders the main App component
 * into the DOM. It serves as the entry point for the renderer process in the
 * Electron application.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './pages/App';

// Get the root DOM element
const container = document.getElementById('root') as HTMLElement;

// Create React root and render the App component
const root = createRoot(container);
root.render(<App />);
