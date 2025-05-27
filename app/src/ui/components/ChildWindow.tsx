import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ChildWindowProps {
  children: React.ReactNode;
  onClosed: () => void;
  options?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    alwaysOnTop?: boolean;
    frame?: boolean;
    transparent?: boolean;
    resizable?: boolean;
    title?: string;
    center?: boolean;
  };
}

export const ChildWindow: React.FC<ChildWindowProps> = ({ 
  children, 
  onClosed, 
  options = {} 
}) => {
  const [childWindow, setChildWindow] = useState<Window | null>(null);
  const [isReady, setIsReady] = useState(false);
  const onClosedRef = useRef(onClosed);
  const hasCalledOnClosed = useRef(false);

  // Update the ref when onClosed changes
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  useEffect(() => {
    // Create the window options string for window.open
    const windowFeatures = Object.entries(options)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    // Open the new window
    const newWindow = window.open('', '_blank', windowFeatures);
    
    if (newWindow) {
      setChildWindow(newWindow);
      
      // Set up the basic HTML structure
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${options.title || 'Settings'}</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: system-ui, -apple-system, sans-serif;
                background-color: #f8f9fa;
              }
            </style>
          </head>
          <body>
            <div id="root"></div>
          </body>
        </html>
      `);
      newWindow.document.close();
      
      // Wait for the window to be ready
      const handleLoad = () => {
        setIsReady(true);
      };
      
      // Handle window close - use 'unload' instead of 'beforeunload'
      const handleUnload = () => {
        if (!hasCalledOnClosed.current) {
          hasCalledOnClosed.current = true;
          onClosedRef.current();
        }
      };

      newWindow.addEventListener('load', handleLoad);
      newWindow.addEventListener('unload', handleUnload);
      
      // Also check if window is closed via polling (backup method)
      const checkClosed = setInterval(() => {
        if (newWindow.closed && !hasCalledOnClosed.current) {
          hasCalledOnClosed.current = true;
          onClosedRef.current();
          clearInterval(checkClosed);
        }
      }, 1000);

      return () => {
        clearInterval(checkClosed);
        newWindow.removeEventListener('load', handleLoad);
        newWindow.removeEventListener('unload', handleUnload);
        if (!newWindow.closed) {
          newWindow.close();
        }
      };
    }
  }, []); // Remove options from dependency array to prevent recreation

  // Update window options when they change (separate effect)
  useEffect(() => {
    if (childWindow && window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('update-child-window-options', {
        windowId: childWindow.name,
        options
      });
    }
  }, [childWindow, options]);

  if (!childWindow || !isReady) {
    return null;
  }

  const rootElement = childWindow.document.getElementById('root');
  if (!rootElement) {
    return null;
  }

  return createPortal(children, rootElement);
}; 