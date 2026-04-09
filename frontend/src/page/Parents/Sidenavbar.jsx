import { Button } from '../../components/ui/button'

const menuItems = [
	{ key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
	{ key: 'service', label: 'Service Request', icon: 'add_circle' },
	{ key: 'history', label: 'History', icon: 'receipt_long' },
]

export default function Sidenavbar({ user, activeSection, onChangeSection, onLogout }) {
	return (
		<aside className="parent-sidebar">
			<div className="sidebar-brand">
				<div className="brand-logo">H&S</div>
				<div>
					<h2>H&S APP</h2>
					<p>{user.role === 'driver' ? 'Driver Panel' : 'Parent Panel'}</p>
				</div>
			</div>

			<div className="sidebar-user">
				<div className="avatar-pill">{user.fullName?.slice(0, 2).toUpperCase() || 'HS'}</div>
				<div>
					<h3>{user.fullName}</h3>
					<p>{user.role} account</p>
				</div>
			</div>

			<nav className="sidebar-menu">
				{menuItems.map((item) => (
					<button
						key={item.key}
						type="button"
						className={`menu-item ${activeSection === item.key ? 'active' : ''}`}
						onClick={() => onChangeSection(item.key)}
					>
						<span className="material-symbols-rounded" aria-hidden="true">
							{item.icon}
						</span>
						<span>{item.label}</span>
					</button>
				))}
			</nav>

			<div className="sidebar-foot">
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
