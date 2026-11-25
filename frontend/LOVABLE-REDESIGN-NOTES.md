# Patient records redesign - change notes

## Changed files
- `src/App.tsx`: redesigned the Patient records workspace, patient rows, patient-details panel and visit list. Added a demo banner that appears only in mock mode. Sign-in, the export viewer and session handling are unchanged. The export route match was rewritten without behaviour change, so it passes stricter TypeScript settings.
- `src/api.ts`: the real client is now `httpApi`. `api` selects the mock only when `VITE_CLINIC_MOCK=true`. `signal` is passed as `signal ?? null`, which has the same runtime behaviour and also compiles under `exactOptionalPropertyTypes`.

## New files
- `src/mock/mockApi.ts`: a preview-only synthetic adapter that is off by default.

## Dependencies and configuration
No new dependencies. `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/styles.css`, `src/AccessLogs.tsx` and the reference files are unchanged.

## Run locally (real backend)
1. Start the FastAPI backend on 127.0.0.1:8000.
2. Run `npm ci`, then `npm run dev`. The mock is off unless `VITE_CLINIC_MOCK=true` is set.
3. Sign in as `andy` (manager). Check: all patients, pagination, the details panel, Export JSON then "Open JSON" in a new tab, and Access logs.
4. Sign in as `elodie`, `jacob` or `kwesi` (volunteer). Check: assigned patients only, and that Export JSON shows "Export denied".
5. Run `npm run build` for the production check.
6. Optional mock run: `VITE_CLINIC_MOCK=true npm run dev`.

## Keyboard
- Patient rows are buttons and open with Enter or Space.
- When the panel opens, focus moves to Close. Tab stays inside the panel.
- Escape or Close shuts the panel and returns focus to the row that opened it.

## Mock vs real backend
The mock uses the source fixture's user IDs (1 Andy, 2 Elodie, 3 Jacob, 4 Kwesi) and the `ACCOUNT_NAMES` map. Patient 1 (Camila Herrera, assigned to user 3, with one visit) matches `reference/examples.json`. The other 63 patients and their visits are generated synthetic data.

The mock mirrors these backend rules:
- Volunteers see only their assigned patients.
- Opening another volunteer's patient returns 403. An unknown patient returns 404.
- POST /exports returns 403 for volunteers.
- GET /exports/{id}: 401 when signed out, 403 for volunteers, 404 for a missing export or another session's export.
- Logout clears the session and its exports.

The mock does not implement the following:
- **Real cookies or sessions.** The mock "session" lives only in the open tab's memory and is never written to browser storage. Reloading the page signs you out. Opening an export's "Open JSON" link in a new tab returns **401 Sign in required**, because the new tab has no session. The real backend shows the JSON because the cookie is shared. The BroadcastChannel sign-out reload is still in the code but can't be shown with the mock.
- **Access-log filters and sort.** The mock records login, logout, list, view and export events in memory, but ignores every filter and the sort order (always newest first).
- **Persistence.** Nothing is saved, and there are no real password hashes. The mock accepts the public demo password shown on the sign-in screen.
- **The mock is not a security boundary.** Real authorization stays in the backend.
