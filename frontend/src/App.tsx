import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { apiFetch } from './api'
import Landing from './page/Landing.jsx'
import SignupPageEnterprise from './page/signup/SignupPageEnterprise.jsx'
import LoginPageEnterprise from './page/login/LoginPageEnterprise.jsx'
import AdminLoginPage from './page/login/AdminLoginPage.jsx'
import AdminPanel from './page/admin/admin.jsx'
import ParentDashboard from './page/Parents/ParentDashboard.jsx'
import DriverDashboard from './page/Driver/DriverDashboard.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AuthLayout from './components/auth/AuthLayout.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import TripNotificationSystem from './components/TripNotificationSystem.jsx'
import { useSocket, disconnectGlobalSocket } from './hooks/useSocket.js'
import { registerPushSubscription } from './lib/pushNotifications'
import { signOutIdentity } from './lib/authService'
import { AUTH_ROUTES, PROTECTED_ROUTES, SESSION_CONFIG, getDefaultRouteForRole } from './constants/authConstants'
import './App.css'

type Role = 'parent' | 'driver' | 'admin'
type AuthUser = {
  id: string
  role: Role
  fullName: string
  email: string
  phone?: string
  homeAddress?: string
  status: 'pending' | 'reviewing' | 'approved' | 'declined'
  accountState?: 'active' | 'suspended' | 'banned'
}
type AuthResponse = { token: string; user: AuthUser }
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function validateUser(user: AuthUser | null | undefined) {
  if (!user?.id || !user.email || !['parent', 'driver', 'admin'].includes(user.role)) {
    throw new Error('Unable to verify this account. Please sign in again.')
  }
  if (user.accountState === 'suspended' || user.accountState === 'banned') {
    throw new Error('This account is unavailable. Please contact support.')
  }
  if (user.role === 'driver' && user.status !== 'approved') {
    throw new Error('Your driver application must be approved before you can sign in.')
  }
}

