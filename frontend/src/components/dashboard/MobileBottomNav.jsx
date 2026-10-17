import { useEffect, useMemo, useState } from 'react'
import { LogOut, MoreHorizontal } from 'lucide-react'
import {
  getNavigationByRole,
  MOBILE_PRIMARY_NAVIGATION,
  SECONDARY_NAVIGATION,
} from '../../constants/dashboardNavigation'

function MobileBottomNav({
  role,
  currentPage,
  onNavigate,
  onLogout,
  badgeValues = {},
  notificationUnreadCount = 0,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const normalizedRole = role?.toLowerCase() || 'parent'

  const { primaryItems, moreItems } = useMemo(() => {
    const navigationItems = getNavigationByRole(normalizedRole)
    const primaryIds = MOBILE_PRIMARY_NAVIGATION[normalizedRole] || MOBILE_PRIMARY_NAVIGATION.parent
    return {
      primaryItems: primaryIds
        .map((id) => navigationItems.find((item) => item.id === id))
        .filter(Boolean),
      moreItems: navigationItems.filter((item) => !primaryIds.includes(item.id)),
    }
  }, [normalizedRole])

  const helpItem = SECONDARY_NAVIGATION[0]
  const HelpIcon = helpItem.icon
  const moreIsActive = moreItems.some((item) => item.id === currentPage) || helpItem.id === currentPage

  useEffect(() => {
    if (!moreOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [moreOpen])

  const navigateAndClose = (id) => {
    setMoreOpen(false)
    onNavigate(id)
  }

  const renderSlot = (item, active, onClick, badge = 0) => {
    const Icon = item.icon
    return (
      <button
        key={item.id}
        type="button"
        onClick={onClick}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        aria-expanded={item.id === 'more' ? moreOpen : undefined}
        aria-controls={item.id === 'more' ? 'mobile-more-sheet' : undefined}
        className={`mobile-bottom-nav__slot relative flex h-16 min-w-[44px] flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold ${
          active ? 'mobile-bottom-nav__slot--active' : 'text-slate-200'
        }`}
      >
        <span className="mobile-bottom-nav__indicator" aria-hidden="true" />
        <span className="relative">
          <Icon size={24} aria-hidden="true" />
          {badge > 0 && (
            <span className="absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1 text-sm font-bold leading-none text-white">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        <span className="max-w-full truncate leading-tight">{item.label}</span>
      </button>
    )
  }

  const moreButton = {
    id: 'more',
    label: 'More',
    icon: MoreHorizontal,
  }

  return (
    <>
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close More menu"
            className="mobile-bottom-nav__backdrop fixed inset-0 z-[30] bg-black/50 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <section
            id="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            className="mobile-bottom-nav__sheet fixed inset-x-0 bottom-0 z-[45] max-h-[min(75dvh,640px)] overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900 px-4 pt-3 text-slate-50 shadow-2xl md:hidden"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-500" aria-hidden="true" />
            <h2 className="mb-2 px-2 text-base font-semibold">More</h2>
            <nav aria-label="More">
              {moreItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateAndClose(item.id)}
                    aria-label={item.label}
                    aria-current={currentPage === item.id ? 'page' : undefined}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3 text-left text-slate-100 hover:bg-slate-800"
                  >
                    <Icon size={22} aria-hidden="true" />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => navigateAndClose(helpItem.id)}
                aria-label={helpItem.label}
                aria-current={currentPage === helpItem.id ? 'page' : undefined}
                className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3 text-left text-slate-100 hover:bg-slate-800"
              >
                <HelpIcon size={22} aria-hidden="true" />
                <span className="text-sm font-semibold">{helpItem.label}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false)
                  onLogout()
                }}
                aria-label="Logout"
                className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3 text-left text-slate-100 hover:bg-red-800"
              >
                <LogOut size={22} aria-hidden="true" />
                <span className="text-sm font-semibold">Logout</span>
              </button>
            </nav>
          </section>
        </>
      )}

      <nav
        aria-label="Primary"
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-[40] flex border-t border-slate-700 bg-slate-900 text-slate-50 md:hidden"
      >
        {primaryItems.map((item) => {
          const badge = item.id === 'messages'
            ? badgeValues.unreadMessageCount
            : item.id === 'notifications'
              ? notificationUnreadCount
              : 0
          return renderSlot(item, currentPage === item.id, () => onNavigate(item.id), Number(badge) || 0)
        })}
        {renderSlot(moreButton, moreIsActive || moreOpen, () => setMoreOpen((open) => !open))}
      </nav>
    </>
  )
}

export default MobileBottomNav
