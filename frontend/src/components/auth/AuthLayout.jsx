import { Link } from 'react-router-dom';
import { ArrowLeft, BusFront, ShieldCheck, MapPinned, BellRing } from 'lucide-react';
import './auth.css';

export default function AuthLayout({ title, subtitle, wide = false, children }) {
  return (
    <section className="auth-page">
      <nav className="auth-page-nav" aria-label="Home navigation">
        <Link to="/" className="auth-back"><ArrowLeft size={18} aria-hidden="true" /> Back to Home</Link>
      </nav>

      <div className="auth-page-content">
        <div className={`auth-panel${wide ? ' auth-panel--wide' : ''}`}>
          <Link to="/" className="auth-brand" aria-label="Hatid-Sundo home">
            <span className="auth-brand-icon"><BusFront size={22} aria-hidden="true" /></span>
            <span>Hatid-Sundo</span>
          </Link>

          <header className="auth-heading">
            <span className="auth-kicker">Trusted school transport</span>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </header>

          {children}
        </div>

        <aside className="auth-info" aria-label="Hatid-Sundo overview">
          <div className="auth-info-card">
            <div className="auth-info-icon"><ShieldCheck size={18} aria-hidden="true" /></div>
            <div>
              <strong>Verified rides</strong>
              <p>Parents can track drivers, vehicle details, and trip updates in real time.</p>
            </div>
          </div>
          <div className="auth-info-card">
            <div className="auth-info-icon"><MapPinned size={18} aria-hidden="true" /></div>
            <div>
              <strong>Live location</strong>
              <p>Know when the driver is on the way, nearby, or has reached the pickup point.</p>
            </div>
          </div>
          <div className="auth-info-card">
            <div className="auth-info-icon"><BellRing size={18} aria-hidden="true" /></div>
            <div>
              <strong>Clear updates</strong>
              <p>Receive simple trip notifications for pickup, arrival, and drop-off milestones.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
