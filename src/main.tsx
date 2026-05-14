import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker so the app works offline once visited once.
// On controllerchange (= a new SW just took over), refresh once so the
// user sees the new build immediately. The flag prevents an infinite loop
// in case the browser fires the event during the initial registration.
if ('serviceWorker' in navigator) {
  let refreshed = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshed) return
    refreshed = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(err => console.warn('[sw] registration failed:', err))
  })
}
