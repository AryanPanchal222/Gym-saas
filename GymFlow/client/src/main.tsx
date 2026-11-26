import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import MemberPortal from './pages/MemberPortal.tsx'
import Admin from './pages/Admin.tsx'
import ActivateAccount from './pages/ActivateAccount.tsx'
import ResetPassword from './pages/ResetPassword.tsx'

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

const path = window.location.pathname.replace(/\/$/, '')
const Root = path === '/member-portal' ? MemberPortal : path === '/activate-account' ? ActivateAccount : path === '/reset-password' ? ResetPassword : path.startsWith('/admin') ? Admin : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
