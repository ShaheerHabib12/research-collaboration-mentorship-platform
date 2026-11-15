import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './lib/shared.js';
// Fonts are bundled with the app (SIL Open Font License), so no other origin is contacted and the CSP can stay at 'self'.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import './styles/css/styles.css';
import './styles/css/motion.css';
import './styles/css/assistant.css';
import App from './App.jsx';
import { initTheme } from './lib/theme.js';

initTheme();

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
