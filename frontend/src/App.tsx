import { useEffect, useState } from 'react'
import { apiFetch } from './api'
import SignupPage from './page/signup/signup.jsx'
import LoginPage from './page/login/login.jsx'
import AdminPanel from './page/admin/admin.jsx'
import ParentDashboard from './page/Parents/ParentDashboard.jsx'
import DriverDashboard from './page/Driver/DriverDashboard.jsx'
import { registerPushSubscription } from './lib/pushNotifications'
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
}

type AuthResponse = {
	token: string
	user: AuthUser
}

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function App() {
	const [tab, setTab] = useState<'register' | 'login' | 'admin' | 'applicant'>('login')
	const [token, setToken] = useState('')
	const [user, setUser] = useState<AuthUser | null>(null)
	const [loadingSession, setLoadingSession] = useState(true)
	const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
	const [showInstallNotice, setShowInstallNotice] = useState(false)
	const [installingApp, setInstallingApp] = useState(false)
	const hasActiveSession = !loadingSession && Boolean(token && user)

	useEffect(() => {
		const storedToken = localStorage.getItem('hns_token')

		if (!storedToken) {
			setLoadingSession(false)
			return
		}

		const restoreSession = async () => {
			try {
				const response = await apiFetch('/api/auth/me', {
					headers: {
						Authorization: `Bearer ${storedToken}`,
					},
				})

				setToken(storedToken)
				setUser(response.user)
				setTab(response.user.role === 'admin' ? 'admin' : 'applicant')
			} catch {
				localStorage.removeItem('hns_token')
			} finally {
				setLoadingSession(false)
			}
		}

		restoreSession()
	}, [])

	useEffect(() => {
		if (!token || !user || !['parent', 'driver'].includes(user.role)) {
			return
		}

		registerPushSubscription(token).catch(() => {
			// Notification subscription should not block normal app usage.
		})
	}, [token, user])

	useEffect(() => {
		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault()
			setInstallEvent(event as BeforeInstallPromptEvent)
			setShowInstallNotice(true)
		}

		const handleAppInstalled = () => {
			setInstallEvent(null)
			setShowInstallNotice(false)
		}

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
		window.addEventListener('appinstalled', handleAppInstalled)

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
			window.removeEventListener('appinstalled', handleAppInstalled)
		}
	}, [])

	const handleInstallApp = async () => {
		if (!installEvent) {
			return
		}

		setInstallingApp(true)
		await installEvent.prompt()
		await installEvent.userChoice
		setInstallingApp(false)
		setInstallEvent(null)
		setShowInstallNotice(false)
	}

	const handleLoggedIn = ({ token: authToken, user: authUser }: AuthResponse) => {
		setToken(authToken)
		setUser(authUser)
		localStorage.setItem('hns_token', authToken)
		setTab(authUser.role === 'admin' ? 'admin' : 'applicant')
	}

	const handleLogout = () => {
		setToken('')
		setUser(null)
		localStorage.removeItem('hns_token')
		setTab('login')
	}

	return (
		<main className={`app-shell ${hasActiveSession ? 'app-shell--fullscreen' : ''}`}>
			{showInstallNotice && installEvent ? (
				<div className="install-app-notice" role="status" aria-live="polite">
					<div className="install-app-notice__content">
						<span className="material-symbols-rounded" aria-hidden="true">
							download
						</span>
						<div>
							<strong>Install H&S App</strong>
							<p>Install this app for faster access and notifications.</p>
						</div>
					</div>

					<div className="install-app-notice__actions">
						<button type="button" className="ghost" onClick={() => setShowInstallNotice(false)}>
							Later
						</button>
						<button type="button" className="install-app-notice__install" onClick={handleInstallApp} disabled={installingApp}>
							{installingApp ? 'Installing...' : 'Install App'}
						</button>
					</div>
				</div>
			) : null}

			{loadingSession ? (
				<section className="panel"><p>Restoring your session...</p></section>
			) : null}

			{!loadingSession && !token ? (
				<section className="auth-card panel">
					<div className="auth-head">
						<h1>H&S Booking System</h1>
						<p>Safe and reliable school service booking for parents, drivers, and admins.</p>
					</div>

					<nav className="tab-nav">
						<button type="button" className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>
							Login
						</button>
						<button type="button" className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>
							Sign Up
						</button>
					</nav>

					{tab === 'login' ? <LoginPage onLoggedIn={handleLoggedIn} /> : null}
					{tab === 'register' ? <SignupPage /> : null}
				</section>
			) : null}

			{!loadingSession && token && user?.role === 'admin' ? (
				<section className="panel">
					<div className="panel-toolbar">
						<p>Logged in as {user.fullName} (Admin)</p>
						<button type="button" className="ghost" onClick={handleLogout}>
							Logout
						</button>
					</div>

					<AdminPanel token={token} />
				</section>
			) : null}

			{!loadingSession && token && user && user.role === 'parent' ? (
				<ParentDashboard token={token} user={user} onLogout={handleLogout} />
			) : null}

			{!loadingSession && token && user && user.role === 'driver' ? (
				<DriverDashboard token={token} user={user} onLogout={handleLogout} />
			) : null}
		</main>
	)
}

export default App
