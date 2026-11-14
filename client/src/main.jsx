import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './lib/shared.js';
import './styles/css/styles.css';
import './styles/css/motion.css';
import './styles/css/assistant.css';
import App from './App.jsx';
import { initTheme } from './lib/theme.js';

initTheme();

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
