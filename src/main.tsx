import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProvider } from './components/app-provider.tsx'
import { Toaster } from '@/components/ui/sonner.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
      <Toaster richColors />
    </AppProvider>
  </StrictMode>,
)
