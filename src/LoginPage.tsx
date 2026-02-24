import { useState } from 'react'
import { useLocale } from './LocaleContext'
import { useAuth } from './AuthContext'
import { PasswordInput } from './PasswordInput'
import './App.css'

export function LoginPage() {
  const { t, locale, setLocale } = useLocale()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await login(username, password)
      if (result.error) setError(result.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-lang-switcher">
        <button
          type="button"
          className="lang-switch-btn"
          onClick={() => setLocale(locale === 'en' ? 'vi' : 'en')}
          aria-label={t('app.language')}
          title={locale === 'en' ? 'Tiếng Việt' : 'English'}
        >
          <span className={`lang-switch-flag ${locale === 'en' ? 'lang-switch-flag--active' : ''}`} aria-hidden>🇺🇸</span>
          <span className={`lang-switch-flag ${locale === 'vi' ? 'lang-switch-flag--active' : ''}`} aria-hidden>🇻🇳</span>
        </button>
      </div>
      <div className="auth-card">
        <h1 className="auth-logo">
          <img src="/logo.png" alt="FamiTree" />
        </h1>
        <p className="auth-tagline">{t('app.tagline')}</p>
        <h2 className="auth-title">{t('auth.loginTitle')}</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="auth-username">{t('auth.username')}</label>
            <input
              id="auth-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="auth-password">{t('auth.password')}</label>
            <PasswordInput
              id="auth-password"
              value={password}
              onChange={setPassword}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error.startsWith('auth.') ? t(error) : error}
            </p>
          )}
          <button type="submit" className="btn primary auth-submit" disabled={loading}>
            {t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  )
}
