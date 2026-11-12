import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import { initTheme } from './services/themeService'

// Initialiser le thème choisi par le médecin dès le démarrage
initTheme();

// Enregistrement du Service Worker PWA (Conformité Google Chrome & installation sur écran d'accueil)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        console.log('DocPocket Cab PWA Service Worker actif sur le scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('Enregistrement Service Worker non actif:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
