const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const { devPorts } = require("./devPorts");
const { events } = require("./events");
const parseArgs = require("minimist");
const args = parseArgs(process.argv.slice(2), {
  boolean: ["dev"],
});

/**
 * the filters for the volume file dialog
 * @type {Array<Object>}
 * @property {string} name - The name of the filter.
 * @property {Array<string>} extensions - The extensions for the filter.
 */
const nvVolumeFilters = [
  {
    name: "Volume types",
    extensions: [
      "nii",
      "nii.gz",
      "mih",
      "mif",
      "nrrd",
      "nhdr",
      "mhd",
      "mha",
      "mgh",
      "mgz",
      "v",
      "v16",
      "vmr",
      "HEAD", // afni HEAD/BRIK
    ],
  },
];

/**
 * The filters for the surface file dialog.
 * @type {Array<Object>}
 * @property {string} name - The name of the filter.
 * @property {Array<string>} extensions - The extensions for the filter.
 */
const nvMeshFilters = [
  {
    name: "Surface types",
    extensions: [
      "gz",
      "jcon",
      "json",
      "tck",
      "trk",
      "trx",
      "tract",
      "gii",
      "mz3",
      "asc",
      "dfs",
      "byu",
      "geo",
      "ico",
      "off",
      "nv",
      "obj",
      "ply",
      "x3d",
      "fib",
      "vtk",
      "srf",
      "stl",
    ],
  },
];

/**
 * the main window object
 * @type {Electron.BrowserWindow}
 */
let mainWindow = {};

/**
 * the fileServer object (a forked process)
 * @type {ChildProcess}
 * @see https://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options
 */
// launch the fileServer as a background process
fileServer = fork(path.join(__dirname, "fileServer.js"), {
  env: { FORK: true },
});

/**
 * handles setting the process env variables for the fileServer port and host
 * @param {number} port - the port the fileServer is listening on
 * @returns {undefined}
 * @function
 */
function onFileServerPort(port) {
  process.env.NIIVUE_FILESERVER_PORT = port;
  process.env.NIIVUE_HOST = "localhost";
}

// handler function for the fileServer port message
/**
 * Handles messages from the fileServer.
 * @param {Object} message - The message object.
 * @param {string} message.type - The type of message.
 * @param {string} message.value - The value of the message.
 * @returns {undefined}
 * @function
 */
function handleFileServerMessage(message) {
  // msg is expected to be a JSON object (automatically serialized and deserialized by process.send and 'message')
  // a message object has a 'type' and a 'value' as properties
  if (message.type === "fileServerPort") {
    onFileServerPort(message.value);
  }
}

// register the handler function for fileServer messages
fileServer.on("message", (message) => {
  handleFileServerMessage(message);
});

/**
 * Determines if the application is running in development mode.
 * @returns {boolean} True if the application is running in development mode, false otherwise.
 */
function isDev() {
  // process is an array of the command line arguments
  // the first two are the path to the node executable and the path to the script being run
  // the third is the first argument passed to the app
  // if it's "--dev", we're in development mode
  return args["dev"]; //process.argv[2] === '--dev';
}

/**
 * Registers IPC listeners for the events object.
 * @returns {undefined}
 * @function
 * @see https://www.electronjs.org/docs/api/ipc-main
 */
function registerIpcListeners() {
  for (const [key, value] of Object.entries(events)) {
    /**
     * The handler function for the event.
     * @param {Electron.IpcMainInvokeEvent} event - The event object.
     * @param {object} obj - The object containing the event arguments.
     * @returns {Promise<any>} A promise that resolves to the result of the event handler.
     * @async
     * @function
     */
    async function handler(event, obj) {
      const result = await value(obj);
      return result;
    }
    ipcMain.handle(key, handler);
  }

  // register one off handlers
  ipcMain.handle("openAddMeshLayersFileDialog", openAddMeshLayersFileDialog);
}

/**
 * Creates a new browser window for the specified GUI.
 * @param {string} guiName - The name of the GUI to create a window for.
 */
function createWindow(guiName = "niivue") {
  // could eventually add a "settings" GUI name too
  // that would be a separate window for settings

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev()) {
    try {
      mainWindow.loadURL(`http://localhost:${devPorts[guiName]}`);
    } catch (err) {
      console.log(
        `Error loading ${guiName} at http://localhost:${devPorts[guiName]}`,
      );
      console.log(err);
    }
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    // load the index.html of the app
    mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));
  }
}

