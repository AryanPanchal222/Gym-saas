import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const storedTheme = localStorage.getItem('gymflow_theme')
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const initialTheme = storedTheme === 'dark'
  ? 'dark'
  : storedTheme === 'light'
    ? 'light'
    : systemPrefersDark
      ? 'dark'
      : 'light'

document.documentElement.setAttribute('data-theme', initialTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
