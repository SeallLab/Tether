import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Settings from './Settings.tsx'
import { ChatWindow } from './components/ChatWindow'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/chat" element={<ChatWindow />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
