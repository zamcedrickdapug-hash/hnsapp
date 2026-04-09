import { Button } from '../../components/ui/button'
import logo from '../../assets/logo.png'

const menuItems = [
	{ key: 'dashboard', label: 'Driver Dashboard', icon: 'local_taxi' },
	{ key: 'requests', label: 'Requests', icon: 'inbox' },
	{ key: 'settings', label: 'Settings', icon: 'settings' },
]

export default function Sidenavbar({ user, activeSection, onChangeSection, onLogout }) {
	return (
		<aside className="driver-sidebar">
			<div className="driver-sidebar__brand">
				<div className="driver-sidebar__logo">
					<img src={logo} alt="H&S logo" className="driver-sidebar__logo-image" />
				</div>
				<div>
					<h2>H&S APP</h2>
					<p>Driver Dashboard</p>
				</div>
			</div>

			<div className="driver-sidebar__user">
				<div className="driver-sidebar__avatar">{user.fullName?.slice(0, 2).toUpperCase() || 'DR'}</div>
				<div>
					<h3>{user.fullName}</h3>
					<p>driver account</p>
				</div>
			</div>

			<nav className="driver-sidebar__menu">
				{menuItems.map((item) => (
					<button
						key={item.key}
						type="button"
						className={`driver-menu-item ${activeSection === item.key ? 'active' : ''}`}
						onClick={() => onChangeSection(item.key)}
					>
						<span className="material-symbols-rounded" aria-hidden="true">
							{item.icon}
						</span>
						<span>{item.label}</span>
					</button>
				))}
			</nav>

			<div className="driver-sidebar__foot">
				<Button variant="secondary" onClick={onLogout}>
					<span className="material-symbols-rounded" aria-hidden="true">
						logout
					</span>
					Sign Out
				</Button>
			</div>
		</aside>
	)
}
