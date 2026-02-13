/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ResumeProvider } from './context/ResumeContext';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

import './worker'; // Worker設定を読み込み

loader.config({ monaco });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ResumeProvider>
      <App />
    </ResumeProvider>
  </StrictMode>,
)
