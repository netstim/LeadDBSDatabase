// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("NIIVUE", {
  nodeVersion: () => process.versions.node,
  chromeVersion: () => process.versions.chrome,
  electronVersion: () => process.versions.electron,
  openFileDialog: openFileDialog,
  openSaveFileDialog: openSaveFileDialog,
  getCommsInfo: getCommsInfo,
  onLoadVolumes: onLoadVolumes,
  onLoadMeshes: onLoadMeshes,
  onAddVolumeOverlay: onAddVolumeOverlay,
  onSetView: onSetView,
  onSetOpt: onSetOpt,
  onSetDrawPen: onSetDrawPen,
  onSetEvalStr: onSetEvalStr,
  onGetOpt: onGetOpt,
  onSetFrame: onSetFrame,
  onSetColormaps: onSetColormaps,
  onSetDragMode: onSetDragMode,
  onSetViewSelected: onSetViewSelected,
  onCloseAllVolumes: onCloseAllVolumes,
  onSaveMosaicString: onSaveMosaicString,
  openSaveMosaicFileDialog: openSaveMosaicFileDialog,
  saveTextFile: saveTextFile,
  onLoadMosaicString: onLoadMosaicString,
  loadTextFile: loadTextFile,
  openLoadMosaicFileDialog: openLoadMosaicFileDialog,
  onLoadDocument: onLoadDocument,
  onSaveDocument: onSaveDocument,
  openMeshLayersFileDialog: openAddMeshLayersFileDialog,
  onLoadMeshLayers: onLoadMeshLayers,
  openSettings: openSettings,
});

async function onLoadVolumes(callback) {
  ipcRenderer.on("loadVolumes", (event, volumes) => {
    console.log(volumes);
    callback(volumes);
  });
}

async function onLoadMeshes(callback) {
  ipcRenderer.on("loadMeshes", (event, meshes) => {
    console.log(meshes);
    callback(meshes);
  });
}

async function onLoadMeshLayers(callback) {
  ipcRenderer.on("loadMeshLayers", (event, meshLayers) => {
    console.log(meshLayers);
    callback(meshLayers);
  });
}

async function onAddVolumeOverlay(callback) {
  ipcRenderer.on("addVolumeOverlay", (event, overlay) => {
    console.log(overlay);
    callback(overlay);
  });
}

async function onSetView(callback) {
  ipcRenderer.on("setView", (event, view) => {
    console.log(view);
    callback(view);
  });
}

async function onSetOpt(callback) {
  ipcRenderer.on("setOpt", (event, view) => {
    console.log("preload setOpt", view);
    callback(view);
  });
}

async function onSetDrawPen(callback) {
  ipcRenderer.on("setDrawPen", (event, view) => {
    console.log("preload setDrawPen", view);
    callback(view);
  });
}

async function onSetEvalStr(callback) {
  ipcRenderer.on("setEvalStr", (event, view) => {
    console.log("preload setEvalStr", view);
    callback(view);
  });
}

async function onGetOpt(callback) {
  ipcRenderer.on("getOpt", (event, view) => {
    console.log("preload getOpt", view);
    callback(view);
    return false;
  });
}

async function onCloseAllVolumes(callback) {
  ipcRenderer.on("closeAllVolumes", () => {
    callback();
  });
}

async function onSetViewSelected(view) {
  return ipcRenderer.invoke("setViewRadioButton", view);
}

async function onSetFrame(callback) {
  // frame is 1 or -1 for next or previous frame
  ipcRenderer.on("setFrame", (event, frame) => {
    console.log(frame);
    callback(frame);
  });
}

function onSetDragMode(callback) {
  ipcRenderer.on("setDragMode", (event, dragMode) => {
    console.log(dragMode);
    callback(dragMode);
  });
}

/**
 * get the comms info object from the main process
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the comms info.
 */
async function getCommsInfo() {
  return ipcRenderer.invoke("getCommsInfo");
}

async function onSetColormaps(callback) {
  // colormapObj has the keys: name, colormap
  ipcRenderer.on("setColormaps", (event, colormapObj) => {
    console.log(colormapObj);
    callback(colormapObj);
  });
}

async function openSettings(callback) {
  console.log("open settings sent to renderer");
  ipcRenderer.on("openSettings", (event) => {
    callback();
  });
}

/**
 * opens a file dialog in the main process
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the file path and the file name.
 */
async function openFileDialog() {
  return ipcRenderer.invoke("openFileDialog");
}

/**
 * opens a save file dialog in the main process
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the file path and the file name.
 */
async function openSaveFileDialog(defaultPath) {
  return ipcRenderer.invoke("openSaveFileDialog", defaultPath);
}

function onSaveMosaicString(callback) {
  ipcRenderer.on("saveMosaicString", () => {
    callback();
  });
}

async function openSaveMosaicFileDialog() {
  return ipcRenderer.invoke("openSaveMosaicFileDialog");
}

function saveTextFile(fileText) {
  return ipcRenderer.invoke("saveTextFile", fileText);
}

async function openLoadMosaicFileDialog() {
  return ipcRenderer.invoke("openLoadMosaicFileDialog");
}

function onLoadMosaicString(callback) {
  ipcRenderer.on("loadMosaicString", () => {
    callback();
  });
}

function onLoadDocument(callback) {
  ipcRenderer.on("loadDocument", () => {
    callback();
  });
}

function loadTextFile(textFilePath) {
  return ipcRenderer.invoke("loadTextFile", textFilePath);
}

function onSaveDocument(callback) {
  ipcRenderer.on("saveDocument", () => {
    callback();
  });
}

async function openAddMeshLayersFileDialog() {
  return ipcRenderer.invoke("openAddMeshLayersFileDialog");
}
