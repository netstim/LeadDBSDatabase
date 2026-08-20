// Try to get the NIIVUE object from the window object.
// If it doesn't exist, create it.
/**
 * The NIIVUE namespace object. This is the object that is exposed to the renderer process via the context bridge in the preload script from electron.
 * @namespace
 */
const NIIVUE = window.NIIVUE || {};

/**
 * The main NIIVUEJS namespace object.
 * @namespace
 */
export const nvUtils = {};

/**
 * Determines if the given value is a function.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a function, false otherwise.
 */
function isFunction(value) {
  return typeof value === "function";
}

/**
 * opens a file dialog in the main process
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the file path and the file name.
 */
nvUtils.openFileDialog = async function () {
  if (isFunction(NIIVUE.openFileDialog)) {
    return await NIIVUE.openFileDialog();
  } else {
    return NIIVUE.openFileDialog;
  }
};

/**
 * opens a save file dialog in the main process
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the file path and the file name.
 */
nvUtils.openSaveFileDialog = async function (defaultPath) {
  if (isFunction(NIIVUE.openSaveFileDialog)) {
    return await NIIVUE.openSaveFileDialog(defaultPath);
  } else {
    return NIIVUE.openSaveFileDialog;
  }
};

/**
 * opens a save file dialog in the main process with mosaic.txt as default file name
 * and .txt file filter
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the file path and the file name.
 */
nvUtils.openSaveMosaicFileDialog = async function (defaultPath) {
  if (isFunction(NIIVUE.openSaveMosaicFileDialog)) {
    return await NIIVUE.openSaveMosaicFileDialog(defaultPath);
  } else {
    return NIIVUE.openSaveMosaicFileDialog;
  }
};

nvUtils.onSaveMosaicString = function (callback) {
  if (isFunction(NIIVUE.onSaveMosaicString)) {
    NIIVUE.onSaveMosaicString(callback);
  }
};

nvUtils.saveTextFile = function (filePath, text) {
  console.log("saveTextFile", text);
  NIIVUE.saveTextFile({ filePath, text });
};

/**
 * opens a save file dialog in the main process with mosaic.txt as default file name
 * and .txt file filter
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the file path and the file name.
 */
nvUtils.openLoadMosaicFileDialog = async function () {
  if (isFunction(NIIVUE.openLoadMosaicFileDialog)) {
    return await NIIVUE.openLoadMosaicFileDialog();
  } else {
    return NIIVUE.openLoadMosaicFileDialog;
  }
};

nvUtils.onLoadMosaicString = function (callback) {
  if (isFunction(NIIVUE.onLoadMosaicString)) {
    NIIVUE.onLoadMosaicString(callback);
  }
};

nvUtils.loadTextFile = async function (textFilePath) {
  console.log("loadTextFile");
  return await NIIVUE.loadTextFile(textFilePath);
};

nvUtils.onLoadDocument = function (callback) {
  if (isFunction(NIIVUE.onLoadDocument)) {
    NIIVUE.onLoadDocument(callback);
  }
};

nvUtils.onSaveDocument = function (callback) {
  if (isFunction(NIIVUE.onSaveDocument)) {
    NIIVUE.onSaveDocument(callback);
  }
};

nvUtils.openMeshLayersFileDialog = async function () {
  if (isFunction(NIIVUE.openMeshLayersFileDialog)) {
    return await NIIVUE.openMeshLayersFileDialog();
  } else {
    return NIIVUE.openMeshLayersFileDialog;
  }
};

/**
 * removes the extension from a string
 * @function
 * @param {string} str - The string to remove the extension from.
 * @param {string} ext - The extension to remove.
 * @returns {string} The string with the extension removed.
 * @example
 * const str = 'test.nii.gz';
 * const strWithoutExt = niivuejs.removeExtension(str);
 * console.log(strWithoutExt);
 */
nvUtils.removeExtension = function (str, ext = ".nii") {
  let arr = str.split(ext);
  arr.pop();
  return arr.join("");
};

