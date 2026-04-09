import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Select } from '../../components/ui/select'
import Sidenavbar from './Sidenavbar'
import './ParentDashboard.scss'

const statusOptions = ['all', 'pending', 'reviewing', 'approved', 'declined']

function formatDate(dateValue) {
	if (!dateValue) {
		return 'N/A'
	}

	return new Date(dateValue).toLocaleString()
}

export default function ParentDashboard({ token, user, onLogout }) {
	const [notifications, setNotifications] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [statusFilter, setStatusFilter] = useState('all')
	const [sortDirection, setSortDirection] = useState('newest')
	const [search, setSearch] = useState('')
	const [activeSection, setActiveSection] = useState('dashboard')

	const fetchNotifications = async () => {
		setLoading(true)
		setError('')

		try {
			const response = await apiFetch('/api/parents/notifications', {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			setNotifications(response.notifications || [])
		} catch (requestError) {
			setError(requestError.message || 'Unable to load dashboard data right now.')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchNotifications()
	}, [token])

	const markRead = async (notificationId) => {
		try {
			await apiFetch(`/api/parents/notifications/${notificationId}/read`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			setNotifications((current) =>
				current.map((item) =>
					item._id === notificationId
						? {
								...item,
								read: true,
							}
						: item,
				),
			)
		} catch (requestError) {
			setError(requestError.message || 'Unable to mark item as read.')
		}
	}

	const summary = useMemo(
		() => ({
			total: notifications.length,
			pending: notifications.filter((item) => item.status === 'pending').length,
			approved: notifications.filter((item) => item.status === 'approved').length,
			completed: notifications.filter((item) => item.read).length,
		}),
		[notifications],
	)

	const filteredItems = useMemo(() => {
		let items = [...notifications]

		if (statusFilter !== 'all') {
			items = items.filter((item) => item.status === statusFilter)
		}

		if (search.trim()) {
			const query = search.toLowerCase()
			items = items.filter(
				(item) =>
					item.title?.toLowerCase().includes(query) ||
					item.message?.toLowerCase().includes(query) ||
					item.status?.toLowerCase().includes(query),
			)
		}

		items.sort((a, b) => {
			const aTime = new Date(a.createdAt).getTime()
			const bTime = new Date(b.createdAt).getTime()

			return sortDirection === 'newest' ? bTime - aTime : aTime - bTime
		})

		return items
	}, [notifications, statusFilter, sortDirection, search])

	return (
		<section className="parent-shell">
			<Sidenavbar
				user={user}
				activeSection={activeSection}
				onChangeSection={setActiveSection}
				onLogout={onLogout}
			/>

			<div className="parent-main">
				<header className="parent-main__header">
					<h1>Booking Dashboard</h1>
					<p>View and manage your school service bookings</p>
				</header>

				{activeSection === 'dashboard' ? (
					<>
						<section className="stats-grid">
							<Card>
								<CardHeader>
									<CardTitle>{summary.total}</CardTitle>
									<CardDescription>Total Bookings</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>{summary.pending}</CardTitle>
									<CardDescription>Pending</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>{summary.approved}</CardTitle>
									<CardDescription>Active / Approved</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>{summary.completed}</CardTitle>
									<CardDescription>Completed</CardDescription>
								</CardHeader>
							</Card>
						</section>

						<section className="toolbar-grid">
							<Input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Search bookings..."
							/>

							<Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
								{statusOptions.map((status) => (
									<option key={status} value={status}>
										{status === 'all' ? 'All Status' : status}
									</option>
								))}
							</Select>

							<Select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}>
								<option value="newest">Newest</option>
								<option value="oldest">Oldest</option>
							</Select>
						</section>

						{loading ? <p className="state-text">Loading dashboard data...</p> : null}
						{error ? <p className="state-text state-text--error">{error}</p> : null}
						{!loading && filteredItems.length === 0 ? (
							<p className="state-text">No items found for your current filters.</p>
						) : null}

						<section className="cards-grid">
							{filteredItems.map((item) => (
								<Card key={item._id}>
									<CardHeader className="item-head">
										<div>
											<CardTitle>{item.title}</CardTitle>
											<CardDescription>{formatDate(item.createdAt)}</CardDescription>
										</div>
										<span className={`status-chip ${item.status}`}>{item.status}</span>
									</CardHeader>

									<CardContent>
										<p className="item-message">{item.message}</p>
										<p className="item-meta">
											<strong>Account:</strong> {user.fullName} ({user.role})
										</p>

										{!item.read ? (
											<Button size="sm" onClick={() => markRead(item._id)}>
												Mark as Read
											</Button>
										) : (
											<Button variant="secondary" size="sm" disabled>
												Completed
											</Button>
										)}
									</CardContent>
								</Card>
							))}
						</section>
					</>
				) : null}

				{activeSection !== 'dashboard' ? (
					<Card>
						<CardHeader>
							<CardTitle>{activeSection === 'service' ? 'Service Request' : 'History'}</CardTitle>
							<CardDescription>
								This section is prepared and ready for your next backend endpoint integration.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="item-message">
								For now, continue using Dashboard to view account updates while we connect your specific booking records.
							</p>
						</CardContent>
					</Card>
				) : null}
			</div>
		</section>
	)
}
