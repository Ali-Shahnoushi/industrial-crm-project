import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/vazirmatn'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </StrictMode>,
)