async function loadCliVolumes() {
  let cliImages = args._;
  if (cliImages.length > 0) {
    // wait for the main window to finish loading before sending the loadVolumes message
    // or else the message will be lost
    mainWindow.webContents.on("did-finish-load", async () => {
      // if passing in cliImages to openFileDialog, we don't actually show the
      // dialog, we just return the cliImages with the same object formatting as the dialog
      let result = await events.openFileDialog(
        (filters = nvVolumeFilters),
        (cliImages = cliImages),
      );
      mainWindow.webContents.send("loadVolumes", result.filePaths);
    });
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  // register event handlers
  registerIpcListeners();
  // create the main window
  createWindow();
  // load cli volumes
  loadCliVolumes();
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  // close the file server gracefully
  fileServer.kill();
  app.quit();
});

/**
 * Handles the load volumes menu click event.
 * @returns {string[]} The files selected by the user.
 * @async
 * @function
 * // opens a file dialog and returns the selected files
 * // also sends a loadVolumes message to the main window
 * // and updates the images menu
 * // if the user selects file1.nii.gz and file2.nii.gz
 * // the function returns ['file1.nii.gz', 'file2.nii.gz']
 * // and the images menu is updated with file1.nii.gz and file2.nii.gz
 * // and the main window receives a loadVolumes message with ['file1.nii.gz', 'file2.nii.gz']
 */
async function onLoadVolumesClick() {
  let files = await events.openFileDialog((filters = nvVolumeFilters));
  mainWindow.webContents.send("loadVolumes", files.filePaths);
}

async function onLoadMeshesClick() {
  let files = await events.openFileDialog((filters = nvMeshFilters));
  mainWindow.webContents.send("loadMeshes", files.filePaths);
}

async function openAddMeshLayersFileDialog() {
  let files = await events.openFileDialog((filters = nvMeshFilters));
  mainWindow.webContents.send("loadMeshLayers", files.filePaths);
}

async function onSaveBitmapClick() {
  /*let savePath = await  dialog.showSaveDialog({
    filters: [{
      name: 'Bitmap PNG',
      extensions: ['png']
    }]
  })
  if (savePath.canceled)
    return
  let str = 'nv.saveScene("' + savePath.filePath+ '")'
  console.log(str)
  mainWindow.webContents.send('setEvalStr', str);*/
  mainWindow.webContents.send("setEvalStr", 'nv.saveScene("ScreenShot.png")');
}

/**
 * Handles the load surfaces menu click event.
 * NOT IMPLEMENTED YET
 * @async
 * @function
 */
async function onLoadMeshesClick() {
  let files = await events.openFileDialog((filters = nvMeshFilters));
  mainWindow.webContents.send("loadMeshes", files.filePaths);
}

/**
 * Handles the add volume overlay menu click event.
 * NOT IMPLEMENTED YET
 * @async
 * @function
 */
async function onAddVolumeOverlayClick() {
  let files = await events.openFileDialog((filters = nvVolumeFilters));
  // send just the first file to the main window, since we only want to add one overlay at a time
  mainWindow.webContents.send("addVolumeOverlay", files.filePaths[0]);
}

// open a standard template image shipped with the app
async function openStandard(fileName) {
  let file = path.join(__dirname, "images", "standard", fileName);
  // get the absolute path to the file
  file = path.resolve(file);
  mainWindow.webContents.send("loadVolumes", [file]);
}

/**
 * Sets the canvas view to the specified view.
 * @param {string} view - The view to set the canvas to.
 * @async
 * @function
 */
async function onSetViewClick(view) {
  mainWindow.webContents.send("setView", view);
}

/**
 * Sets a canvas option
 * @param {string} opt - The boolean option to set.
 * @async
 * @function
 */
async function onSetVolOptClick(opt) {
  let val = Menu.getApplicationMenu().getMenuItemById(opt).checked;
  mainWindow.webContents.send("setOpt", [opt, val]);
}

/**
 * Opens settings dialog
 */
async function onSettingsClick() {
  console.log("open settings clicked");
  mainWindow.webContents.send("openSettings");
}

