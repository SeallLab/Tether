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

// Utility function to copy styles from parent window to child window
const copyStylesToWindow = (targetWindow: Window) => {
  const parentDoc = document;
  const childDoc = targetWindow.document;

  // Copy all link elements (external stylesheets)
  const linkElements = parentDoc.querySelectorAll('link[rel="stylesheet"]');
  linkElements.forEach((link) => {
    const newLink = childDoc.createElement('link');
    newLink.rel = 'stylesheet';
    newLink.href = (link as HTMLLinkElement).href;
    newLink.type = 'text/css';
    childDoc.head.appendChild(newLink);
  });

  // Copy all style elements (inline styles)
  const styleElements = parentDoc.querySelectorAll('style');
  styleElements.forEach((style) => {
    const newStyle = childDoc.createElement('style');
    newStyle.type = 'text/css';
    if (style.textContent) {
      newStyle.textContent = style.textContent;
    }
    childDoc.head.appendChild(newStyle);
  });

  // For Vite development, we might need to wait for styles to load
  // and then copy them again
  setTimeout(() => {
    const additionalStyles = parentDoc.querySelectorAll('style');
    additionalStyles.forEach((style) => {
      // Check if this style is already copied
      const existingStyles = Array.from(childDoc.querySelectorAll('style'));
      const alreadyExists = existingStyles.some(existing => 
        existing.textContent === style.textContent
      );
      
      if (!alreadyExists && style.textContent) {
        const newStyle = childDoc.createElement('style');
        newStyle.type = 'text/css';
        newStyle.textContent = style.textContent;
        childDoc.head.appendChild(newStyle);
      }
    });
  }, 100);
};

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
            <title>${options.title}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: system-ui, -apple-system, sans-serif;
                background-color: #f8f9fa;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1);
                height: 100vh;
                min-height: 100vh;
              }
              #root {
                width: 100%;
                height: 100vh;
                min-height: 100vh;
                border-radius: 8px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
              }
            </style>
          </head>
          <body>
            <div id="root"></div>
          </body>
        </html>
      `);
      newWindow.document.close();
      
      // Copy styles from parent window
      copyStylesToWindow(newWindow);
      
      // Wait for the window to be ready
      const handleLoad = () => {
        // Copy styles again after load to ensure everything is captured
        copyStylesToWindow(newWindow);
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