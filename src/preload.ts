import { contextBridge, ipcRenderer } from 'electron';
import type { ZhijiDesktopApi } from './shared/contracts/desktop-api';

const api: ZhijiDesktopApi = {
  dataDirectory: { getInfo: () => ipcRenderer.invoke('data-directory:get-info'), open: () => ipcRenderer.invoke('data-directory:open') },
  profile: { get: () => ipcRenderer.invoke('profile:get'), save: (input) => ipcRenderer.invoke('profile:save', input), clear: () => ipcRenderer.invoke('profile:clear') },
  transfer: {
    exportBackup: () => ipcRenderer.invoke('transfer:export'),
    previewRestore: () => ipcRenderer.invoke('transfer:preview-restore'),
    restore: (previewId) => ipcRenderer.invoke('transfer:restore', previewId),
  },
  journals: {
    create: (input) => ipcRenderer.invoke('journals:create', input),
    update: (input) => ipcRenderer.invoke('journals:update', input),
    list: (query = {}) => ipcRenderer.invoke('journals:list', query),
    get: (id) => ipcRenderer.invoke('journals:get', id),
    delete: (id) => ipcRenderer.invoke('journals:delete', id),
  },
  projects: {
    create: (input) => ipcRenderer.invoke('projects:create', input),
    list: () => ipcRenderer.invoke('projects:list'),
    archive: (id) => ipcRenderer.invoke('projects:archive', id),
    rename: (input) => ipcRenderer.invoke('projects:rename', input),
    restore: (id) => ipcRenderer.invoke('projects:restore', id),
    delete: (id) => ipcRenderer.invoke('projects:delete', id),
  },
  settings: {
    getPublicConfig: () => ipcRenderer.invoke('settings:get'),
    save: (input) => ipcRenderer.invoke('settings:save', input),
    testConnection: (input) => ipcRenderer.invoke('settings:test', input),
    clearApiKey: () => ipcRenderer.invoke('settings:clear-api-key'),
  },
  reviews: {
    generateDaily: (input) => ipcRenderer.invoke('reviews:generate-daily', input),
    list: () => ipcRenderer.invoke('reviews:list'),
    cancel: () => ipcRenderer.invoke('reviews:cancel'),
    preview: (input) => ipcRenderer.invoke('reviews:preview', input),
    generatePeriodic: (input) => ipcRenderer.invoke('reviews:generate-periodic', input),
    previewInsight: (input) => ipcRenderer.invoke('reviews:preview-insight', input),
    generateInsight: (input) => ipcRenderer.invoke('reviews:generate-insight', input),
    delete: (id) => ipcRenderer.invoke('reviews:delete', id),
  },
  patterns: {
    list: () => ipcRenderer.invoke('patterns:list'),
    propose: (input) => ipcRenderer.invoke('patterns:propose', input),
    confirm: (input) => ipcRenderer.invoke('patterns:confirm', input),
  },
  topics: {
    start: (input) => ipcRenderer.invoke('topics:start', input),
    discuss: (input) => ipcRenderer.invoke('topics:discuss', input),
    propose: (input) => ipcRenderer.invoke('topics:propose', input),
    confirm: (input) => ipcRenderer.invoke('topics:confirm', input),
    list: () => ipcRenderer.invoke('topics:list'),
    get: (input) => ipcRenderer.invoke('topics:get', input),
    sessions: () => ipcRenderer.invoke('topics:sessions'),
    resume: (input) => ipcRenderer.invoke('topics:resume', input),
  },
  web: {
    search: (input) => ipcRenderer.invoke('web:search', input),
    readSource: (input) => ipcRenderer.invoke('web:read-source', input),
  },
  intent: { resolve: (input) => ipcRenderer.invoke('intent:resolve', input) },
};

contextBridge.exposeInMainWorld('zhiji', api);
