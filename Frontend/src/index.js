import React from 'react';
import ReactDOM from 'react-dom';
import App from "./components/App";


ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);



// Importing necessary stylesheets for the application
import './styles/global.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/triage.css';
import './styles/animations.css';
import './styles/utilities.css';

// Prevent the app from rendering in strict mode during development
// to avoid duplicate API calls and potential issues with third-party libraries
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);

// If you want to implement service worker for offline capability
// Register service worker for PWA (Progressive Web App) capabilities
// Uncomment the following code if you want to add PWA features

/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
*/

// Error tracking
window.addEventListener('error', (event) => {
  // You can implement error logging service here
  console.error('Global error caught:', event.error);
  
  // Optionally send to an error tracking service
  // errorTrackingService.logError(event.error);
});

// Add a listener for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise rejection:', event.reason);
  
  // Optionally send to an error tracking service
  // errorTrackingService.logError(event.reason);
});

// Performance monitoring - for large-scale deployments
// You can add performance monitoring code here when needed
// Example:
/*
const reportWebVitals = (metric) => {
  // Analytics or monitoring service
  console.log(metric);
};

// Measure and report web vitals
import { reportWebVitals } from 'web-vitals';
reportWebVitals(console.log);
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/global.css'; // Adjust if needed

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import './i18n'; // Import the i18n setup

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
