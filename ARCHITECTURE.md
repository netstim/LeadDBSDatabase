## LeadDBS Programmer — System Architecture

This document provides a high-level and component-level view of the Electron-based application, its renderer (React), the main process, IPC bridge via preload, background workers, assets, and the optional local HTTP server.

### High-Level Context

```mermaid
flowchart LR
  User((Clinician/Researcher)) -->|Interacts| ElectronApp[Electron Desktop App]
  ElectronApp -->|Main/Renderer| OS[(macOS/Windows/Linux)]
  ElectronApp -->|Reads/Writes| FileSystem[(Local Filesystem)]
  ElectronApp -->|Optional| LocalAPI[(Local HTTP API Server)]
```

### Container View

```mermaid
flowchart TB
  subgraph ElectronApp[Electron Application]
    direction LR
    Main[Main Process\n`src/main/main.ts`\n`src/main/core/*`\n`src/main/ipc/ipcHandlers.ts`]
    Preload[Preload Script\n`src/main/preload.ts`]
    Renderer[Renderer (React)\n`src/renderer/**/*`\n`src/renderer/pages/App.tsx`]
  end

  Assets[Assets/Templates\n`assets/`, `public/*.xlsx`]
  Workers[Workers (Web/Node)\n`src/renderer/workers/slice-worker.js`\n`src/renderer/niivue/electron/worker.js`]
  LocalAPI[Optional Local Express Server\n`server.ts`]
  Release[Packaging\n`release/`]

  Main <--> Preload
  Preload <--> Renderer
  Renderer --> Workers
  Renderer -. HTTP fetch .-> LocalAPI
  Main --> Assets
  Renderer --> Assets
  ElectronApp --> Release
```

### Main Process Components

```mermaid
flowchart TB
  Logger[`Logger`\n`src/main/utils/Logger.ts`]
  Application[`Application`\n`src/main/core/Application.ts`]
  WindowManager[`WindowManager`\n`src/main/core/WindowManager.ts`]
  IPCManager[`IPCManager`\n`src/main/core/IPCManager.ts`]
  DataManager[`DataManager`\n`src/main/core/DataManager.ts`]
  FileManager[`FileManager`\n`src/main/core/FileManager.ts`]
  IpcHandlers[`IPC Handlers`\n`src/main/ipc/ipcHandlers.ts`]

  Application --> Logger
  Application --> WindowManager
  Application --> IPCManager
  Application --> DataManager
  Application --> FileManager
  IPCManager --> IpcHandlers
  WindowManager -->|creates| BrowserWindow
```

### IPC Bridge and Preload Exposure

```mermaid
sequenceDiagram
  participant Renderer as Renderer (React)
  participant Preload as Preload (contextBridge)
  participant Main as Main (ipcMain handlers)

  Renderer->>Preload: window.electron.ipcRenderer.sendMessage("channel", payload)
  Preload->>Main: ipcRenderer.send("channel", payload)
  Main-->>Renderer: event.reply/emit("channel-reply", result)

  Note over Preload: `src/main/preload.ts` exposes `ipcRenderer`, `invoke`, and helpers
```

### Example: Save Patients JSON Flow

```mermaid
sequenceDiagram
  participant UI as Renderer UI
  participant Pre as Preload
  participant IPC as ipcMain (save-patients-json)
  participant FS as File System

  UI->>Pre: sendMessage('save-patients-json', folderPath, patients)
  Pre->>IPC: ipcRenderer.send('save-patients-json', ...)
  IPC->>FS: fs.writeFile(participants.json, data)
  IPC-->>UI: 'json-saved' | 'json-save-error'
```

### Renderer Overview

```mermaid
flowchart TB
  subgraph React[React App]
    Pages[Pages\n`src/renderer/pages/App.tsx`, `Programmer.tsx`]
    Components[Components\nanalysis/*, electrode/*, patient/*, viewers/*]
    Contexts[Contexts\n`contexts/PatientContext.tsx`]
    Utils[Utils\n`utils/*.js` (ClinicalScores, OptimizeDatabase, NiftiUtils, etc.)]
  end

  Niivue[Niivue UI/Processing\n`src/renderer/niivue/**/*`]
  Workers[Workers\n`workers/slice-worker.js`, `niivue/electron/worker.js`]

  Pages --> Components
  Components --> Contexts
  Components --> Utils
  Components --> Niivue
  Niivue --> Workers
```

### Worker Usage

```mermaid
sequenceDiagram
  participant Comp as Renderer Component
  participant WW as Web Worker (slice-worker.js)
  Comp->>WW: postMessage({ coords, dims, axis, plane })
  WW-->>Comp: postMessage({ buffer })

  Note over WW: Emits zero-copy ArrayBuffer for slice image data
```

### Optional Local HTTP API Server

```mermaid
flowchart LR
  Renderer -- GET/POST /api/data --> Express[Express Server\n`server.ts`]
  Express --> Memory[(In-memory data)]
```

### Build and Packaging

```mermaid
flowchart TB
  subgraph Build
    WebpackMain[Webpack Main]
    WebpackRenderer[Webpack Renderer]
    Dll[Renderer DLL]
  end
  ElectronBuilder[Electron Builder]
  Artifacts[DMG/ZIP/App\n`release/build/**`]

  WebpackMain --> ElectronBuilder
  WebpackRenderer --> ElectronBuilder
  Dll --> ElectronBuilder
  ElectronBuilder --> Artifacts
```

### Key File References

- Main entry: `src/main/main.ts` and `src/main/core/Application.ts`
- Window creation: `src/main/core/WindowManager.ts`
- IPC registration: `src/main/core/IPCManager.ts`, `src/main/ipc/ipcHandlers.ts`
- Preload bridge: `src/main/preload.ts`
- Renderer entry: `src/renderer/index.tsx`, pages in `src/renderer/pages/*`
- Workers: `src/renderer/workers/slice-worker.js`, `src/renderer/niivue/electron/worker.js`
- Optional server: `server.ts`
- Assets/templates: `assets/`, `public/*.xlsx`
- Packaging outputs: `release/`


