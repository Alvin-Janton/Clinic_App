import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import AccessLogs from './AccessLogs'
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  HeartPulse,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import {
  ApiError,
  MOCK_ENABLED,
  api,
  type ExportResult,
  type Patient,
  type PatientDetail,
  type RecordPage,
  type User,
  type Visit,
} from './api'

const PAGE_SIZE = 20
const SESSION_CHANNEL = 'clinic-session'
const ACCOUNT_NAMES: Record<number, string> = {
  1: 'Andy Sotomayor',
  2: 'Elodie Coleman',
  3: 'Jacob Schnellinger',
  4: 'Kwesi Mcneishie',
}
const DEMO_ACCOUNTS = [
  { username: 'andy', name: 'Andy Sotomayor', role: 'Manager' },
  { username: 'elodie', name: 'Elodie Coleman', role: 'Volunteer' },
  { username: 'jacob', name: 'Jacob Schnellinger', role: 'Volunteer' },
  { username: 'kwesi', name: 'Kwesi Mcneishie', role: 'Volunteer' },
] as const

type ExportState =
  | { kind: 'success'; result: ExportResult }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }
  | null

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function birthDate(value: string): string {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function visitDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function ClinicBrand() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white">
        <HeartPulse aria-hidden="true" size={22} strokeWidth={2} />
      </span>
      <div className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-[#18302e]">Homestead Community</span>
        <span className="block truncate text-xs font-medium text-slate-500">Health Clinic</span>
      </div>
    </div>
  )
}

