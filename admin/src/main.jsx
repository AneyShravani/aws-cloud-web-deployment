import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted Manrope (bundled → loads instantly, works offline).
// Only the weights the UI actually uses, to keep the bundle lean.
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
