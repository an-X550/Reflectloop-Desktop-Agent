import { contextBridge, ipcRenderer } from 'electron';
import type { ZhijiDesktopApi } from './shared/contracts/desktop-api';

const api: ZhijiDesktopApi = {
  journals: {
    save: (input) => ipcRenderer.invoke('journals:save', input),
    list: (query = {}) => ipcRenderer.invoke('journals:list', query),
    get: (id) => ipcRenderer.invoke('journals:get', id),
  },
  projects: {
    create: (input) => ipcRenderer.invoke('projects:create', input),
    list: () => ipcRenderer.invoke('projects:list'),
    archive: (id) => ipcRenderer.invoke('projects:archive', id),
  },
  settings: {
    getPublicConfig: () => ipcRenderer.invoke('settings:get'),
    save: (input) => ipcRenderer.invoke('settings:save', input),
    testConnection: (input) => ipcRenderer.invoke('settings:test', input),
  },
  reviews: {
    generateDaily: (input) => ipcRenderer.invoke('reviews:generate-daily', input),
    list: () => ipcRenderer.invoke('reviews:list'),
    cancel: () => ipcRenderer.invoke('reviews:cancel'),
    preview: (input) => ipcRenderer.invoke('reviews:preview', input),
    generatePeriodic: (input) => ipcRenderer.invoke('reviews:generate-periodic', input),
  },
};

contextBridge.exposeInMainWorld('zhiji', api);
