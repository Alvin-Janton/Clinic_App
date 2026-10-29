import { useEffect, useState, type FormEvent } from 'react'
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
  1: 'Royce Barrera',
  2: 'Alvin Janton',
  3: 'Alexa Llaneras',
  4: 'Andy Ocampo',
}
const DEMO_ACCOUNTS = [
  { username: 'royce', name: 'Royce Barrera', role: 'Manager' },
  { username: 'alvin', name: 'Alvin Janton', role: 'Volunteer' },
  { username: 'alexa', name: 'Alexa Llaneras', role: 'Volunteer' },
  { username: 'andy', name: 'Andy Ocampo', role: 'Volunteer' },
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
  const [year, month, day] = value.split('-').map(Number)
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

function VisitRow({ visit }: { visit: Visit }) {
  const statusStyle: Record<Visit['status'], string> = {
    scheduled: 'bg-blue-50 text-blue-800',
    arrived: 'bg-emerald-50 text-emerald-800',
    missed: 'bg-amber-50 text-amber-800',
    cancelled: 'bg-slate-100 text-slate-700',
  }
  return (
    <li className="border-b border-slate-100 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#18302e]"><span className="font-medium text-slate-500">Reason for visit: </span>{titleCase(visit.reason)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays aria-hidden="true" size={13} /> {visitDate(visit.scheduled_at)}
          </p>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-[11px] font-semibold ${statusStyle[visit.status]}`}>
          {titleCase(visit.status)}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">Recorded by {ACCOUNT_NAMES[visit.recorded_by_user_id] ?? `User ${visit.recorded_by_user_id}`}</p>
    </li>
  )
}

function PatientPanel({ detail, loading, error, onClose }: {
  detail: PatientDetail | null
  loading: boolean
  error: string
  onClose: () => void
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close patient details" onClick={onClose} className="absolute inset-0 bg-[#102a28]/35" />
      <aside role="dialog" aria-modal="true" aria-label="Patient details" className="relative flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <span className="text-xs font-semibold uppercase text-slate-500">Patient record</span>
          <button type="button" title="Close details" aria-label="Close details" onClick={onClose} className="icon-button">
            <X aria-hidden="true" size={19} />
          </button>
        </div>
        {loading && <div className="flex items-center gap-2 px-7 py-10 text-sm text-slate-500"><LoaderCircle aria-hidden="true" size={18} className="animate-spin" /> Loading record</div>}
        {error && <p role="alert" className="m-6 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {detail && !loading && (
          <div className="px-5 py-7 sm:px-7">
            <div className="flex size-12 items-center justify-center rounded-md bg-teal-50 text-teal-700">
              <UserRound aria-hidden="true" size={23} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-[#18302e]">{detail.patient.first_name} {detail.patient.last_name}</h2>
            <p className="mt-1 text-sm text-slate-500">Patient #{String(detail.patient.id).padStart(4, '0')}</p>

            <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-5 border-y border-slate-200 py-6">
              <div><dt className="text-xs font-medium text-slate-500">Date of birth</dt><dd className="mt-1 text-sm font-medium text-[#18302e]">{birthDate(detail.patient.birth_date)}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Assigned volunteer</dt><dd className="mt-1 text-sm font-medium text-[#18302e]">{detail.patient.assigned_volunteer_id ? ACCOUNT_NAMES[detail.patient.assigned_volunteer_id] : 'Unassigned'}</dd></div>
            </dl>

            <div className="mt-8 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#18302e]">Visits</h3>
              <span className="text-xs text-slate-500">{detail.visits.length} total</span>
            </div>
            <ul className="mt-2">{detail.visits.map((visit) => <VisitRow visit={visit} key={visit.id} />)}</ul>
          </div>
        )}
      </aside>
    </div>
  )
}

function PatientRow({ patient, onOpen }: { patient: Patient; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="record-row group grid w-full text-left">
      <span className="font-mono text-xs text-slate-500">{String(patient.id).padStart(4, '0')}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[#18302e] group-hover:text-teal-700">{patient.first_name} {patient.last_name}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500 md:hidden">{birthDate(patient.birth_date)} | {patient.assigned_volunteer_id ? ACCOUNT_NAMES[patient.assigned_volunteer_id] : 'Unassigned'}</span>
      </span>
      <span className="hidden text-sm text-slate-600 md:block">{birthDate(patient.birth_date)}</span>
      <span className="hidden truncate text-sm text-slate-600 md:block">{patient.assigned_volunteer_id ? ACCOUNT_NAMES[patient.assigned_volunteer_id] : 'Unassigned'}</span>
      <ChevronRight aria-hidden="true" size={17} className="text-slate-400 group-hover:text-teal-700" />
    </button>
  )
}

function RecordsWorkspace({ user, onSignOut, onExpired }: {
  user: User
  onSignOut: () => void
  onExpired: () => void
}) {
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState<RecordPage | null>(null)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState('')
  const [activePatient, setActivePatient] = useState<number | null>(null)
  const [detail, setDetail] = useState<PatientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportState, setExportState] = useState<ExportState>(null)
  const [signOutBusy, setSignOutBusy] = useState(false)

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
  }, [page, onExpired])

  async function openPatient(id: number) {
    setActivePatient(id)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      setDetail(await api.record(id))
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired()
      else setDetailError(messageFrom(cause))
    } finally {
      setDetailLoading(false)
    }
  }

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

  const pageCount = Math.max(1, Math.ceil((records?.total ?? 0) / PAGE_SIZE))
  const rangeStart = records?.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const rangeEnd = records ? Math.min(page * PAGE_SIZE, records.total) : 0

  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-7">
          <ClinicBrand />
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-[#18302e]">{user.first_name} {user.last_name}</p>
              <p className="text-xs capitalize text-slate-500">{user.role}</p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-800">
              {user.first_name[0]}{user.last_name[0]}
            </span>
            <button type="button" onClick={signOut} disabled={signOutBusy} title="Sign out" aria-label="Sign out" className="icon-button">
              {signOutBusy ? <LoaderCircle aria-hidden="true" size={18} className="animate-spin" /> : <LogOut aria-hidden="true" size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-7 sm:pt-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-700"><UsersRound aria-hidden="true" size={15} /> Clinic workspace</div>
            <h1 className="text-2xl font-semibold text-[#18302e] sm:text-3xl">Patient records</h1>
            <p className="mt-2 text-sm text-slate-600">{user.role === 'manager' ? 'All clinic patients' : 'Patients assigned to you'} | October 1-7, 2026</p>
          </div>
          <button type="button" onClick={createExport} disabled={exportBusy} className="primary-button min-w-[156px] justify-center">
            {exportBusy ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> : user.role === 'manager' ? <ArrowDownToLine aria-hidden="true" size={17} /> : <LockKeyhole aria-hidden="true" size={17} />}
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

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-[#18302e]">Patients</h2>
            <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{records?.total ?? '-'}</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck aria-hidden="true" size={15} /> {user.role === 'manager' ? 'Manager access' : 'Assigned records only'}</span>
        </div>

        {recordsError && <p role="alert" className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{recordsError}</p>}
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="record-row hidden bg-[#eef3f2] text-xs font-semibold uppercase text-slate-600 md:grid">
            <span>ID</span><span>Patient</span><span>Birth date</span><span>Assigned volunteer</span><span />
          </div>
          {recordsLoading ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle aria-hidden="true" size={18} className="animate-spin" /> Loading patients</div>
          ) : records?.items.length ? (
            records.items.map((patient) => <PatientRow key={patient.id} patient={patient} onOpen={() => openPatient(patient.id)} />)
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500"><UserRound aria-hidden="true" size={22} /> No patients assigned to this account.</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>{recordsLoading ? 'Loading...' : `Showing ${rangeStart}-${rangeEnd} of ${records?.total ?? 0}`}</span>
          <div className="flex items-center gap-2">
            <button type="button" title="Previous page" aria-label="Previous page" disabled={page <= 1 || recordsLoading} onClick={() => setPage((value) => value - 1)} className="icon-button border border-slate-200 bg-white"><ChevronLeft aria-hidden="true" size={17} /></button>
            <span className="min-w-[80px] text-center text-xs font-medium">Page {page} of {pageCount}</span>
            <button type="button" title="Next page" aria-label="Next page" disabled={page >= pageCount || recordsLoading} onClick={() => setPage((value) => value + 1)} className="icon-button border border-slate-200 bg-white"><ChevronRight aria-hidden="true" size={17} /></button>
          </div>
        </div>
      </main>

      {activePatient !== null && <PatientPanel detail={detail} loading={detailLoading} error={detailError} onClose={() => setActivePatient(null)} />}
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

function App() {
  const exportMatch = window.location.pathname.match(/^\/exports\/([^/]+)$/)
  return exportMatch ? <ExportViewer exportId={decodeURIComponent(exportMatch[1])} /> : <ClinicApp />
}

export default App
