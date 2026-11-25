// PREVIEW-ONLY MOCK. Synthetic data, in-memory only, never persisted to browser storage.
// Enabled only when VITE_CLINIC_MOCK=true. It mirrors the backend's role checks so the
// redesigned UI can be reviewed without the FastAPI service; it is NOT a security boundary.
import { ApiError, type AccessLogPage, type ClinicApi, type ExportResult, type Patient, type User, type Visit } from '../api'

const DEMO_PASSWORD = 'password' // public synthetic-demo password, as shown on the sign-in screen
const USERS: (User & { role: User['role'] })[] = [
  { id: 1, username: 'andy', first_name: 'Andy', last_name: 'Sotomayor', role: 'manager' },
  { id: 2, username: 'elodie', first_name: 'Elodie', last_name: 'Coleman', role: 'volunteer' },
  { id: 3, username: 'jacob', first_name: 'Jacob', last_name: 'Schnellinger', role: 'volunteer' },
  { id: 4, username: 'kwesi', first_name: 'Kwesi', last_name: 'Mcneishie', role: 'volunteer' },
]
const FIRST = ['Camila', 'Daniel', 'Elena', 'Gabriel', 'Isabel', 'Julian', 'Lucia', 'Mateo', 'Nadia', 'Omar', 'Sofia', 'Tomas', 'Valeria', 'Xavier', 'Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Felix']
const LAST = ['Acosta', 'Benitez', 'Castillo', 'Delgado', 'Espinoza', 'Fernandez', 'Garcia', 'Herrera', 'Iglesias', 'Jimenez', 'Lopez', 'Morales', 'Navarro', 'Ortiz', 'Perez', 'Quintero', 'Rivera', 'Sanchez', 'Torres', 'Vega']
const STATUSES: Visit['status'][] = ['scheduled', 'arrived', 'missed', 'cancelled']
const REASONS = ['vaccine', 'bloodwork', 'routine checkup']
const ASSIGNMENTS: (number | null)[] = [null, 2, 3, 4]

function pick<T>(list: readonly T[], n: number): T {
  return list[n % list.length] as T
}

function buildFixture() {
  let seed = 20261001
  const next = () => {
    // mulberry32: small deterministic PRNG for repeatable synthetic data
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) >>> 8
  }
  const patients: Patient[] = []
  const visits: Visit[] = []
  for (let id = 1; id <= 64; id += 1) {
    // Patient 1 and its first visit match reference/examples.json exactly (assigned to user 3, Jacob).
    const patient: Patient = id === 1
      ? { id: 1, first_name: 'Camila', last_name: 'Herrera', birth_date: '1989-06-14', assigned_volunteer_id: 3 }
      : {
          id,
          first_name: pick(FIRST, next()),
          last_name: pick(LAST, next()),
          birth_date: `${1960 + (next() % 37)}-${String(1 + (next() % 12)).padStart(2, '0')}-${String(1 + (next() % 28)).padStart(2, '0')}`,
          assigned_volunteer_id: pick(ASSIGNMENTS, next()),
        }
    patients.push(patient)
    const count = id === 1 ? 1 : next() % 4
    for (let v = 0; v < count; v += 1) {
      const visitId = visits.length + 1
      if (id === 1) {
        visits.push({ id: visitId, patient_id: 1, recorded_by_user_id: 3, scheduled_at: '2026-10-07T16:45-04:00', status: 'scheduled', reason: 'routine checkup' })
        continue
      }
      const day = 1 + (next() % 7)
      const hour = 8 + (next() % 9)
      const minute = pick([0, 15, 30, 45], next())
      visits.push({
        id: visitId,
        patient_id: id,
        recorded_by_user_id: patient.assigned_volunteer_id ?? 1,
        scheduled_at: `2026-10-0${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}-04:00`,
        status: pick(STATUSES, next()),
        reason: pick(REASONS, next()),
      })
    }
  }
  visits.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at) || a.id - b.id)
  return { patients, visits }
}

const fixture = buildFixture()
// In-memory state for this browser tab only (mirrors backend memory: lost on reload).
let session: { token: string; user: User } | null = null
const exports = new Map<string, { token: string }>()
const logs: AccessLogPage['items'] = []