function LoginScreen({ onLogin, serviceError }: {
  onLogin: (username: string, password: string) => Promise<void>
  serviceError: string
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onLogin(username.trim(), password)
    } catch (cause) {
      setError(messageFrom(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <header className="mx-auto flex max-w-6xl items-center px-5 py-6 sm:px-8">
        <ClinicBrand />
      </header>
      <main className="mx-auto grid min-h-[calc(100vh-104px)] w-full max-w-6xl items-center px-5 pb-16 sm:px-8">
        <div className="mx-auto w-full max-w-[420px] py-8">
          <div className="mb-8">
            <span className="mb-5 flex size-12 items-center justify-center rounded-md border border-teal-200 bg-teal-50 text-teal-700">
              <LockKeyhole aria-hidden="true" size={23} />
            </span>
            <h1 className="text-3xl font-semibold text-[#18302e]">Staff sign in</h1>
            <p className="mt-2 text-sm text-slate-600">Homestead Community Health Clinic</p>
          </div>

          <form onSubmit={submit} className="space-y-5" aria-label="Staff sign in">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-[#18302e]">Username</label>
              <input
                id="username"
                autoComplete="username"
                className="field"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="First name"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#18302e]">Password</label>
              <input
                id="password"
                autoComplete="current-password"
                className="field"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {(error || serviceError) && (
              <div role="alert" className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
                <CircleAlert aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
                <span>{error || serviceError}</span>
              </div>
            )}
            <button type="submit" disabled={busy} className="primary-button w-full justify-center">
              {busy ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> : <ArrowRight aria-hidden="true" size={17} />}
              Sign in
            </button>
          </form>

          <div className="mt-9 border-t border-slate-200 pt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase text-slate-500">Demo accounts</h2>
              <span className="text-xs text-slate-500">Password: <code>password</code></span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => { setUsername(account.username); setPassword('password'); setError('') }}
                  className={`demo-account ${username === account.username ? 'demo-account-selected' : ''}`}
                >
                  <span className="block truncate text-sm font-medium">{account.name}</span>
                  <span className="block text-xs text-slate-500">{account.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

const STATUS_STYLE: Record<Visit['status'], { badge: string; dot: string }> = {
  scheduled: { badge: 'border-blue-200 bg-blue-50 text-blue-800', dot: 'bg-blue-600' },
  arrived: { badge: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  missed: { badge: 'border-amber-200 bg-amber-50 text-amber-900', dot: 'bg-amber-500' },
  cancelled: { badge: 'border-slate-200 bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
}

function accountName(id: number | null): string {
  return id === null ? 'Unassigned' : ACCOUNT_NAMES[id] ?? `User #${id}`
}

function patientNumber(id: number): string {
  return `#${String(id).padStart(4, '0')}`
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function VisitRow({ visit }: { visit: Visit }) {
  const style = STATUS_STYLE[visit.status]
  return (
    <li className="relative pb-5 pl-6 last:pb-0">
      <span aria-hidden="true" className={`absolute left-0 top-1.5 size-2.5 rounded-full ring-4 ring-white ${style.dot}`} />
      <div className="rounded-md border border-slate-200 bg-white p-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold text-[#18302e]">
            <span className="font-medium text-slate-500">Reason for visit: </span>{titleCase(visit.reason)}
          </p>
          <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${style.badge}`}>{titleCase(visit.status)}</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
          <CalendarDays aria-hidden="true" size={13} className="shrink-0" />
          <time dateTime={visit.scheduled_at}>{visitDate(visit.scheduled_at)}</time>
        </p>
        <p className="mt-1 text-xs text-slate-500">Recorded by {accountName(visit.recorded_by_user_id)}</p>
      </div>
    </li>
  )
}

type DetailError = { message: string; status: number }

function detailErrorTitle(error: DetailError): string {
  if (error.status === 403) return 'Access restricted'
  if (error.status === 404) return 'Record not found'
  if (error.status === 0) return 'Clinic service unavailable'
  return 'Record could not be loaded'
}

function PatientPanel({ detail, loading, error, onClose }: {
  detail: PatientDetail | null
  loading: boolean
  error: DetailError | null
  onClose: () => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      opener?.focus()
    }
  }, [onClose])

  const title = detail ? `${detail.patient.first_name} ${detail.patient.last_name}` : 'Patient details'

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[#102a28]/40" />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="patient-panel-title" className="relative flex h-full w-full flex-col bg-[#f6f8f7] shadow-2xl sm:max-w-[480px] sm:border-l sm:border-slate-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Patient record</p>
          <button ref={closeRef} type="button" title="Close details" aria-label="Close patient details" onClick={onClose} className="icon-button">
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div role="status" className="space-y-4 px-5 py-6 sm:px-6">
              <span className="sr-only">Loading record</span>
              <div className="flex items-center gap-4"><div className="size-14 animate-pulse rounded-md bg-slate-200" /><div className="flex-1 space-y-2"><div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" /><div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" /></div></div>
              <div className="h-20 animate-pulse rounded-md bg-slate-200" />
              <div className="h-24 animate-pulse rounded-md bg-slate-200" />
            </div>
          )}

          {error && (
            <div role="alert" className="m-5 flex gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:m-6">
              {error.status === 403 ? <LockKeyhole aria-hidden="true" size={18} className="mt-0.5 shrink-0" /> : <CircleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0" />}
              <div><p className="font-semibold">{detailErrorTitle(error)}</p><p className="mt-0.5">{error.message}</p></div>
            </div>
          )}

          {detail && (
            <>
              <section className="border-b border-slate-200 bg-white px-5 pb-6 pt-6 sm:px-6">
                <div className="flex items-center gap-4">
                  <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-md bg-teal-50 text-lg font-semibold text-teal-800 ring-1 ring-teal-100">
                    {initials(detail.patient.first_name, detail.patient.last_name)}
                  </span>
                  <div className="min-w-0">
                    <h2 id="patient-panel-title" className="truncate text-xl font-semibold text-[#18302e] sm:text-2xl">{title}</h2>
                    <p className="mt-0.5 font-mono text-sm text-slate-500">Patient {patientNumber(detail.patient.id)}</p>
                  </div>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
                  <div className="bg-white p-3.5"><dt className="text-xs font-medium text-slate-500">Date of birth</dt><dd className="mt-1 text-sm font-semibold text-[#18302e]">{birthDate(detail.patient.birth_date)}</dd></div>
                  <div className="bg-white p-3.5"><dt className="text-xs font-medium text-slate-500">Assigned volunteer</dt><dd className="mt-1 truncate text-sm font-semibold text-[#18302e]">{accountName(detail.patient.assigned_volunteer_id)}</dd></div>
                </dl>
              </section>

              <section aria-labelledby="visits-heading" className="px-5 py-6 sm:px-6">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h3 id="visits-heading" className="text-sm font-semibold text-[#18302e]">Visits</h3>
                  <span className="text-xs text-slate-500">{detail.visits.length} total</span>
                </div>
                {detail.visits.length ? (
                  <ol className="relative before:absolute before:bottom-2 before:left-[4.5px] before:top-2 before:w-px before:bg-slate-200">
                    {detail.visits.map((visit) => <VisitRow key={visit.id} visit={visit} />)}
                  </ol>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">No visits recorded for this patient.</p>
                )}
              </section>
            </>
          )}
          {!detail && <h2 id="patient-panel-title" className="sr-only">{title}</h2>}
        </div>
      </aside>
    </div>
  )
}

function PatientRow({ patient, active, onOpen }: { patient: Patient; active: boolean; onOpen: () => void }) {
  const name = `${patient.first_name} ${patient.last_name}`
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open record for ${name}, patient ${patientNumber(patient.id)}`}
        className={`record-row group grid w-full text-left ${active ? 'bg-[#eef7f4]' : ''}`}
      >
        <span className="font-mono text-xs text-slate-500">{patientNumber(patient.id)}</span>
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-[#eef3f2] text-xs font-semibold text-teal-800 sm:flex">{initials(patient.first_name, patient.last_name)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#18302e]">{name}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500 md:hidden">{birthDate(patient.birth_date)} · {accountName(patient.assigned_volunteer_id)}</span>
          </span>
        </span>
        <span className="hidden text-sm text-slate-700 md:block">{birthDate(patient.birth_date)}</span>
        <span className={`hidden truncate text-sm md:block ${patient.assigned_volunteer_id === null ? 'italic text-slate-400' : 'text-slate-700'}`}>{accountName(patient.assigned_volunteer_id)}</span>
        <ChevronRight aria-hidden="true" size={17} className="text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700" />
      </button>
    </li>
  )
}

function RecordsWorkspace({ user, onSignOut, onExpired }: {
  user: User
  onSignOut: () => void
  onExpired: () => void
}) {
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [records, setRecords] = useState<RecordPage | null>(null)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState('')
  const [activePatient, setActivePatient] = useState<number | null>(null)
  const [detail, setDetail] = useState<PatientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<DetailError | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportState, setExportState] = useState<ExportState>(null)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [view, setView] = useState('records')

  useEffect(() => {
    const controller = new AbortController()
    setRecordsLoading(true)
    setRecordsError('')
    api.records(page, PAGE_SIZE, controller.signal)
      .then(setRecords)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) onExpired()
        else setRecordsError(messageFrom(cause))
      })
      .finally(() => { if (!controller.signal.aborted) setRecordsLoading(false) })
    return () => controller.abort()
  }, [page, reload, onExpired])

  async function openPatient(id: number) {
    setActivePatient(id)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      setDetail(await api.record(id))
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired()
      else setDetailError({ message: messageFrom(cause), status: cause instanceof ApiError ? cause.status : -1 })
    } finally {
      setDetailLoading(false)
    }
  }

  const closePatient = useCallback(() => setActivePatient(null), [])

  async function createExport() {
    setExportBusy(true)
    setExportState(null)
    try {
      setExportState({ kind: 'success', result: await api.createExport() })
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired()
      else if (cause instanceof ApiError && cause.status === 403) setExportState({ kind: 'denied' })
      else setExportState({ kind: 'error', message: messageFrom(cause) })
    } finally {
      setExportBusy(false)
    }
  }

  async function signOut() {
    setSignOutBusy(true)
    try {
      await api.logout()
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel(SESSION_CHANNEL)
        channel.postMessage('signed-out')
        channel.close()
      }
      onSignOut()
    } catch (cause) {
      setRecordsError(messageFrom(cause))
    } finally {
      setSignOutBusy(false)
    }
  }

  const isManager = user.role === 'manager'
  const pageCount = Math.max(1, Math.ceil((records?.total ?? 0) / PAGE_SIZE))
  const rangeStart = records?.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const rangeEnd = records ? Math.min(page * PAGE_SIZE, records.total) : 0

  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-7">
          <ClinicBrand />
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-semibold text-[#18302e]">{user.first_name} {user.last_name}</p>
              <p className="text-xs capitalize text-slate-500">{user.role}</p>
            </div>
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-800">
              {initials(user.first_name, user.last_name)}
            </span>
            <button type="button" onClick={signOut} disabled={signOutBusy} title="Sign out" aria-label="Sign out" className="icon-button">
              {signOutBusy ? <LoaderCircle aria-hidden="true" size={18} className="animate-spin" /> : <LogOut aria-hidden="true" size={18} />}
            </button>
          </div>
        </div>
        {isManager && (
          <nav aria-label="Workspace views" className="mx-auto flex max-w-7xl gap-6 px-4 sm:px-7">
            {[['records', 'Patient records'], ['logs', 'Access logs']].map(([id, label]) => (
              <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id ?? 'records')} className={`-mb-px border-b-2 py-3 text-sm font-semibold transition-colors ${view === id ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-[#18302e]'}`}>{label}</button>
            ))}
          </nav>
        )}
      </header>

      {view === 'logs' && isManager ? <AccessLogs onExpired={onExpired} /> : (
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-7 sm:pt-9">
          <div className="grid gap-5 sm:flex sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-700"><UsersRound aria-hidden="true" size={15} /> Clinic workspace</div>
              <h1 className="text-2xl font-semibold text-[#18302e] sm:text-3xl">Patient records</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                <span>{isManager ? 'All clinic patients' : 'Patients assigned to you'}</span>
                <span aria-hidden="true" className="text-slate-300">|</span>
                <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" size={14} /> October 1–7, 2026</span>
              </p>
            </div>
            <button type="button" onClick={createExport} disabled={exportBusy} className="primary-button justify-center sm:min-w-[156px]">
              {exportBusy ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> : isManager ? <ArrowDownToLine aria-hidden="true" size={17} /> : <LockKeyhole aria-hidden="true" size={17} />}
              Export JSON
            </button>
          </div>

          {exportState && (
            <div role="status" className={`mt-6 flex flex-wrap items-center justify-between gap-4 rounded-md border px-4 py-3.5 text-sm ${exportState.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : exportState.kind === 'denied' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
              {exportState.kind === 'success' ? (
                <>
                  <div className="flex min-w-0 items-center gap-3"><Check aria-hidden="true" size={18} className="shrink-0" /><span><strong>Export ready.</strong> {exportState.result.patient_count} patients and {exportState.result.visit_count} visits.</span></div>
                  <a className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-2" href={`/exports/${encodeURIComponent(exportState.result.id)}`} target="_blank" rel="noopener noreferrer">Open JSON <ExternalLink aria-hidden="true" size={15} /></a>
                </>
              ) : exportState.kind === 'denied' ? (
                <div className="flex items-center gap-3"><LockKeyhole aria-hidden="true" size={18} className="shrink-0" /><span><strong>Export denied.</strong> Manager access required.</span></div>
              ) : (
                <div className="flex items-center gap-3"><CircleAlert aria-hidden="true" size={18} className="shrink-0" /><span>{exportState.message}</span></div>
              )}
            </div>
          )}

          <section aria-labelledby="patients-heading" className="mt-7 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <h2 id="patients-heading" className="text-base font-semibold text-[#18302e]">Patients</h2>
                <span className="rounded bg-[#eef3f2] px-2 py-0.5 text-xs font-semibold text-slate-700">{records?.total ?? '–'}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800"><ShieldCheck aria-hidden="true" size={14} /> {isManager ? 'Manager access' : 'Assigned records only'}</span>
            </div>

            <div aria-hidden="true" className="record-row hidden border-b border-slate-200 bg-[#f8faf9] text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
              <span>ID</span><span>Patient</span><span>Birth date</span><span>Assigned volunteer</span><span />
            </div>

            {recordsError ? (
              <div role="alert" className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <CircleAlert aria-hidden="true" size={24} className="text-rose-600" />
                <p className="max-w-sm text-sm text-rose-900">{recordsError}</p>
                <button type="button" onClick={() => setReload((value) => value + 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-[#18302e] hover:bg-slate-50">Try again</button>
              </div>
            ) : recordsLoading ? (
              <div role="status" aria-label="Loading patients">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="record-row grid">
                    <div className="h-3 w-10 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-40 max-w-full animate-pulse rounded bg-slate-200" />
                    <div className="hidden h-3 w-24 animate-pulse rounded bg-slate-200 md:block" />
                    <div className="hidden h-3 w-28 animate-pulse rounded bg-slate-200 md:block" />
                    <span />
                  </div>
                ))}
              </div>
            ) : records?.items.length ? (
              <ul aria-label={`Patients, page ${page} of ${pageCount}`}>
                {records.items.map((patient) => <PatientRow key={patient.id} patient={patient} active={activePatient === patient.id} onOpen={() => openPatient(patient.id)} />)}
              </ul>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
                <UserRound aria-hidden="true" size={24} className="text-slate-400" />
                <p className="font-medium text-[#18302e]">No patients to show</p>
                <p>{isManager ? 'There are no patient records yet.' : 'No patients assigned to this account.'}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#f8faf9] px-4 py-3 text-sm text-slate-600 sm:px-5">
              <span aria-live="polite">{recordsLoading ? 'Loading…' : `Showing ${rangeStart}–${rangeEnd} of ${records?.total ?? 0}`}</span>
              <div className="flex items-center gap-2">
                <button type="button" title="Previous page" aria-label="Previous page" disabled={page <= 1 || recordsLoading} onClick={() => setPage((value) => value - 1)} className="icon-button border border-slate-200 bg-white"><ChevronLeft aria-hidden="true" size={17} /></button>
                <span className="min-w-[88px] text-center text-xs font-medium">Page {page} of {pageCount}</span>
                <button type="button" title="Next page" aria-label="Next page" disabled={page >= pageCount || recordsLoading} onClick={() => setPage((value) => value + 1)} className="icon-button border border-slate-200 bg-white"><ChevronRight aria-hidden="true" size={17} /></button>
              </div>
            </div>
          </section>
        </main>
      )}

      {activePatient !== null && <PatientPanel detail={detail} loading={detailLoading} error={detailError} onClose={closePatient} />}
    </div>
  )
}


function ExportViewer({ exportId }: { exportId: string }) {
  const [content, setContent] = useState('Loading export...')

  useEffect(() => {
    api.export(exportId)
      .then((payload) => setContent(JSON.stringify(payload, null, 2)))
      .catch((cause: unknown) => setContent(JSON.stringify({ detail: messageFrom(cause) })))

    if (!('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel(SESSION_CHANNEL)
    channel.onmessage = (event: MessageEvent) => {
      if (event.data === 'signed-out') window.location.reload()
    }
    return () => channel.close()
  }, [exportId])

  return <main className="min-h-screen bg-white p-4 text-[#18302e]"><pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm">{content}</pre></main>
}

function ClinicApp() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [serviceError, setServiceError] = useState('')

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch((cause: unknown) => {
        if (!(cause instanceof ApiError && cause.status === 401)) setServiceError(messageFrom(cause))
      })
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center gap-3 bg-[#f6f8f7] text-sm text-slate-600"><LoaderCircle aria-hidden="true" size={20} className="animate-spin" /> Opening clinic workspace</div>
  }

  if (!user) {
    return <LoginScreen serviceError={serviceError} onLogin={async (username, password) => { const signedIn = await api.login(username, password); setServiceError(''); setUser(signedIn) }} />
  }

  return <RecordsWorkspace user={user} onSignOut={() => setUser(null)} onExpired={() => setUser(null)} />
}

function MockBanner() {
  return (
    <div role="note" className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-950">
      Preview demo: synthetic data from a mock API, not connected to the clinic backend.
    </div>
  )
}

function App() {
  const exportId = window.location.pathname.match(/^\/exports\/([^/]+)$/)?.[1]
  return (
    <>
      {MOCK_ENABLED && <MockBanner />}
      {exportId ? <ExportViewer exportId={decodeURIComponent(exportId)} /> : <ClinicApp />}
    </>
  )
}

export default App
