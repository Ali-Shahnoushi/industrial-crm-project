import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import 'vazirmatn/misc/Farsi-Digits/Vazirmatn-FD-font-face.css'
import 'vazirmatn/Vazirmatn-Variable-font-face.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </StrictMode>,
)
