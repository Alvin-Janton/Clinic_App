# Clinic export demo

This is the local Week 7 proof of concept. It uses only synthetic data. The React frontend lets staff inspect permitted records and demonstrates the manager-only JSON export control.

## Data

`data/seed.json` is the saved, reviewable fixture generated once by `backend.seed`. It contains four demo users, 200 patients, and 250 visits dated October 1-7, 2026. The SQLite database at `data/clinic.sqlite3` was loaded from that fixture and is ignored by Git because it can be recreated.

The SQLite tables are `users`, `patients`, `visits`, `export_access_logs`, and `activity_logs`. Sessions and generated JSON exports exist only in backend memory. Restarting the server clears both. Logging out removes the current session and its exports, so an old export URL no longer returns data. All access logs persist in SQLite across logouts and restarts.

Managers can open **Access logs** to filter attempts by type (export, authentication, or patient access), user, action, and outcome, combine these filters, or change between newest and oldest first. Entries record UTC time, authenticated user ID when available, action, and response status. The screen displays times in the browser's local timezone. Login attempts record a bounded, sanitized username; failed logins are labeled unverified and do not attribute the attempt to the account owner. Logout events use the authentication type and capture the user before removing a valid session. Logout remains idempotent: requests with expired or missing sessions return success and are logged as unauthenticated. Patient access logs cover both the patient list (`list` action, no patient ID) and individual records (`view` action, requested patient ID), including denied and invalid requests. Logs contain no medical details, passwords, session tokens, or export URLs. They share the database's backup and local-file-access limitations; they are not tamper-proof.

Logging for the patient list and logout uses the existing `activity_logs` schema and needs no database rebuild if that table is already present.

The added `activity_logs` table requires rebuilding existing demo databases from the fixture, using the backup-and-load steps below. This clears live log history in the new database; retain the backup if you need that history.

For an existing installation, stop the backend and move the current database to a unique backup filename (for example `clinic.sqlite3.bak.bak`), then run `uv run python -m backend.seed load` before restarting. This recreates the database from the saved fixture with an empty log table. Do not overwrite an existing backup. If the log table is missing or unwritable, export requests fail rather than silently proceeding without a log entry.

Demo logins are `andy`, `elodie`, `jacob`, and `kwesi`; all use the password `password`. This shared password is intentionally weak and is suitable only for the local synthetic-data demonstration. Passwords are stored as salted hashes, not plaintext, in SQLite.

## Setup and run

Start the backend from the repository directory:

```powershell
uv sync --dev
uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

The API documentation is at `http://127.0.0.1:8000/docs`. If the local SQLite file is absent, load it from the saved fixture once:

```powershell
uv run python -m backend.seed load
```

The loader refuses to overwrite an existing database. The fixture generator also refuses to overwrite `data/seed.json`; it is only needed to create a new fixture from scratch:

```powershell
uv run python -m backend.seed generate
```

In a second terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. Vite forwards `/api` requests to the backend on port 8000. Sign in as `andy` to create and view a JSON export, or as `elodie`, `jacob`, or `kwesi` to see the volunteer view and its denied export attempt. The export URL is temporary: logging out makes it unavailable.

## API

| Method and path | Purpose |
| --- | --- |
| `POST /api/login` | Sign in with `username` and `password`; sets an HTTP-only session cookie. |
| `POST /api/logout` | End the session and remove its in-memory exports. |
| `GET /api/me` | Return the signed-in user's identity and role. |
| `GET /api/records` | Return paginated patients; volunteers see only assigned patients. |
| `GET /api/records/{patient_id}` | Return one permitted patient and their visits. |
| `POST /api/exports` | Manager only; create an in-memory JSON export and return its count and view URL. |
| `GET /api/exports/{id}` | Return the JSON only to the manager session that created it. |
| `GET /api/export-access-logs` | Manager only; paginated export attempt history with user, anonymous, action, outcome, and order filters. |
| `GET /api/access-logs` | Manager only; combined history with the same filters and an optional `event_type` of `export`, `authentication`, or `patient`. |

The export creation response reports a patient count; the JSON view contains `patients` and `visits` arrays. A volunteer's export request returns `403` without a data payload. A new login does not recover exports from an old session.

## Verification

```powershell
uv run python -m pytest -q
```

The tests check fixture counts and dates, volunteer export denial, assigned-record visibility, export removal on logout, persisted success and failure logs, manager-only monitoring, and combined filters and pagination. They use a temporary database and do not modify `data/clinic.sqlite3`.
