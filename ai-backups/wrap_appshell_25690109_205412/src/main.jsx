import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './AppAuth';
import './index.css';

// Safe initialization with error handling
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root element. Please ensure <div id="root"></div> exists in index.html');
}

// Using React 18 createRoot API for better performance
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Performance monitoring (optional, remove in production)
if (import.meta.env.DEV) {
  console.log('🚀 App initialized successfully');
}
