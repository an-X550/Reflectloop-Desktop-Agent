import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './renderer/app/app';
import { initTheme } from './renderer/utils/theme';
import './index.css';

initTheme();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
