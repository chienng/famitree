import { createContext, useContext, useState, useCallback } from 'react'
import { getCurrentUser, login as dbLogin, createUserByAdmin as dbCreateUserByAdmin, logout as dbLogout, subscribe } from './store'
import type { User } from './store'

interface AuthContextValue {
  user: User | null
  login: (username: string, password: string) => Promise<{ error?: string }>
  createUser: (username: string, password: string, defaultBranchPersonId?: string | null) => Promise<{ error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setTick] = useState(0)
  subscribe(() => setTick((n) => n + 1))

  const user = getCurrentUser()

  const login = useCallback(async (username: string, password: string) => {
    const u = await dbLogin(username, password)
    return u ? {} : { error: 'auth.loginFailed' }
  }, [])

  const createUser = useCallback(async (username: string, password: string, defaultBranchPersonId?: string | null) => {
    const result = await dbCreateUserByAdmin(username, password, defaultBranchPersonId)
    return result.error ? { error: result.error } : {}
  }, [])

  const logout = useCallback(() => {
    dbLogout()
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, createUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