function wait<T>(value: () => T, signal?: AbortSignal | null): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { resolve(value()) } catch (error) { reject(error) }
    }, 250)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) })
  })
}

function log(event_type: string, action: string, status_code: number, extra: { attempted_username?: string; patient_id?: number } = {}) {
  const user = session?.user
  logs.unshift({
    id: logs.length + 1,
    occurred_at: new Date().toISOString(),
    user_id: user?.id ?? null,
    first_name: user?.first_name ?? null,
    last_name: user?.last_name ?? null,
    action,
    status_code,
    event_type,
    attempted_username: extra.attempted_username ?? null,
    patient_id: extra.patient_id ?? null,
  })
}

function fail(event_type: string, action: string, status: number, detail: string, extra?: { patient_id?: number }): never {
  log(event_type, action, status, extra)
  throw new ApiError(detail, status)
}

function requireUser(event_type: string, action: string, extra?: { patient_id?: number }): User {
  if (!session) fail(event_type, action, 401, 'Sign in required', extra)
  return session.user
}

function visible(user: User): Patient[] {
  return user.role === 'manager' ? fixture.patients : fixture.patients.filter((p) => p.assigned_volunteer_id === user.id)
}

export const mockApi: ClinicApi = {
  login: (username, password) => wait(() => {
    const user = USERS.find((u) => u.username === username.toLowerCase())
    if (!user || password !== DEMO_PASSWORD) {
      log('authentication', 'login', 401, { attempted_username: username.slice(0, 64) })
      throw new ApiError('Invalid username or password', 401)
    }
    session = { token: crypto.randomUUID(), user }
    log('authentication', 'login', 200)
    return user
  }),
  logout: () => wait(() => {
    log('authentication', 'logout', 200)
    if (session) for (const [id, item] of exports) if (item.token === session.token) exports.delete(id)
    session = null
    return { signed_out: true }
  }),
  me: () => wait(() => {
    if (!session) throw new ApiError('Sign in required', 401)
    return session.user
  }),
  records: (page, pageSize = 20, signal) => wait(() => {
    const user = requireUser('patient', 'list')
    const rows = visible(user)
    log('patient', 'list', 200)
    return { total: rows.length, page, items: rows.slice((page - 1) * pageSize, page * pageSize) }
  }, signal),
  record: (id) => wait(() => {
    const user = requireUser('patient', 'view', { patient_id: id })
    const patient = fixture.patients.find((p) => p.id === id)
    if (!patient) fail('patient', 'view', 404, 'Patient not found', { patient_id: id })
    if (user.role !== 'manager' && patient.assigned_volunteer_id !== user.id) fail('patient', 'view', 403, 'Patient not assigned to user', { patient_id: id })
    log('patient', 'view', 200, { patient_id: id })
    return { patient, visits: fixture.visits.filter((v) => v.patient_id === id) }
  }),
  createExport: () => wait((): ExportResult => {
    const user = requireUser('export', 'create')
    if (user.role !== 'manager') fail('export', 'create', 403, 'Manager role required')
    const id = crypto.randomUUID().replace(/-/g, '')
    exports.set(id, { token: session!.token })
    log('export', 'create', 201)
    return { id, patient_count: fixture.patients.length, visit_count: fixture.visits.length, view_url: `/api/exports/${id}` }
  }),
  export: (id) => wait(() => {
    const user = requireUser('export', 'view')
    if (user.role !== 'manager') fail('export', 'view', 403, 'Manager role required')
    const item = exports.get(id)
    if (!item || item.token !== session!.token) fail('export', 'view', 404, 'Export not found')
    log('export', 'view', 200)
    return { patients: fixture.patients, visits: [...fixture.visits].sort((a, b) => a.id - b.id) }
  }),
  accessLogs: (query, signal) => wait((): AccessLogPage => {
    if (!session) throw new ApiError('Sign in required', 401)
    if (session.user.role !== 'manager') throw new ApiError('Manager role required', 403)
    // Mock limitation: filters and ordering are not applied; newest first, 20 per page.
    const page = Number(query.get('page') ?? '1') || 1
    return {
      total: logs.length,
      users: USERS.map(({ id, first_name, last_name }) => ({ id, first_name, last_name })),
      items: logs.slice((page - 1) * 20, page * 20),
    }
  }, signal),
}
