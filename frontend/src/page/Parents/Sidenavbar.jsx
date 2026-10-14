import { Button } from '../../components/ui/button'
import logo from '../../assets/logo.png'

const menuItems = [
	{ key: 'dashboard', label: 'Live Dashboard', icon: 'dashboard' },
	{ key: 'history', label: 'Trip History', icon: 'receipt_long' },
	{ key: 'settings', label: 'Settings', icon: 'settings' },
]

export default function Sidenavbar({ user, activeSection, onChangeSection, onLogout, isOpen, onToggle }) {
	return (
		<aside className={`parent-sidebar ${isOpen ? 'open' : 'collapsed'}`}>
			<div className="sidebar-brand">
				<button
					type="button"
					className="brand-logo sidebar-toggle-logo"
					onClick={onToggle}
					aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
				>
					<img src={logo} alt="H&S logo" className="brand-logo-image" />
				</button>
				{isOpen ? (
					<div>
					<h2>H&S APP</h2>
					<p>Parent Panel</p>
					</div>
				) : null}
			</div>

			<div className="sidebar-user">
				<div className="avatar-pill">{user.fullName?.slice(0, 2).toUpperCase() || 'HS'}</div>
				{isOpen ? (
					<div>
						<h3>{user.fullName}</h3>
						<p>{user.role} account</p>
					</div>
				) : null}
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
						{isOpen ? <span className="menu-item-label">{item.label}</span> : null}
					</button>
				))}
			</nav>

			<div className="sidebar-foot">
				<Button variant="secondary" onClick={onLogout} aria-label="Sign Out">
					<span className="material-symbols-rounded" aria-hidden="true">
						logout
					</span>
					{isOpen ? 'Sign Out' : null}
				</Button>
			</div>
		</aside>
	)
}
