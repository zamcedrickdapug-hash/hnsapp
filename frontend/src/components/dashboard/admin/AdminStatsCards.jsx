import { Activity, AlertTriangle, CheckCircle, Clock, Users, UserRoundCheck } from 'lucide-react'

const statIcons = {
  users: Users,
  pending: Clock,
  approved: CheckCircle,
  drivers: UserRoundCheck,
  issues: AlertTriangle,
  alerts: Activity,
}

export function AdminStatsCards({ stats = [], isLoading = false }) {
  return (
    <section className="admin-kpi-grid" aria-label="System overview">
      {stats.map((stat) => {
        const Icon = statIcons[stat.icon] || Activity
        return (
          <article className="admin-kpi-card" key={stat.label}>
            <div className="admin-kpi-card__heading">
              <span>{stat.label}</span>
              <Icon size={19} aria-hidden="true" />
            </div>
            <strong>{isLoading ? '—' : stat.value}</strong>
            <small>{stat.detail}</small>
          </article>
        )
      })}
    </section>
  )
}
