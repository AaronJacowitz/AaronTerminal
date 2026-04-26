import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, fetchMe, login as apiLogin, register as apiRegister, type AuthUser } from '../api/client'

type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; token: string; user: AuthUser }

interface AuthCtx {
  state: AuthState
  signIn: (email: string, password: string) => Promise<void>
  signUp: (username: string, email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

const TOKEN_KEY = 'aaron-terminal-token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setState({ status: 'signed_out' })
      return
    }
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    fetchMe()
      .then((user: AuthUser) => setState({ status: 'signed_in', token, user }))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        delete api.defaults.headers.common.Authorization
        setState({ status: 'signed_out' })
      })
  }, [])

  const signIn = async (email: string, password: string) => {
    const res = await apiLogin({ email, password })
    const token = res.token as string
    const user = res.user as AuthUser
    localStorage.setItem(TOKEN_KEY, token)
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    setState({ status: 'signed_in', token, user })
  }

  const signUp = async (username: string, email: string, password: string) => {
    const res = await apiRegister({ username, email, password })
    const token = res.token as string
    const user = res.user as AuthUser
    localStorage.setItem(TOKEN_KEY, token)
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    setState({ status: 'signed_in', token, user })
  }

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY)
    delete api.defaults.headers.common.Authorization
    setState({ status: 'signed_out' })
  }

  const value = useMemo<AuthCtx>(() => ({ state, signIn, signUp, signOut }), [state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

