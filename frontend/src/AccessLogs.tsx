import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { api, ApiError, type AccessLogPage } from './api'

export default function AccessLogs({ onExpired }: { onExpired: () => void }) {
  const [data, setData] = useState<AccessLogPage | null>(null)
  const [user, setUser] = useState('')
  const [outcome, setOutcome] = useState('')
  const [action, setAction] = useState('')
  const [order, setOrder] = useState('newest')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ page: String(page), order })
    if (user === 'anonymous') query.set('anonymous', 'true')
    else if (user) query.set('user_id', user)
    if (outcome) query.set('outcome', outcome)
    if (action) query.set('action', action)
    setLoading(true)
    setError('')
    api.accessLogs(query, controller.signal).then(setData).catch((cause: unknown) => {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) onExpired()
      else setError(cause instanceof Error ? cause.message : 'Unable to load access logs.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [user, outcome, action, order, page, revision, onExpired])

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 20))
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-7">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Export access logs</h1>
        <button className="icon-button border border-slate-200 bg-white" title="Refresh logs" aria-label="Refresh logs" disabled={loading} onClick={() => setRevision(v => v + 1)}><RefreshCw size={18} /></button>
      </div>
      <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">User<select className="field mt-2" value={user} onChange={e => { setUser(e.target.value); setPage(1) }}><option value="">All users</option><option value="anonymous">Unauthenticated</option>{data?.users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></label>
        <label className="text-sm font-medium">Outcome<select className="field mt-2" value={outcome} onChange={e => { setOutcome(e.target.value); setPage(1) }}><option value="">All outcomes</option><option value="success">Successful</option><option value="failure">Unsuccessful</option></select></label>
        <label className="text-sm font-medium">Action<select className="field mt-2" value={action} onChange={e => { setAction(e.target.value); setPage(1) }}><option value="">All actions</option><option value="create">Create export</option><option value="view">View export</option><option value="other">Other request</option></select></label>
        <label className="text-sm font-medium">Sort<select className="field mt-2" value={order} onChange={e => { setOrder(e.target.value); setPage(1) }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-rose-800">{error}</p>}
      <p role="status" className="mb-3 text-sm text-slate-500">{loading ? 'Loading logs...' : `${data?.total ?? 0} attempt${data?.total === 1 ? '' : 's'}`}</p>
      {!loading && !error && <div className="overflow-x-auto rounded-md border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-[#eef3f2]"><tr>{['Time (local)', 'User', 'Action', 'Outcome'].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{data?.items.map(log => <tr key={log.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-4 py-3">{new Date(log.occurred_at).toLocaleString()}</td><td className="px-4 py-3">{log.user_id === null ? 'Unauthenticated' : `${log.first_name} ${log.last_name}`}</td><td className="px-4 py-3">{log.action === 'create' ? 'Create export' : log.action === 'view' ? 'View export' : 'Other request'}</td><td className="px-4 py-3"><span className={log.status_code >= 200 && log.status_code < 300 ? 'text-emerald-800' : 'text-amber-800'}>{log.status_code >= 200 && log.status_code < 300 ? 'Successful' : 'Unsuccessful'} ({log.status_code})</span></td></tr>)}{!data?.items.length && <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500">No matching attempts.</td></tr>}</tbody></table></div>}
      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        <button className="icon-button" aria-label="Previous log page" title="Previous page" disabled={loading || page <= 1} onClick={() => setPage(v => v - 1)}><ChevronLeft size={18} /></button>
        <span>Page {page} of {pages}</span>
        <button className="icon-button" aria-label="Next log page" title="Next page" disabled={loading || page >= pages} onClick={() => setPage(v => v + 1)}><ChevronRight size={18} /></button>
      </div>
    </main>
  )
}
