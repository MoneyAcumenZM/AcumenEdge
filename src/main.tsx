
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import './theme/variables.css';

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (e) {
      console.warn('SW registration failed:', e);
    }
  });
}

// Global unhandled promise rejection handler — prevents silent crashes.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
