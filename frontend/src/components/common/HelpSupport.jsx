import { useMemo, useState } from 'react'
import { helpContent } from '../../data/helpContent'
import { supportConfig } from '../../config/supportConfig'

const roleLabels = {
  parent: 'Parent',
  driver: 'Driver',
  admin: 'Admin',
}

const isConfiguredValue = (value) =>
  typeof value === 'string' &&
  value.trim() !== '' &&
  !/^todo\b/i.test(value.trim()) &&
  value.trim().toLowerCase() !== 'support@example.com'

const phoneLinkValue = (value) => value.replace(/[^\d+]/g, '')

export default function HelpSupport({ role }) {
  const [search, setSearch] = useState('')
  const [openQuestion, setOpenQuestion] = useState(null)
  const faqs = helpContent[role] || []
  const normalizedSearch = search.trim().toLowerCase()
  const filteredFaqs = useMemo(
    () => faqs.filter(({ question, answer }) =>
      `${question} ${answer}`.toLowerCase().includes(normalizedSearch)
    ),
    [faqs, normalizedSearch]
  )
  const contactLines = [
    isConfiguredValue(supportConfig.supportEmail) && {
      label: 'Email',
      href: `mailto:${supportConfig.supportEmail}`,
      value: supportConfig.supportEmail,
    },
    isConfiguredValue(supportConfig.supportPhone) && {
      label: 'Phone',
      href: `tel:${phoneLinkValue(supportConfig.supportPhone)}`,
      value: supportConfig.supportPhone,
    },
    isConfiguredValue(supportConfig.supportHours) && {
      label: 'Hours',
      value: supportConfig.supportHours,
    },
  ].filter(Boolean)
  const theme = {
    card: 'border-slate-200 bg-white text-slate-900',
    muted: 'text-slate-600',
    divider: 'border-slate-200',
    focus: 'focus-visible:ring-2 focus-visible:ring-blue-600',
    accent: role === 'parent' ? 'text-blue-800' : 'text-indigo-800',
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6" aria-labelledby="help-support-title">
      <header>
        <p className={`text-sm font-semibold uppercase tracking-wide ${theme.accent}`}>Support</p>
        <h1 id="help-support-title" className="mt-1 text-2xl font-bold">Help &amp; Support</h1>
        <p className={`mt-2 ${theme.muted}`}>
          {roleLabels[role] || 'Account'} help, common questions, and safety information.
        </p>
      </header>

      <section className={`rounded-xl border p-5 shadow-sm ${theme.card}`} aria-labelledby="faq-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="faq-title" className="text-lg font-semibold">Frequently asked questions</h2>
            <p className={`mt-1 text-sm ${theme.muted}`}>Search answers relevant to your dashboard.</p>
          </div>
          <label className="w-full sm:max-w-sm">
            <span className="sr-only">Search help questions</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search help"
              className={`w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 focus-visible:outline-none ${theme.focus}`}
            />
          </label>
        </div>

        <div className={`mt-5 divide-y ${theme.divider}`}>
          {filteredFaqs.map(({ question, answer }, index) => {
            const questionId = `help-${role}-${index}-question`
            const answerId = `help-${role}-${index}-answer`
            const isOpen = openQuestion === questionId
            return (
              <div key={questionId} className="py-1">
                <h3>
                  <button
                    id={questionId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    onClick={() => setOpenQuestion(isOpen ? null : questionId)}
                    className={`flex w-full items-center justify-between gap-4 py-3 text-left font-medium hover:underline focus-visible:outline-none ${theme.focus}`}
                  >
                    <span>{question}</span>
                    <span aria-hidden="true" className="shrink-0 text-xl">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                </h3>
                {isOpen && (
                  <div
                    id={answerId}
                    role="region"
                    aria-labelledby={questionId}
                    className={`pb-4 pr-8 text-sm leading-6 ${theme.muted}`}
                  >
                    {answer}
                  </div>
                )}
              </div>
            )
          })}
          {filteredFaqs.length === 0 && (
            <p className={`py-6 text-sm ${theme.muted}`} role="status">
              No help questions match your search.
            </p>
          )}
        </div>
      </section>

      <section className={`rounded-xl border p-5 shadow-sm ${theme.card}`} aria-labelledby="contact-title">
        <h2 id="contact-title" className="text-lg font-semibold">Contact us</h2>
        {contactLines.length > 0 ? (
          <dl className="mt-3 space-y-2 text-sm">
            {contactLines.map(({ label, href, value }) => (
              <div key={label} className="flex flex-wrap gap-x-2">
                <dt className="font-semibold">{label}:</dt>
                <dd>
                  {href
                    ? <a className={`underline underline-offset-2 ${theme.accent}`} href={href}>{value}</a>
                    : value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={`mt-2 text-sm ${theme.muted}`}>
            Support contact details have not been configured yet.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm" aria-labelledby="safety-title">
        <h2 id="safety-title" className="font-semibold">Safety and reporting</h2>
        <p className="mt-2 text-sm leading-6">
          In an emergency, call local emergency services first. For a non-emergency problem, contact your administrator or support and include the trip date and a screenshot so the issue can be understood.
        </p>
        <p className="mt-2 text-sm leading-6">
          Privacy note: chat messages are saved so you can read the conversation after the trip. Avoid sending sensitive information that is not needed for transportation.
        </p>
      </section>

      <p className={`text-right text-sm ${theme.muted}`}>App version {supportConfig.appVersion}</p>
    </section>
  )
}
