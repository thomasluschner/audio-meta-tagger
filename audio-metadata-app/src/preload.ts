import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  selectAudioFiles: () => Promise<any[]>;
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<boolean>;
  searchMetadata: (fileName: string) => Promise<any[]>;
  applyMetadata: (filePath: string, metadata: any) => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
}

const electronAPI: ElectronAPI = {
  selectAudioFiles: () => ipcRenderer.invoke('select-audio-files'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  searchMetadata: (fileName) => ipcRenderer.invoke('search-metadata', fileName),
  applyMetadata: (filePath, metadata) => ipcRenderer.invoke('apply-metadata', filePath, metadata),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);