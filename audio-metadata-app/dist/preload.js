"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    selectAudioFiles: () => electron_1.ipcRenderer.invoke('select-audio-files'),
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-settings', settings),
    searchMetadata: (fileName) => electron_1.ipcRenderer.invoke('search-metadata', fileName),
    applyMetadata: (filePath, metadata) => electron_1.ipcRenderer.invoke('apply-metadata', filePath, metadata),
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
//# sourceMappingURL=preload.js.map