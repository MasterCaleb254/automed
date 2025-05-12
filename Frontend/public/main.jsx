import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Import all CSS files
import './styles/global.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/triage.css';
import './styles/animations.css';
import './styles/utilities.css';

// Create root element
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render app
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Error boundary for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  // You could add error reporting service integration here
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise rejection:', event.reason);
  // You could add error reporting service integration here
});

// Performance monitoring
// Uncomment if you want to measure and report web vitals
/*
import { reportWebVitals } from 'web-vitals';
reportWebVitals(console.log);
*/