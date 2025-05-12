import './App.css'
import { DevicePhoneMobileIcon, ChatBubbleLeftEllipsisIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

function App() {
  return (
    <div 
      className="dock-container"
    >
      <div className="dock-content">
        <div className="dock-item">
          <DevicePhoneMobileIcon />
        </div>
        <div className="dock-item">
          <ChatBubbleLeftEllipsisIcon />
        </div>
        <div className="dock-item">
          <Cog6ToothIcon />
        </div>
      </div>
    </div>
  )
}

export default App
