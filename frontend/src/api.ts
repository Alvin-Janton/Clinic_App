export type Role = 'manager' | 'volunteer'

export interface User {
  id: number
  username: string
  first_name: string
  last_name: string
  role: Role
}

export interface Patient {
  id: number
  first_name: string
  last_name: string
  birth_date: string
  assigned_volunteer_id: number | null
}

export interface Visit {
  id: number
  patient_id: number
  recorded_by_user_id: number
  scheduled_at: string
  status: 'scheduled' | 'arrived' | 'missed' | 'cancelled'
  reason: string
}

export interface RecordPage {
  total: number
  page: number
  items: Patient[]
}

export interface PatientDetail {
  patient: Patient
  visits: Visit[]
}

export interface ExportResult {
  id: string
  patient_count: number
  visit_count: number
  view_url: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface AccessLogPage {
  total: number
  users: Pick<User, 'id' | 'first_name' | 'last_name'>[]
  items: { id: number; occurred_at: string; user_id: number | null; first_name: string | null; last_name: string | null; action: string; status_code: number }[]
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError('Cannot reach the clinic service. Check that the backend is running.', 0)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new ApiError(body?.detail ?? `Request failed (${response.status})`, response.status)
  }
  return response.json() as Promise<T>
}

export const api = {
  login: (username: string, password: string) =>
    request<User>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ signed_out: boolean }>('/api/logout', { method: 'POST' }),
  me: () => request<User>('/api/me'),
  records: (page: number, pageSize = 20, signal?: AbortSignal) =>
    request<RecordPage>(`/api/records?page=${page}&page_size=${pageSize}`, { signal }),
  record: (id: number) => request<PatientDetail>(`/api/records/${id}`),
  createExport: () => request<ExportResult>('/api/exports', { method: 'POST' }),
  export: (id: string) => request<unknown>(`/api/exports/${encodeURIComponent(id)}`),
  accessLogs: (query: URLSearchParams, signal?: AbortSignal) =>
    request<AccessLogPage>(`/api/export-access-logs?${query}`, { signal }),
}
