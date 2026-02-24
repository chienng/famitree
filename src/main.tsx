import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from './LocaleContext'
import { AuthProvider } from './AuthContext'
import App from './App'
import { init } from './store'
import './index.css'

function Root() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    init()
      .then(() => setStatus('ready'))
      .catch((e) => {
        setError(e?.message ?? String(e))
        setStatus('error')
      })
  }, [])

  const handleRetry = () => {
    setError(null)
    setStatus('loading')
    init()
      .then(() => setStatus('ready'))
      .catch((e) => {
        setError(e?.message ?? String(e))
        setStatus('error')
      })
  }

  if (status === 'ready') {
    return (
      <StrictMode>
        <LocaleProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LocaleProvider>
      </StrictMode>
    )
  }

  if (status === 'error') {
    return (
      <div className="app-loading app-loading--error">
        <p>Could not load database.</p>
        <p className="app-loading-message">{error ?? 'Unknown error'}</p>
        <button type="button" className="btn primary" onClick={handleRetry}>
          Retry
        </button>
      </div>
    )
  }

  return <div className="app-loading">Loading…</div>
}

const root = createRoot(document.getElementById('root')!)
root.render(<Root />)
