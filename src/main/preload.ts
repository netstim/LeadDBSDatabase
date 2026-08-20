// import { contextBridge, ipcRenderer, IpcRendererEvent, webFrame } from 'electron';

// export type Channels = 'ipc-example';

// const electronHandler = {
//   ipcRenderer: {
//     sendMessage(channel: Channels, ...args: unknown[]) {
//       ipcRenderer.send(channel, ...args);
//     },
//     on(channel: Channels, func: (...args: unknown[]) => void) {
//       const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
//         func(...args);
//       ipcRenderer.on(channel, subscription);

//       return () => {
//         ipcRenderer.removeListener(channel, subscription);
//       };
//     },
//     once(channel: Channels, func: (...args: unknown[]) => void) {
//       ipcRenderer.once(channel, (_event, ...args) => func(...args));
//     },
//   },
// };

// contextBridge.exposeInMainWorld('electron', electronHandler);

// export type ElectronHandler = typeof electronHandler;

// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import {
  contextBridge,
  ipcRenderer,
  IpcRendererEvent,
  webFrame,
} from 'electron';

export type Channels = string; // Allow any channel name for flexibility

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args), // Add invoke method with proper typing
  },
  // zoom: {
  //   zoomIn() {
  //     webFrame.setZoomLevel(webFrame.getZoomLevel() + 1);
  //   },
  //   zoomOut() {
  //     webFrame.setZoomLevel(webFrame.getZoomLevel() - 1);
  //   },
  //   resetZoom() {
  //     webFrame.setZoomLevel(0);
  //   },
  // },
  // zoom: {
  //   zoomIn() {
  //     const newZoomLevel = webFrame.getZoomLevel() + 1;
  //     webFrame.setZoomLevel(newZoomLevel);
  //     ipcRenderer.send('zoom-level-changed', newZoomLevel);
  //   },
  //   zoomOut() {
  //     const newZoomLevel = webFrame.getZoomLevel() - 1;
  //     webFrame.setZoomLevel(newZoomLevel);
  //     ipcRenderer.send('zoom-level-changed', newZoomLevel);
  //   },
  //   resetZoom() {
  //     const newZoomLevel = 0;
  //     webFrame.setZoomLevel(newZoomLevel);
  //     ipcRenderer.send('zoom-level-changed', newZoomLevel);
  //   },
  // },
  zoom: {
    setZoomLevel(level: any) {
      webFrame.setZoomLevel(level);
      // ipcRenderer.send('zoom-level-changed', level);
      ipcRenderer.on('zoom-level-changed', (event, zoomLevel) => {
        webFrame.setZoomLevel(zoomLevel);
      });
    },
  },
  selectFolder: () => {
    ipcRenderer.send('select-folder'); // Send message to trigger folder selection
  },
  getClinicalScores: () => {
    return ipcRenderer.invoke('get-clinical-scores-types');
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
