// require fs and path
const fs = require("fs");
const path = require("path");
const util = require("util"); // node.js utility module for promisify

/**
 * gets the file server port and host from the environment variables
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the file server port and host.
 */
async function onGetCommsInfo() {
  let fileServerPort = process.env.NIIVUE_FILESERVER_PORT;
  let host = process.env.NIIVUE_HOST;
  let route = "file";
  let queryKey = "filename";
  return { fileServerPort, host, route, queryKey };
}

/**
 * Handles the openFileDialog command.
 * @async
 * @function
 * @param {Array} filters - An array of objects with name and extensions properties.
 * @see https://www.electronjs.org/docs/latest/api/dialog#dialogshowopendialogbrowserwindow-options
 * @returns {Promise<Object>} A promise that resolves to an object with, cancelled, filePaths, and bookmarks properties.
 */
async function onFileDialog(filters = [], cliImages = []) {
  let result = [];
  if (cliImages.length === 0) {
    const { dialog } = require("electron");
    result = await dialog.showOpenDialog({
      filters: filters,
      properties: ["openFile", "multiSelections"],
    });
  } else {
    result = { canceled: false, filePaths: cliImages };
  }
  return result;
}

/**
 * Handles the openSaveFileDialog command.
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object with, cancelled, filePaths, and bookmarks properties.
 */
async function onSaveFileDialog(defaultPath) {
  const { dialog } = require("electron");
  const result = await dialog.showSaveDialog({
    defaultPath,
    properties: ["createDirectory", "showOverwriteConfirmation"],
  });
  console.log(result);
  return result;
}

/**
 * Handles the openSaveMosaicFileDialog command.
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object with, cancelled, filePaths, and bookmarks properties.
 */
async function onSaveMosaicFileDialog() {
  const { dialog } = require("electron");
  const result = await dialog.showSaveDialog({
    defaultPath: "mosaic.txt",
    filters: ["*.txt"],
    properties: ["createDirectory", "showOverwriteConfirmation"],
  });
  console.log(result);
  return result;
}

/**
 * Handles the openLoadMosaicFileDialog command.
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object with, cancelled, filePaths, and bookmarks properties.
 */
async function onLoadMosaicFileDialog() {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog({
    defaultPath: "mosaic.txt",
    filters: ["*.txt"],
  });
  console.log(result);
  return result;
}

/**
 * Handles the saveTextFile command.
 */
function onSaveTextFile(textFile) {
  console.log("trying to save " + textFile.text + " to " + textFile.filePath);
  try {
    fs.writeFileSync(textFile.filePath, textFile.text, "utf-8");
    console.log("saved ", textFile.filePath);
  } catch (e) {
    console.log("Failed to save the file !", e);
  }
}

/** Handles the load text file */
function onLoadTextFile(textFilePath) {
  try {
    const text = fs.readFileSync(textFilePath, "utf8");
    console.log(text);
    return text;
  } catch (e) {
    console.log("Failed to load the file !", e);
  }
}

const events = {
  openFileDialog: onFileDialog,
  openSaveFileDialog: onSaveFileDialog,
  getCommsInfo: onGetCommsInfo,
  openSaveMosaicFileDialog: onSaveMosaicFileDialog,
  saveTextFile: onSaveTextFile,
  loadTextFile: onLoadTextFile,
  openLoadMosaicFileDialog: onLoadMosaicFileDialog,
};

module.exports.events = events;
