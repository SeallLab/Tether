import './App.css'
import { useState, useEffect } from 'react'
import { ChatBubbleLeftEllipsisIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { ChildWindow } from './components/ChildWindow'
import { ChatWindow } from './pages/ChatWindow'
import Settings from './pages/Settings'

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatContext, setChatContext] = useState<string>('general');

  const handleSettingsClick = () => {
    if (showSettings) {
      setShowSettings(false);
    } else {
      setShowSettings(true);
    }
  };

  const handleSettingsClose = () => {
    setShowSettings(false);
  };

  const handleChatClose = () => {
    setShowChat(false);
  };

  const handleChatClick = () => {
    if (showChat) {
      setShowChat(false);
    } else {
      setChatContext('general');
      setShowChat(true);
    }
  };

  // Listen for IPC messages to show chat dialog
  useEffect(() => {
    const handleShowChatDialog = (context: string) => {
      setChatContext(context);
      setShowChat(true);
    };

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('show-chat-dialog', handleShowChatDialog);
      
      return () => {
        window.electron.ipcRenderer.removeListener('show-chat-dialog', handleShowChatDialog);
      };
    }
  }, []);

  return (
    <>
      <div className="dock-container">
        <div className="dock-content">
          <div className="dock-item" onClick={handleChatClick}>
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
            alwaysOnTop: false
          }}
        >
          <Settings />
        </ChildWindow>
      )}

      {showChat && (
        <ChildWindow
          onClosed={handleChatClose}
          options={{
            width: 600,
            height: 500,
            title: 'Tether Assistant',
            center: true,
            frame: false,
            resizable: false,
            alwaysOnTop: true,
            transparent: true,
          }}
        >
          <ChatWindow context={chatContext} />
        </ChildWindow>
      )}
    </>
  )
}

export default App
