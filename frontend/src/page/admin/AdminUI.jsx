import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Ban, CircleCheck, CircleX, Clock3, HelpCircle, ShieldAlert } from 'lucide-react'

const statusIcons = {
  active: CircleCheck,
  approved: CircleCheck,
  verified: CircleCheck,
  resolved: CircleCheck,
  reviewing: Clock3,
  pending: Clock3,
  suspended: ShieldAlert,
  banned: Ban,
  declined: CircleX,
  rejected: CircleX,
  closed: CircleX,
  warning: AlertTriangle,
}

export function StatusBadge({ status, label }) {
  const normalized = String(status || 'unknown').toLowerCase()
  const Icon = statusIcons[normalized] || HelpCircle
  return (
    <span className={`admin-status-badge admin-status-badge--${normalized}`}>
      <Icon size={15} aria-hidden="true" />
      <span>{label || normalized.replaceAll('_', ' ')}</span>
    </span>
  )
}

export function EmptyState({ children }) {
  return <p className="admin-empty-state" role="status">{children}</p>
}

export function TableLoading({ label = 'Loading records…' }) {
  return (
    <div className="admin-table-loading" role="status" aria-live="polite">
      <span className="admin-loading-indicator" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  requireText,
  busy = false,
  returnFocusRef,
  onClose,
  onConfirm,
}) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const [typedValue, setTypedValue] = useState('')
  onCloseRef.current = onClose

  useEffect(() => {
    setTypedValue('')
  }, [open, requireText])

  useEffect(() => {
    if (!open) return undefined

    const previousFocus = document.activeElement
    const focusTarget = requireText ? inputRef.current : dialogRef.current?.querySelector('button')
    window.requestAnimationFrame(() => focusTarget?.focus())

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onCloseRef.current()
      }
      if (event.key !== 'Tab') return

      const focusableElements = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusableElements?.length) return
      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.requestAnimationFrame(() => {
        if (returnFocusRef?.current?.isConnected) returnFocusRef.current.focus()
        else if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
      })
    }
  }, [busy, open, requireText, returnFocusRef])

  if (!open) return null

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCloseRef.current()
    }}>
      <section
        ref={dialogRef}
        className="admin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-description"
      >
        <h2 id="admin-confirm-title">{title}</h2>
        <div id="admin-confirm-description" className="admin-confirm-dialog__content">{children}</div>
        {requireText && (
          <label className="admin-confirm-dialog__input-label">
            Type {requireText} to confirm
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
            />
          </label>
        )}
        <div className="admin-confirm-dialog__actions">
          <button type="button" className="admin-button admin-button--secondary" onClick={() => onCloseRef.current()} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            data-confirm-action
            className="admin-button admin-button--danger"
            onClick={onConfirm}
            disabled={busy || (Boolean(requireText) && typedValue !== requireText)}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
