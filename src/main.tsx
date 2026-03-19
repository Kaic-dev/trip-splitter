import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HistoryProvider } from './providers/HistoryProvider'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import './index.css'
import App from './App.tsx'

if (Capacitor.isNativePlatform()) {
  Keyboard.setResizeMode({ mode: KeyboardResize.Native });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <HistoryProvider>
        <App />
      </HistoryProvider>
    </BrowserRouter>
  </StrictMode>,
)
