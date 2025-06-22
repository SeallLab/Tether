import './App.css'
import { useState, useEffect } from 'react'
import { ChatBubbleLeftEllipsisIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { ChatWindow } from './pages/ChatWindow/ChatWindow'
import { ChildWindow } from './components/ChildWindow'
import Settings from './pages/Settings/Settings'

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatContext, setChatContext] = useState<string>('general');
  const [currentTheme, setCurrentTheme] = useState<string>('default');

  // Map theme IDs to CSS class names
  const getThemeClassName = (themeId: string) => {
    const themeMap: Record<string, string> = {
      'default': 'theme-default',
      'forest': 'theme-forest', 
      'sunset': 'theme-sunset',
      'royal': 'theme-royal',
      'crimson': 'theme-crimson',
      'galaxy': 'theme-galaxy',
      'aurora': 'theme-aurora'
    };
    return themeMap[themeId] || '';
  };

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

  // Load initial theme from gamification data
  useEffect(() => {
    const loadInitialTheme = async () => {
      if (window.electron?.gamification) {
        try {
          const result = await window.electron.gamification.getData();
          if (result.success && result.data?.currentDockTheme) {
            setCurrentTheme(result.data.currentDockTheme);
          }
        } catch (error) {
          console.error('Failed to load initial theme:', error);
        }
      }
    };

    loadInitialTheme();
  }, []);

  // Listen for IPC messages to show chat dialog
  useEffect(() => {
    const handleShowChatDialog = (context: string) => {
      setChatContext(context);
      setShowChat(true);
    };

    const handleShowRewardsDialog = () => {
      // Open settings window and navigate to rewards tab
      setShowSettings(true);
      // We'll need to pass the initial tab to Settings component
    };

    const handleThemeChange = (themeId: string) => {
      setCurrentTheme(themeId);
    };

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('show-chat-dialog', handleShowChatDialog);
      window.electron.ipcRenderer.on('show-rewards-dialog', handleShowRewardsDialog);
      window.electron.ipcRenderer.on('theme-changed', handleThemeChange);
      
      return () => {
        window.electron.ipcRenderer.removeListener('show-chat-dialog', handleShowChatDialog);
        window.electron.ipcRenderer.removeListener('show-rewards-dialog', handleShowRewardsDialog);
        window.electron.ipcRenderer.removeListener('theme-changed', handleThemeChange);
      };
    }
  }, []);

  return (
    <>
      <div className={`dock-container ${getThemeClassName(currentTheme)}`}>
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
            width: 900,
            height: 700,
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