function App() {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loadingSession, setLoadingSession] = useState(() => Boolean(localStorage.getItem(SESSION_CONFIG.TOKEN_KEY)))
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallNotice, setShowInstallNotice] = useState(false)
  const [installingApp, setInstallingApp] = useState(false)
  const hasActiveSession = !loadingSession && Boolean(token && user)
  const socketOptions = useMemo(
    () => user?.role === 'admin' ? { auth: { scope: 'admin' } } : {},
    [user?.role],
  )
  const { isConnected: socketConnected } = useSocket(hasActiveSession ? token : '', socketOptions)

  useEffect(() => {
    const storedToken = localStorage.getItem(SESSION_CONFIG.TOKEN_KEY)
    if (!storedToken) return
    let cancelled = false
    let controller: AbortController | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const restoreSession = async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        controller = new AbortController()
        timeoutId = setTimeout(() => controller?.abort(), 5000)
        try {
          const response = await apiFetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
            signal: controller.signal,
          })
          if (cancelled) return
          validateUser(response.user)
          setToken(storedToken)
          setUser(response.user)
          setSessionError(null)
          setLoadingSession(false)
          return
        } catch (error: unknown) {
          if (cancelled) return
          const failure = error as { name?: string; status?: number; message?: string }
          if (failure.name === 'AbortError' && attempt === 0) continue
          if (failure.status === 401) {
            console.info('[AUTH] Session restore rejected: token is invalid or account no longer exists.')
            localStorage.removeItem(SESSION_CONFIG.TOKEN_KEY)
            setLoadingSession(false)
            return
          }
          console.warn('[AUTH] Session restore failed without clearing the saved token.', {
            status: failure.status || 'network',
            error: failure.name || 'RequestError',
          })
          // Temporary connection errors retain the token so a retry can restore it.
          setSessionError(failure.status === 403
            ? failure.message || 'This account is unavailable. Please contact support.'
            : failure.name === 'AbortError'
              ? 'The connection timed out. Please try again.'
              : failure.message || 'Unable to restore your session. Please try again.')
          setLoadingSession(false)
          return
        } finally {
          clearTimeout(timeoutId)
        }
      }
    }
    void restoreSession()
    return () => {
      cancelled = true
      controller?.abort()
      clearTimeout(timeoutId)
    }
  }, [restoreAttempt])

  useEffect(() => {
    if (!hasActiveSession || !user || !['parent', 'driver'].includes(user.role)) return
    registerPushSubscription(token).catch(() => {
      // Notification permissions never block the session.
    })
  }, [hasActiveSession, token, user])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setShowInstallNotice(true)
    }
    const handleAppInstalled = () => {
      setInstallEvent(null)
      setShowInstallNotice(false)
      setInstallingApp(false)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    if (!installEvent) return
    setInstallingApp(true)
    try {
      await installEvent.prompt()
      await installEvent.userChoice
    } finally {
      setInstallingApp(false)
      setInstallEvent(null)
      setShowInstallNotice(false)
    }
  }

  const clearLegacyCredentialStorage = () => {
    const credentialKeys = [
      'hns_email',
      'hns_password',
      'login_email',
      'login_password',
      'saved_email',
      'saved_password',
      'remember_me',
      'rememberPassword',
      'hns_remember_me',
      'hns_remember_token_time',
      SESSION_CONFIG.REMEMBER_ME_KEY,
    ]

    for (const key of credentialKeys) {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }
  }

  const handleLoggedIn = ({ token: authToken, user: authUser }: AuthResponse) => {
    validateUser(authUser)
    if (!authToken) throw new Error('The server did not return a session. Please try again.')
    localStorage.setItem(SESSION_CONFIG.TOKEN_KEY, authToken)
    setToken(authToken)
    setUser(authUser)
    setSessionError(null)
    navigate(getDefaultRouteForRole(authUser.role), { replace: true })
  }

  useEffect(() => {
    clearLegacyCredentialStorage()
  }, [])

  const getPublicRouteForTarget = (target: string) => {
    switch (target) {
      case 'register':
        return AUTH_ROUTES.SIGNUP
      case 'driver-apply':
        return AUTH_ROUTES.DRIVER_APPLY
      case 'login':
      default:
        return AUTH_ROUTES.LOGIN
    }
  }

  const handleLogout = () => {
    disconnectGlobalSocket()
    setToken('')
    setUser(null)
    setSessionError(null)
    setLoadingSession(false)
    clearLegacyCredentialStorage()
    localStorage.removeItem(SESSION_CONFIG.TOKEN_KEY)
    localStorage.removeItem(SESSION_CONFIG.USER_KEY)
    localStorage.removeItem(SESSION_CONFIG.REMEMBER_ME_KEY)
    localStorage.removeItem('hns_remember_token_time')
    void signOutIdentity().catch(() => {
      // The application session has already been cleared.
    })
    navigate('/', { replace: true })
  }

  const publicPage = (page: ReactNode) => hasActiveSession && user
    ? <Navigate to={getDefaultRouteForRole(user.role)} replace />
    : page

  const protectedPage = (role: Role, page: ReactNode) => {
    if (!hasActiveSession || !user) return <Navigate to={AUTH_ROUTES.LOGIN} replace />
    if (user.role !== role) return <Navigate to={getDefaultRouteForRole(user.role)} replace />
    return page
  }

  return (
    <NotificationProvider>
      <div className="app-shell app-shell--fullscreen">
        {showInstallNotice && installEvent && (
          <div className="install-app-notice" role="status" aria-live="polite">
            <div className="install-app-notice__content">
              <span className="material-symbols-rounded" aria-hidden="true">download</span>
              <div><strong>Install H&S App</strong><p>Install this app for faster access and notifications.</p></div>
            </div>
            <div className="install-app-notice__actions">
              <button type="button" className="ghost" onClick={() => setShowInstallNotice(false)}>Later</button>
              <button type="button" className="install-app-notice__install" onClick={handleInstallApp} disabled={installingApp}>
                {installingApp ? 'Installing…' : 'Install App'}
              </button>
            </div>
          </div>
        )}
        {loadingSession ? (
          <AuthLayout title="Welcome back" subtitle="Restoring your session…"><p className="auth-hint" role="status">Please wait while we check your account.</p></AuthLayout>
        ) : sessionError ? (
          <AuthLayout title="Let's reconnect" subtitle={sessionError}>
            <div className="auth-form">
              <button type="button" className="auth-primary" onClick={() => {
                setSessionError(null)
                setLoadingSession(true)
                setRestoreAttempt((attempt) => attempt + 1)
              }}>Try again</button>
              <button type="button" className="auth-link" onClick={handleLogout}>Sign out and return home</button>
              <Link className="auth-link" to={AUTH_ROUTES.LOGIN} onClick={handleLogout}>Sign in again</Link>
            </div>
          </AuthLayout>
        ) : (
          <Routes>
            <Route path="/" element={publicPage(<Landing onNavigate={(target: string) => navigate(getPublicRouteForTarget(target))} />)} />
            <Route path={AUTH_ROUTES.LOGIN} element={publicPage(<LoginPageEnterprise key="login" onLoggedIn={handleLoggedIn} />)} />
            <Route path="/admin-login" element={publicPage(<AdminLoginPage onLoggedIn={handleLoggedIn} onBackToMain={() => navigate(AUTH_ROUTES.LOGIN)} />)} />
            <Route path={AUTH_ROUTES.DRIVER_APPLY} element={publicPage(<SignupPageEnterprise initialRole="driver" />)} />
            <Route path={AUTH_ROUTES.FORGOT_PASSWORD} element={publicPage(<LoginPageEnterprise key="forgot-password" onLoggedIn={handleLoggedIn} />)} />
            <Route path={AUTH_ROUTES.SIGNUP} element={publicPage(<SignupPageEnterprise initialRole="parent" />)} />
            <Route path={PROTECTED_ROUTES.ADMIN} element={protectedPage('admin', <AdminPanel token={token} user={user} onLogout={handleLogout} />)} />
            <Route path={PROTECTED_ROUTES.PARENT} element={protectedPage('parent', <ParentDashboard token={token} user={user} onLogout={handleLogout} />)} />
            <Route path={PROTECTED_ROUTES.DRIVER} element={protectedPage('driver', <ErrorBoundary><DriverDashboard token={token} user={user} onLogout={handleLogout} /></ErrorBoundary>)} />
            <Route path="/login" element={<Navigate to={AUTH_ROUTES.LOGIN} replace />} />
            <Route path="/signup" element={<Navigate to={AUTH_ROUTES.SIGNUP} replace />} />
            <Route path="/register" element={<Navigate to={AUTH_ROUTES.SIGNUP} replace />} />
            <Route path="/driver/apply" element={<Navigate to={AUTH_ROUTES.DRIVER_APPLY} replace />} />
            <Route path="/auth/login" element={<Navigate to={AUTH_ROUTES.LOGIN} replace />} />
            <Route path="/auth/signup" element={<Navigate to={AUTH_ROUTES.SIGNUP} replace />} />
            <Route path="/auth/forgot-password" element={<Navigate to={AUTH_ROUTES.FORGOT_PASSWORD} replace />} />
            <Route path="*" element={<Navigate to={user ? getDefaultRouteForRole(user.role) : '/'} replace />} />
          </Routes>
        )}
        {hasActiveSession && socketConnected && <TripNotificationSystem />}
      </div>
    </NotificationProvider>
  )
}
export default App
