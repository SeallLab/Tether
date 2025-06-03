import './App.css'
import { useState } from 'react'
import { ChatBubbleLeftEllipsisIcon, Cog6ToothIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
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

  const handleToggleDock = async () => {
    try {
      const result = await window.electron.dock.toggle();
      console.log('Dock toggle result:', result);
    } catch (error) {
      console.error('Failed to toggle dock:', error);
    }
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
            width: 700,
            height: 550,
            title: 'Settings',
            center: true,
            frame: true,
            resizable: true,
            alwaysOnTop: true
          }}
        >
          <Settings />
        </ChildWindow>
      )}
    </>
  )
}

export default App
