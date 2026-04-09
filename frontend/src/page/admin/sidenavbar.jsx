import logo from '../../assets/logo.png'

const menuItems = [
	{ key: 'dashboard', label: 'Dashboard', icon: 'public' },
	{ key: 'users', label: 'Users', icon: 'groups' },
	{ key: 'apply', label: 'Apply', icon: 'fact_check' },
]

export default function AdminSidenavbar({ user, activeSection, onChangeSection, onLogout }) {
	return (
		<aside className="admin-sidebar">
			<div className="admin-sidebar__brand">
				<div className="admin-sidebar__logo-wrap">
					<img src={logo} alt="H&S logo" className="admin-sidebar__logo" />
				</div>
				<div>
					<h2>H&S APP</h2>
					<p>Admin Control</p>
				</div>
			</div>

			<div className="admin-sidebar__user">
				<div className="admin-sidebar__avatar">{user?.fullName?.slice(0, 2)?.toUpperCase() || 'AD'}</div>
				<div>
					<h3>{user?.fullName || 'Admin'}</h3>
					<p>admin account</p>
				</div>
			</div>

			<nav className="admin-sidebar__menu">
				{menuItems.map((item) => (
					<button
						key={item.key}
						type="button"
						className={`admin-menu-item ${activeSection === item.key ? 'active' : ''}`}
						onClick={() => onChangeSection(item.key)}
					>
						<span className="material-symbols-rounded" aria-hidden="true">
							{item.icon}
						</span>
						<span>{item.label}</span>
					</button>
				))}
			</nav>

			<div className="admin-sidebar__foot">
				<button type="button" className="admin-signout-button" onClick={onLogout}>
					<span className="material-symbols-rounded" aria-hidden="true">
						logout
					</span>
					Sign Out
				</button>
			</div>
		</aside>
	)
}