/**
 * Sets a canvas option
 * @param {string} opt - The option to set.
 * @param {number} numericScale - scaling factor for False (0) or True (1)
 * @async
 * @function
 */
async function onSetNumberOptClick(opt, numericScale = 1.0) {
  let val = Menu.getApplicationMenu().getMenuItemById(opt).checked;
  if (isFinite(numericScale)) {
    if (val === true) val = numericScale;
    else val = 0.0;
  }
  mainWindow.webContents.send("setOpt", [opt, val]);
}

async function onSetDrawPenClick(penColor = Infinity) {
  mainWindow.webContents.send("setDrawPen", penColor);
}

async function onPickColorClick() {
  mainWindow.webContents.send("pickColor");
}

async function onCheckClick(opt) {
  let val = Menu.getApplicationMenu().getMenuItemById(opt).checked;
  let str = "";
  if (opt === "drawFilled") str = "nv.opts.isFilledPen = " + val.toString();
  if (opt === "drawOverwrite")
    str = "nv.drawFillOverwrites = " + val.toString();
  if (opt === "drawTranslucent") {
    var f = val ? "0.8" : "1.0";
    str = "nv.drawOpacity = " + f + "; nv.drawScene()";
  }
  mainWindow.webContents.send("setEvalStr", str);
}

/**
 * Sets a NiiVue color option
 * @param {string} opt - The color option to change
 * @async
 * @function
 */
async function onSetColorOptClick(opt) {
  console.log("getting", opt);
  //https://github.com/electron/electron/issues/2473
  //https://www.npmjs.com/package/electron-color-picker/v/0.1.1?activeTab=readme
  let val = await mainWindow.webContents.send("getOpt", [opt]);
  console.log("ret", val);
  val = [0.0, 1.0, 0.0, 1.0];
  mainWindow.webContents.send("setOpt", [opt, val]);
}

// closes all volumes
// TODO: will need to add a similar function for meshes
async function onCloseAllVolumesClick() {
  mainWindow.webContents.send("closeAllVolumes");
}

// sends a message to save a mosaic string as a text file
async function onSaveMosaicStringClick() {
  mainWindow.webContents.send("saveMosaicString");
}

// sends a message to load a mosaic string from a text file
async function onLoadMosaicStringClick() {
  mainWindow.webContents.send("loadMosaicString");
}

// sends a message to load a document from a file
async function onLoadDocumentClick() {
  mainWindow.webContents.send("loadDocument");
}

// sends a message to save the document as a file
async function onSaveDocumentClick() {
  mainWindow.webContents.send("saveDocument");
}

