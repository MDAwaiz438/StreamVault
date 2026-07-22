'use client';

import { useEffect } from 'react';

export default function AntiInspect() {
  useEffect(() => {
    // 1. Disable Right Click (Context Menu)
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);

    // 2. Disable DevTools Keyboard Shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 3. DevTools Detection & Infinite Debugger Loop
    // This constantly triggers the 'debugger' statement if DevTools is open,
    // freezing the inspector and making it impossible to scrape network requests.
    const blockDevTools = () => {
      try {
        (function() { return false; }['constructor']('debugger')['call']());
      } catch (err) {}
    };

    const interval = setInterval(() => {
      const start = performance.now();
      blockDevTools();
      const end = performance.now();
      
      // If debugger was triggered, the execution time will be high
      if (end - start > 100) {
        // Optionally clear the screen if they try to bypass it
        document.body.innerHTML = '<div style="display:flex;height:100vh;width:100vw;background:black;color:red;align-items:center;justify-content:center;font-family:sans-serif;font-size:24px;">Debugging not allowed.</div>';
      }
    }, 1000);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(interval);
    };
  }, []);

  return null;
}
