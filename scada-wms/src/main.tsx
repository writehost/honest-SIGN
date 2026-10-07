import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { emptyDB, getDB, initStore } from '@/domain/db'
import { seedDemo } from '@/domain/seed'
import { App } from './App'

initStore(emptyDB, window.localStorage)
if (getDB().orgs.length === 0) seedDemo()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