/**
 * gets the comms info from the main process
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the comms info.
 * @example
 * const commsInfo = await niivuejs.getCommsInfo();
 * console.log(commsInfo);
 * // { fileServerPort: 12345, host: 'localhost' }
 */
nvUtils.getCommsInfo = async function () {
  if (isFunction(NIIVUE.getCommsInfo)) {
    return await NIIVUE.getCommsInfo();
  } else {
    return NIIVUE.getCommsInfo;
  }
};

nvUtils.onLoadVolumes = function (callback) {
  if (isFunction(NIIVUE.onLoadVolumes)) {
    NIIVUE.onLoadVolumes(callback);
  }
};

nvUtils.onLoadMeshes = function (callback) {
  console.log("onload meshes callback called");
  if (isFunction(NIIVUE.onLoadMeshes)) {
    console.log("callback defined");
    NIIVUE.onLoadMeshes(callback);
  } else {
    console.log("callback not defined");
  }
};

nvUtils.onLoadMeshLayers = function (callback) {
  console.log("onload meshe layers callback called");
  if (isFunction(NIIVUE.onLoadMeshLayers)) {
    console.log("callback defined");
    NIIVUE.onLoadMeshLayers(callback);
  } else {
    console.log("callback not defined");
  }
};

nvUtils.onAddVolumeOverlay = function (callback) {
  if (isFunction(NIIVUE.onAddVolumeOverlay)) {
    NIIVUE.onAddVolumeOverlay(callback);
  }
};

nvUtils.onSetView = function (callback) {
  if (isFunction(NIIVUE.onSetView)) {
    NIIVUE.onSetView(callback);
  }
};

nvUtils.onSetOpt = function (callback) {
  if (isFunction(NIIVUE.onSetOpt)) {
    NIIVUE.onSetOpt(callback);
  }
};

nvUtils.onSetDrawPen = function (callback) {
  if (isFunction(NIIVUE.onSetDrawPen)) {
    NIIVUE.onSetDrawPen(callback);
  }
};

nvUtils.onSetEvalStr = function (callback) {
  if (isFunction(NIIVUE.onSetEvalStr)) {
    NIIVUE.onSetEvalStr(callback);
  }
};

nvUtils.onGetOpt = function (callback) {
  if (isFunction(NIIVUE.onGetOpt)) {
    return NIIVUE.onGetOpt(callback);
  }
  return false;
};

nvUtils.onCloseAllVolumes = function (callback) {
  if (isFunction(NIIVUE.onCloseAllVolumes)) {
    NIIVUE.onCloseAllVolumes(callback);
  }
};

nvUtils.onSetDragMode = function (callback) {
  if (isFunction(NIIVUE.onSetDragMode)) {
    NIIVUE.onSetDragMode(callback);
  }
};

nvUtils.onSetFrame = function (callback) {
  if (isFunction(NIIVUE.onSetFrame)) {
    NIIVUE.onSetFrame(callback);
  }
};

nvUtils.onSetColormaps = function (callback) {
  if (isFunction(NIIVUE.onSetColormaps)) {
    NIIVUE.onSetColormaps(callback);
  }
};

nvUtils.webGL2Supported = function () {
  let canvas = document.createElement("canvas");
  let gl = canvas.getContext("webgl2");
  let supported = gl !== null;
  // remove the temporary canvas from the DOM
  canvas.remove();
  return supported;
};

nvUtils.onSetViewSelected = function (view, forceRender = false, mosaic = "") {
  console.log("nvutils set view selected");
  if (isFunction(NIIVUE.onSetViewSelected)) {
    NIIVUE.onSetViewSelected(view, forceRender, mosaic);
  }
};

nvUtils.openSettings = function (callback) {
  console.log("open settings nvUtils");
  if (isFunction(NIIVUE.openSettings)) {
    NIIVUE.openSettings(callback);
  }
};
