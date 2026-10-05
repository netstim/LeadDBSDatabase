(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else {
		var a = factory();
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(global, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "electron":
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("electron");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
/*!*****************************!*\
  !*** ./src/main/preload.ts ***!
  \*****************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var electron__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! electron */ "electron");
/* harmony import */ var electron__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(electron__WEBPACK_IMPORTED_MODULE_0__);
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

const electronHandler = {
    ipcRenderer: {
        sendMessage(channel, ...args) {
            electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.send(channel, ...args);
        },
        on(channel, func) {
            const subscription = (_event, ...args) => func(...args);
            electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.on(channel, subscription);
            return () => {
                electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.removeListener(channel, subscription);
            };
        },
        once(channel, func) {
            electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.once(channel, (_event, ...args) => func(...args));
        },
        invoke: (channel, ...args) => electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke(channel, ...args), // Add invoke method with proper typing
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
        setZoomLevel(level) {
            electron__WEBPACK_IMPORTED_MODULE_0__.webFrame.setZoomLevel(level);
            // ipcRenderer.send('zoom-level-changed', level);
            electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.on('zoom-level-changed', (event, zoomLevel) => {
                electron__WEBPACK_IMPORTED_MODULE_0__.webFrame.setZoomLevel(zoomLevel);
            });
        },
    },
    selectFolder: () => {
        electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.send('select-folder'); // Send message to trigger folder selection
    },
    getClinicalScores: () => {
        return electron__WEBPACK_IMPORTED_MODULE_0__.ipcRenderer.invoke('get-clinical-scores-types');
    },
};
electron__WEBPACK_IMPORTED_MODULE_0__.contextBridge.exposeInMainWorld('electron', electronHandler);

/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM3QixpREFBaUQ7WUFDakQsaURBQVcsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEVBQUU7Z0JBQ3hELDhDQUFRLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ25DLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGO0lBQ0QsWUFBWSxFQUFFLEdBQUcsRUFBRTtRQUNqQixpREFBVyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLDJDQUEyQztJQUNoRixDQUFDO0lBQ0QsaUJBQWlCLEVBQUUsR0FBRyxFQUFFO1FBQ3RCLE9BQU8saURBQVcsQ0FBQyxNQUFNLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUN6RCxDQUFDO0NBQ0YsQ0FBQztBQUVGLG1EQUFhLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLGVBQWUsQ0FBQyxDQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vTGVhZERCU1Byb2dyYW1tZXIvd2VicGFjay91bml2ZXJzYWxNb2R1bGVEZWZpbml0aW9uIiwid2VicGFjazovL0xlYWREQlNQcm9ncmFtbWVyL2V4dGVybmFsIG5vZGUtY29tbW9uanMgXCJlbGVjdHJvblwiIiwid2VicGFjazovL0xlYWREQlNQcm9ncmFtbWVyL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL0xlYWREQlNQcm9ncmFtbWVyL3dlYnBhY2svcnVudGltZS9jb21wYXQgZ2V0IGRlZmF1bHQgZXhwb3J0Iiwid2VicGFjazovL0xlYWREQlNQcm9ncmFtbWVyL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9MZWFkREJTUHJvZ3JhbW1lci93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL0xlYWREQlNQcm9ncmFtbWVyL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vTGVhZERCU1Byb2dyYW1tZXIvLi9zcmMvbWFpbi9wcmVsb2FkLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiB3ZWJwYWNrVW5pdmVyc2FsTW9kdWxlRGVmaW5pdGlvbihyb290LCBmYWN0b3J5KSB7XG5cdGlmKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0Jylcblx0XHRtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcblx0ZWxzZSBpZih0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpXG5cdFx0ZGVmaW5lKFtdLCBmYWN0b3J5KTtcblx0ZWxzZSB7XG5cdFx0dmFyIGEgPSBmYWN0b3J5KCk7XG5cdFx0Zm9yKHZhciBpIGluIGEpICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgPyBleHBvcnRzIDogcm9vdClbaV0gPSBhW2ldO1xuXHR9XG59KShnbG9iYWwsICgpID0+IHtcbnJldHVybiAiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJlbGVjdHJvblwiKTsiLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbl9fd2VicGFja19yZXF1aXJlX18ubiA9IChtb2R1bGUpID0+IHtcblx0dmFyIGdldHRlciA9IG1vZHVsZSAmJiBtb2R1bGUuX19lc01vZHVsZSA/XG5cdFx0KCkgPT4gKG1vZHVsZVsnZGVmYXVsdCddKSA6XG5cdFx0KCkgPT4gKG1vZHVsZSk7XG5cdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsIHsgYTogZ2V0dGVyIH0pO1xuXHRyZXR1cm4gZ2V0dGVyO1xufTsiLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiLy8gaW1wb3J0IHsgY29udGV4dEJyaWRnZSwgaXBjUmVuZGVyZXIsIElwY1JlbmRlcmVyRXZlbnQsIHdlYkZyYW1lIH0gZnJvbSAnZWxlY3Ryb24nO1xuXG4vLyBleHBvcnQgdHlwZSBDaGFubmVscyA9ICdpcGMtZXhhbXBsZSc7XG5cbi8vIGNvbnN0IGVsZWN0cm9uSGFuZGxlciA9IHtcbi8vICAgaXBjUmVuZGVyZXI6IHtcbi8vICAgICBzZW5kTWVzc2FnZShjaGFubmVsOiBDaGFubmVscywgLi4uYXJnczogdW5rbm93bltdKSB7XG4vLyAgICAgICBpcGNSZW5kZXJlci5zZW5kKGNoYW5uZWwsIC4uLmFyZ3MpO1xuLy8gICAgIH0sXG4vLyAgICAgb24oY2hhbm5lbDogQ2hhbm5lbHMsIGZ1bmM6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpIHtcbi8vICAgICAgIGNvbnN0IHN1YnNjcmlwdGlvbiA9IChfZXZlbnQ6IElwY1JlbmRlcmVyRXZlbnQsIC4uLmFyZ3M6IHVua25vd25bXSkgPT5cbi8vICAgICAgICAgZnVuYyguLi5hcmdzKTtcbi8vICAgICAgIGlwY1JlbmRlcmVyLm9uKGNoYW5uZWwsIHN1YnNjcmlwdGlvbik7XG5cbi8vICAgICAgIHJldHVybiAoKSA9PiB7XG4vLyAgICAgICAgIGlwY1JlbmRlcmVyLnJlbW92ZUxpc3RlbmVyKGNoYW5uZWwsIHN1YnNjcmlwdGlvbik7XG4vLyAgICAgICB9O1xuLy8gICAgIH0sXG4vLyAgICAgb25jZShjaGFubmVsOiBDaGFubmVscywgZnVuYzogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCkge1xuLy8gICAgICAgaXBjUmVuZGVyZXIub25jZShjaGFubmVsLCAoX2V2ZW50LCAuLi5hcmdzKSA9PiBmdW5jKC4uLmFyZ3MpKTtcbi8vICAgICB9LFxuLy8gICB9LFxuLy8gfTtcblxuLy8gY29udGV4dEJyaWRnZS5leHBvc2VJbk1haW5Xb3JsZCgnZWxlY3Ryb24nLCBlbGVjdHJvbkhhbmRsZXIpO1xuXG4vLyBleHBvcnQgdHlwZSBFbGVjdHJvbkhhbmRsZXIgPSB0eXBlb2YgZWxlY3Ryb25IYW5kbGVyO1xuXG4vLyBEaXNhYmxlIG5vLXVudXNlZC12YXJzLCBicm9rZW4gZm9yIHNwcmVhZCBhcmdzXG4vKiBlc2xpbnQgbm8tdW51c2VkLXZhcnM6IG9mZiAqL1xuaW1wb3J0IHtcbiAgY29udGV4dEJyaWRnZSxcbiAgaXBjUmVuZGVyZXIsXG4gIElwY1JlbmRlcmVyRXZlbnQsXG4gIHdlYkZyYW1lLFxufSBmcm9tICdlbGVjdHJvbic7XG5cbmV4cG9ydCB0eXBlIENoYW5uZWxzID0gc3RyaW5nOyAvLyBBbGxvdyBhbnkgY2hhbm5lbCBuYW1lIGZvciBmbGV4aWJpbGl0eVxuXG5jb25zdCBlbGVjdHJvbkhhbmRsZXIgPSB7XG4gIGlwY1JlbmRlcmVyOiB7XG4gICAgc2VuZE1lc3NhZ2UoY2hhbm5lbDogQ2hhbm5lbHMsIC4uLmFyZ3M6IHVua25vd25bXSkge1xuICAgICAgaXBjUmVuZGVyZXIuc2VuZChjaGFubmVsLCAuLi5hcmdzKTtcbiAgICB9LFxuICAgIG9uKGNoYW5uZWw6IENoYW5uZWxzLCBmdW5jOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkKSB7XG4gICAgICBjb25zdCBzdWJzY3JpcHRpb24gPSAoX2V2ZW50OiBJcGNSZW5kZXJlckV2ZW50LCAuLi5hcmdzOiB1bmtub3duW10pID0+XG4gICAgICAgIGZ1bmMoLi4uYXJncyk7XG4gICAgICBpcGNSZW5kZXJlci5vbihjaGFubmVsLCBzdWJzY3JpcHRpb24pO1xuXG4gICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBpcGNSZW5kZXJlci5yZW1vdmVMaXN0ZW5lcihjaGFubmVsLCBzdWJzY3JpcHRpb24pO1xuICAgICAgfTtcbiAgICB9LFxuICAgIG9uY2UoY2hhbm5lbDogQ2hhbm5lbHMsIGZ1bmM6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpIHtcbiAgICAgIGlwY1JlbmRlcmVyLm9uY2UoY2hhbm5lbCwgKF9ldmVudCwgLi4uYXJncykgPT4gZnVuYyguLi5hcmdzKSk7XG4gICAgfSxcbiAgICBpbnZva2U6IChjaGFubmVsOiBzdHJpbmcsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKGNoYW5uZWwsIC4uLmFyZ3MpLCAvLyBBZGQgaW52b2tlIG1ldGhvZCB3aXRoIHByb3BlciB0eXBpbmdcbiAgfSxcbiAgLy8gem9vbToge1xuICAvLyAgIHpvb21JbigpIHtcbiAgLy8gICAgIHdlYkZyYW1lLnNldFpvb21MZXZlbCh3ZWJGcmFtZS5nZXRab29tTGV2ZWwoKSArIDEpO1xuICAvLyAgIH0sXG4gIC8vICAgem9vbU91dCgpIHtcbiAgLy8gICAgIHdlYkZyYW1lLnNldFpvb21MZXZlbCh3ZWJGcmFtZS5nZXRab29tTGV2ZWwoKSAtIDEpO1xuICAvLyAgIH0sXG4gIC8vICAgcmVzZXRab29tKCkge1xuICAvLyAgICAgd2ViRnJhbWUuc2V0Wm9vbUxldmVsKDApO1xuICAvLyAgIH0sXG4gIC8vIH0sXG4gIC8vIHpvb206IHtcbiAgLy8gICB6b29tSW4oKSB7XG4gIC8vICAgICBjb25zdCBuZXdab29tTGV2ZWwgPSB3ZWJGcmFtZS5nZXRab29tTGV2ZWwoKSArIDE7XG4gIC8vICAgICB3ZWJGcmFtZS5zZXRab29tTGV2ZWwobmV3Wm9vbUxldmVsKTtcbiAgLy8gICAgIGlwY1JlbmRlcmVyLnNlbmQoJ3pvb20tbGV2ZWwtY2hhbmdlZCcsIG5ld1pvb21MZXZlbCk7XG4gIC8vICAgfSxcbiAgLy8gICB6b29tT3V0KCkge1xuICAvLyAgICAgY29uc3QgbmV3Wm9vbUxldmVsID0gd2ViRnJhbWUuZ2V0Wm9vbUxldmVsKCkgLSAxO1xuICAvLyAgICAgd2ViRnJhbWUuc2V0Wm9vbUxldmVsKG5ld1pvb21MZXZlbCk7XG4gIC8vICAgICBpcGNSZW5kZXJlci5zZW5kKCd6b29tLWxldmVsLWNoYW5nZWQnLCBuZXdab29tTGV2ZWwpO1xuICAvLyAgIH0sXG4gIC8vICAgcmVzZXRab29tKCkge1xuICAvLyAgICAgY29uc3QgbmV3Wm9vbUxldmVsID0gMDtcbiAgLy8gICAgIHdlYkZyYW1lLnNldFpvb21MZXZlbChuZXdab29tTGV2ZWwpO1xuICAvLyAgICAgaXBjUmVuZGVyZXIuc2VuZCgnem9vbS1sZXZlbC1jaGFuZ2VkJywgbmV3Wm9vbUxldmVsKTtcbiAgLy8gICB9LFxuICAvLyB9LFxuICB6b29tOiB7XG4gICAgc2V0Wm9vbUxldmVsKGxldmVsOiBhbnkpIHtcbiAgICAgIHdlYkZyYW1lLnNldFpvb21MZXZlbChsZXZlbCk7XG4gICAgICAvLyBpcGNSZW5kZXJlci5zZW5kKCd6b29tLWxldmVsLWNoYW5nZWQnLCBsZXZlbCk7XG4gICAgICBpcGNSZW5kZXJlci5vbignem9vbS1sZXZlbC1jaGFuZ2VkJywgKGV2ZW50LCB6b29tTGV2ZWwpID0+IHtcbiAgICAgICAgd2ViRnJhbWUuc2V0Wm9vbUxldmVsKHpvb21MZXZlbCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9LFxuICBzZWxlY3RGb2xkZXI6ICgpID0+IHtcbiAgICBpcGNSZW5kZXJlci5zZW5kKCdzZWxlY3QtZm9sZGVyJyk7IC8vIFNlbmQgbWVzc2FnZSB0byB0cmlnZ2VyIGZvbGRlciBzZWxlY3Rpb25cbiAgfSxcbiAgZ2V0Q2xpbmljYWxTY29yZXM6ICgpID0+IHtcbiAgICByZXR1cm4gaXBjUmVuZGVyZXIuaW52b2tlKCdnZXQtY2xpbmljYWwtc2NvcmVzLXR5cGVzJyk7XG4gIH0sXG59O1xuXG5jb250ZXh0QnJpZGdlLmV4cG9zZUluTWFpbldvcmxkKCdlbGVjdHJvbicsIGVsZWN0cm9uSGFuZGxlcik7XG5cbmV4cG9ydCB0eXBlIEVsZWN0cm9uSGFuZGxlciA9IHR5cGVvZiBlbGVjdHJvbkhhbmRsZXI7XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=