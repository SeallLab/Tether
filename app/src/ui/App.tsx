import './App.css'
import { useState } from 'react'
import { ChatBubbleLeftEllipsisIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { ChildWindow } from './components/ChildWindow'
import Settings from './Settings'

function App() {
  const [showSettings, setShowSettings] = useState(false);

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  const handleSettingsClose = () => {
    setShowSettings(false);
  };

  return (
    <>
      <div className="dock-container">
        <div className="dock-content">
          <div className="dock-item">
            <ChatBubbleLeftEllipsisIcon />
          </div>
          <div className="dock-item" onClick={handleSettingsClick}>
            <Cog6ToothIcon />
          </div>
        </div>
      </div>

      {showSettings && (
        <ChildWindow
          onClosed={handleSettingsClose}
          options={{
            width: 800,
            height: 600,
            title: 'Tether Settings',
            center: true,
            frame: true,
            resizable: true,
            alwaysOnTop: false
          }}
        >
          <Settings />
        </ChildWindow>
      )}
    </>
  )
}

export default App
