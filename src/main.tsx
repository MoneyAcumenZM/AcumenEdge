
import { createRoot } from "react-dom/client";
import App from "@/app/App.tsx";
import "@/styles/index.css";
import '@/styles/variables.css';

// Global unhandled promise rejection handler — prevents silent crashes.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
