/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ResumeProvider } from './context/ResumeContext';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import './worker'; // Worker設定を読み込み
import sampleYaml from '../example/sample.yaml?raw'; // デフォルトのsample.yamlを静的にインポート

loader.config({ monaco });

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  const [initialData, setInitialData] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      const query = new URLSearchParams(window.location.search);

      let sampleText = sampleYaml;
      if (query.has('ayeci')) {
        const module = await import('./../example/ayeci.yaml?raw');
        sampleText = module.default;
      }

      setInitialData(sampleText);
    };
    fetchInitialData();
  }, []);

  if (initialData === null) {
    return null; // またはローディングUI
  }

  return (
    <StrictMode>
      <ResumeProvider initialData={initialData}>
        <App />
      </ResumeProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);

// ネイティブのピンチズームを無効化（Preview.tsxのカスタムズームは動く）
document.addEventListener('gesturestart', (e) => {
  e.preventDefault();
});