// create an application menu
let menu = [
  // add file menu with load volumes option
  {
    label: "File",
    submenu: [
      // load volumes
      {
        label: "Load volumes",
        id: "loadVolumes",
        click: async () => {
          await onLoadVolumesClick();
        },
      },
      // load meshes
      {
        label: "Load meshes",
        id: "loadMeshes",
        click: async () => {
          await onLoadMeshesClick();
        },
      },
      // load mosaic string
      {
        label: "Load mosaic string",
        id: "loadMosaicString",
        click: async () => {
          await onLoadMosaicStringClick();
        },
      },
      {
        label: "Load document",
        id: "loadDocument",
        click: async () => {
          await onLoadDocumentClick();
        },
      },
      // close all volumes
      {
        label: "Close all images",
        id: "closeAllVolumes",
        click: async () => {
          await onCloseAllVolumesClick();
        },
      },

      { type: "separator" },
      {
        label: "Save bitmap",
        id: "saveBitmap",
        click: async () => {
          await onSaveBitmapClick();
        },
      },
      {
        label: "Save mosaic string",
        id: "saveMosaic",
        click: async () => {
          await onSaveMosaicStringClick();
        },
      },
      {
        label: "Save document",
        id: "saveDocument",
        click: async () => {
          await onSaveDocumentClick();
        },
      },
      // separator
      { type: "separator" },
      // add volume overlay
      // {
      //   label: 'Add volume overlay',
      //   id: 'addVolumeOverlay',
      //   click: async () => {
      //     await onAddVolumeOverlayClick();
      //   }
      // },
      // separator
      // { type: 'separator' },
      // open standard
      {
        label: "Open standard",
        id: "openStandard",
        submenu: [
          {
            label: "mni152",
            id: "mni152",
            click: async () => {
              await openStandard("mni152.nii.gz");
            },
          },
        ],
      },
      // add surface overlay
      // TODO: this should prob be a separate submenu on each surface item to add mesh overlays
      // {
      //   label: 'Add surface overlay',
      //   id: 'addSurfaceOverlay',
      //   click: async () => {
      //     await onAddSurfaceOverlayClick();
      //   }
      // },
    ],
  },
  // add view menu with view options
  {
    label: "View",
    submenu: [
      {
        label: "Render",
        id: "renderView",
        click: async () => {
          onSetViewClick("render");
        },
        type: "radio",
        // set accelerator to to option+r
        accelerator: "Option+R",
      },
      {
        label: "Axial",
        id: "axialView",
        click: async () => {
          onSetViewClick("axial");
        },
        type: "radio",
        accelerator: "Option+A",
      },
      {
        label: "Sagittal",
        id: "sagittalView",
        click: async () => {
          onSetViewClick("sagittal");
        },
        type: "radio",
        accelerator: "Option+S",
      },
      {
        label: "Coronal",
        id: "coronalView",
        click: async () => {
          onSetViewClick("coronal");
        },
        type: "radio",
        accelerator: "Option+C",
      },
      {
        label: "Multi-planar (A+C+S)",
        id: "multiPlanarViewACS",
        click: async () => {
          onSetViewClick("multiPlanarACS");
        },
        type: "radio",
        accelerator: "Option+M",
        checked: true,
      },
      {
        label: "Multi-planar (A+C+S+R)",
        id: "multiPlanarViewACSR",
        click: async () => {
          onSetViewClick("multiPlanarACSR");
        },
        type: "radio",
        accelerator: "Option+Shift+M",
      },
      // mosaic view requires user supplied strings
      // in the UI
      {
        label: "Mosaic",
        id: "mosaicView",
        click: async () => {
          onSetViewClick("mosaic");
        },
        type: "radio",
        accelerator: "Option+O",
      },
      { type: "separator" },
      {
        label: "Next frame",
        id: "nextFrame",
        click: async () => {
          mainWindow.webContents.send("setFrame", 1);
        },
        accelerator: "Right",
      },
      {
        label: "Previous frame",
        id: "previousFrame",
        click: async () => {
          mainWindow.webContents.send("setFrame", -1);
        },
        accelerator: "Left",
      },
      { type: "separator" },
      {
        label: "Rendering cube visible",
        id: "isOrientCube",
        click: async () => {
          onSetVolOptClick("isOrientCube");
        },
        type: "checkbox",
        checked: false,
      },

      {
        label: "Colorbar visible",
        id: "isColorbar",
        click: async () => {
          onSetVolOptClick("isColorbar");
        },
        type: "checkbox",
        checked: false,
      },
      // crosshair
      // {
      //   label: 'Crosshair visible',
      //   id: 'isCrosshair',
      //   click: async () => {
      //     onSetVolOptClick('isCrosshair');
      //   },
      //   type: 'checkbox',
      //   checked: true
      // },
      // 3D crosshair
      {
        label: "3D crosshair visible",
        id: "show3Dcrosshair",
        click: async () => {
          onSetVolOptClick("show3Dcrosshair");
        },
        type: "checkbox",
        checked: false,
      },
      // isCornerOrientationText
      {
        label: "Corner orientation text",
        id: "isCornerOrientationText",
        click: async () => {
          onSetVolOptClick("isCornerOrientationText");
        },
        type: "checkbox",
        checked: false,
      },
    ],
  },
  // add drag menu
  {
    label: "Drag",
    submenu: [
      {
        label: "Pan/zoom",
        id: "panzoom",
        click: () => {
          mainWindow.webContents.send("setDragMode", "pan");
        },
        type: "radio",
      },
      {
        label: "Measure",
        id: "measure",
        click: () => {
          mainWindow.webContents.send("setDragMode", "measure");
        },
        type: "radio",
      },
      {
        label: "Window/level", // contrast
        id: "windowlevel",
        click: () => {
          mainWindow.webContents.send("setDragMode", "contrast");
        },
        type: "radio",
        checked: true,
      },
      {
        label: "None",
        id: "none",
        click: () => {
          mainWindow.webContents.send("setDragMode", "none");
        },
        type: "radio",
      },
    ],
  },
  // add volume menu with options that influence volumes but not meshes
  {
    label: "Volume",
    submenu: [
      {
        label: "Nearest interpolation",
        id: "isNearestInterpolation",
        click: async () => {
          onSetVolOptClick("isNearestInterpolation");
        },
        type: "checkbox",
        checked: false,
      },
      {
        label: "Radiological convention",
        id: "isRadiologicalConvention",
        click: async () => {
          onSetVolOptClick("isRadiologicalConvention");
        },
        type: "checkbox",
        checked: false,
      },
      {
        label: "Sagittal nose left",
        id: "sagittalNoseLeft",
        click: async () => {
          onSetVolOptClick("sagittalNoseLeft");
        },
        type: "checkbox",
        checked: false,
      },
      {
        label: "World (not voxel) Space",
        id: "isSliceMM",
        click: async () => {
          onSetVolOptClick("isSliceMM");
        },
        type: "checkbox",
        checked: false,
      },
      //
      {
        label: "Ruler visible",
        id: "isRuler",
        click: async () => {
          onSetVolOptClick("isRuler");
        },
        type: "checkbox",
        checked: false,
      },
      {
        label: "Crosshair visible",
        id: "crosshairWidth",
        click: async () => {
          onSetNumberOptClick("crosshairWidth", 1.0);
        },
        type: "checkbox",
        checked: true,
      },
    ],
  },
  // add draw menu
  {
    label: "Draw",
    submenu: [
      {
        label: "Off",
        id: "drawOff",
        click: async () => {
          onSetDrawPenClick(Infinity);
        },
        type: "radio",
        checked: true,
      },
      {
        label: "Red",
        id: "drawRed",
        click: async () => {
          onSetDrawPenClick(1);
        },
        type: "radio",
      },
      {
        label: "Green",
        id: "drawGreen",
        click: async () => {
          onSetDrawPenClick(2);
        },
        type: "radio",
      },
      {
        label: "Blue",
        id: "drawBlue",
        click: async () => {
          onSetDrawPenClick(3);
        },
        type: "radio",
      },
      {
        label: "Yellow",
        id: "drawYellow",
        click: async () => {
          onSetDrawPenClick(4);
        },
        type: "radio",
      },
      {
        label: "Cyan",
        id: "drawCyan",
        click: async () => {
          onSetDrawPenClick(5);
        },
        type: "radio",
      },
      {
        label: "Purple",
        id: "drawPurple",
        click: async () => {
          onSetDrawPenClick(6);
        },
        type: "radio",
      },
      {
        label: "Erase",
        id: "drawErase",
        click: async () => {
          onSetDrawPenClick(0);
        },
        type: "radio",
      },
      { type: "separator" },
      {
        label: "Filled",
        id: "drawFilled",
        click: async () => {
          onCheckClick("drawFilled");
        },
        type: "checkbox",
        checked: false,
      },
      {
        label: "Overwrite",
        id: "drawOverwrite",
        click: async () => {
          onCheckClick("drawOverwrite");
        },
        type: "checkbox",
        checked: true,
      },
      {
        label: "Translucent",
        id: "drawTranslucent",
        click: async () => {
          onCheckClick("drawTranslucent");
        },
        type: "checkbox",
        checked: true,
      },
    ],
  },

  // add window menu with reload options
  {
    label: "Window",
    submenu: [
      {
        label: "Reload",
        accelerator: "CmdOrCtrl+R",
        click: () => {
          BrowserWindow.getFocusedWindow().reload();
        },
      },
      {
        label: "Toggle DevTools",
        accelerator: "CmdOrCtrl+Shift+I",
        click: () => {
          BrowserWindow.getFocusedWindow().toggleDevTools();
        },
      },
    ],
  },
  // add help menu with link to github issues
  {
    label: "Help",
    submenu: [
      {
        label: "Report issue",
        click: async () => {
          const { shell } = require("electron");
          await shell.openExternal(
            "https://github.com/niivue/desktop/issues/new/choose",
          );
        },
      },
    ],
  },
];
// Add macOS application menus
if (process.platform === "darwin") {
  menu.unshift({
    label: app.name,
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "services", submenu: [] },
      { type: "separator" },
      { role: "hide" },
      { role: "hideothers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ],
  });
}

Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
