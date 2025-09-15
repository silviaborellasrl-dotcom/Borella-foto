import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppOptimized from './AppOptimized';

// Caricamento veloce ottimizzato
const container = document.getElementById('root');
const root = createRoot(container);

// Render immediato con app ottimizzata
root.render(
  <React.StrictMode>
    <AppOptimized />
  </React.StrictMode>
);
