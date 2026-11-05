import secrets
import time
from contextlib import closing
from pathlib import Path
from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from backend.db import DEFAULT_DB_PATH, connect, verify_password


COOKIE_NAME = "clinic_session"
SESSION_SECONDS = 60 * 60


class LoginInput(BaseModel):
    username: str
    password: str


def create_app(database_path: Path = DEFAULT_DB_PATH) -> FastAPI:
    app = FastAPI(title="Clinic Export Demo")
    app.state.database_path = database_path
    app.state.sessions = {}
    app.state.exports = {}

    @app.middleware("http")
    async def log_access(request: Request, call_next):
        path = request.url.path.rstrip("/")
        is_export = path == "/api/exports" or path.startswith("/api/exports/")
        is_login = path == "/api/login" and request.method == "POST"
        is_patient = path.startswith("/api/records/") and request.method == "GET"
        if not (is_export or is_login or is_patient):
            return await call_next(request)
        occurred_at = datetime.now(timezone.utc).isoformat(timespec="microseconds")
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            # Capture denied requests too; authentication can fail before a route runs.
            def persist():
                with closing(connect(database_path)) as connection, connection:
                    if not is_export:
                        raw_id = path.rsplit("/", 1)[-1] if is_patient else ""
                        patient_id = int(raw_id) if raw_id.isascii() and raw_id.isdecimal() and len(raw_id) < 19 else None
                        connection.execute(
                            "INSERT INTO activity_logs (occurred_at, user_id, event_type, action, "
                            "status_code, attempted_username, patient_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (occurred_at, getattr(request.state, "user_id", None),
                             "authentication" if is_login else "patient", "login" if is_login else "view",
                             status_code, getattr(request.state, "attempted_username", None), patient_id),
                        )
                        return
                    connection.execute(
                        "INSERT INTO export_access_logs (occurred_at, user_id, action, status_code) "
                        "VALUES (?, ?, ?, ?)",
                        (occurred_at, getattr(request.state, "user_id", None),
                         "create" if request.method == "POST" and path == "/api/exports"
                         else "view" if request.method == "GET" and path.startswith("/api/exports/")
                         else "other", status_code),
                    )
            await run_in_threadpool(persist)

    def current_session(request: Request) -> tuple[str, dict]:
        token = request.cookies.get(COOKIE_NAME)
        session = request.app.state.sessions.get(token) if token else None
        if not session or session["expires_at"] <= time.monotonic():
            if token:
                request.app.state.sessions.pop(token, None)
                request.app.state.exports = {
                    key: value
                    for key, value in request.app.state.exports.items()
                    if value["session_token"] != token
                }
            raise HTTPException(status_code=401, detail="Sign in required")
        return token, session

    def current_user(
        request: Request, session_info: tuple[str, dict] = Depends(current_session)
    ) -> tuple[str, dict]:
        token, session = session_info
        with closing(connect(request.app.state.database_path)) as connection:
            row = connection.execute(
                "SELECT id, username, first_name, last_name, role FROM users WHERE id = ?",
                (session["user_id"],),
            ).fetchone()
        if row is None:
            raise HTTPException(status_code=401, detail="Account unavailable")
        request.state.user_id = row["id"]
        return token, dict(row)

    @app.get("/api/access-logs")
    @app.get("/api/export-access-logs")
    def export_access_logs(
        request: Request,
        identity: tuple[str, dict] = Depends(current_user),
        user_id: int | None = Query(None, ge=1),
        anonymous: bool = False,
        outcome: Literal["success", "failure"] | None = None,
        action: Literal["create", "view", "other", "login"] | None = None,
        event_type: Literal["export", "authentication", "patient"] | None = None,
        order: Literal["newest", "oldest"] = "newest",
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
    ):
        if identity[1]["role"] != "manager":
            raise HTTPException(status_code=403, detail="Manager role required")
        clauses, parameters = [], []
        unified = request.url.path == "/api/access-logs"
        source = """(SELECT id, occurred_at, user_id, action, status_code,
            'export' AS event_type, NULL AS attempted_username, NULL AS patient_id FROM export_access_logs
            UNION ALL SELECT id, occurred_at, user_id, action, status_code,
            event_type, attempted_username, patient_id FROM activity_logs)""" if unified else "export_access_logs"
        if event_type and unified:
            clauses.append("l.event_type = ?")
            parameters.append(event_type)
        if user_id is not None:
            clauses.append("l.user_id = ?")
            parameters.append(user_id)
        if anonymous:
            clauses.append("l.user_id IS NULL")
        if outcome:
            clauses.append("l.status_code BETWEEN 200 AND 299" if outcome == "success"
                           else "l.status_code NOT BETWEEN 200 AND 299")
        if action:
            clauses.append("l.action = ?")
            parameters.append(action)
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        direction = "DESC" if order == "newest" else "ASC"
        with closing(connect(database_path)) as connection:
            total = connection.execute("SELECT COUNT(*) FROM " + source + " l" + where,
                                       parameters).fetchone()[0]
            rows = connection.execute(
                "SELECT l.*, u.first_name, u.last_name FROM " + source + " l "
                "LEFT JOIN users u ON u.id = l.user_id" + where +
                f" ORDER BY l.occurred_at {direction}, l.id {direction} LIMIT ? OFFSET ?",
                (*parameters, page_size, (page - 1) * page_size),
            ).fetchall()
            users = connection.execute("SELECT id, first_name, last_name FROM users ORDER BY first_name").fetchall()
        return JSONResponse({"items": [dict(row) for row in rows], "total": total,
                             "users": [dict(row) for row in users]},
                            headers={"Cache-Control": "no-store"})

    @app.post("/api/login")
    def login(payload: LoginInput, request: Request, response: Response) -> dict:
        username = payload.username.strip().lower()
        request.state.attempted_username = "".join(c for c in username if c.isprintable())[:100]
        with closing(connect(request.app.state.database_path)) as connection:
            row = connection.execute(
                "SELECT id, username, password_hash, first_name, last_name, role "
                "FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        if row is None or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        request.state.user_id = row["id"]

        old_token = request.cookies.get(COOKIE_NAME)
        if old_token:
            request.app.state.sessions.pop(old_token, None)
            request.app.state.exports = {
                key: value
                for key, value in request.app.state.exports.items()
                if value["session_token"] != old_token
            }

        token = secrets.token_urlsafe(32)
        request.app.state.sessions[token] = {
            "user_id": row["id"],
            "expires_at": time.monotonic() + SESSION_SECONDS,
        }
        response.set_cookie(
            COOKIE_NAME,
            token,
            max_age=SESSION_SECONDS,
            httponly=True,
            samesite="lax",
            secure=False,  # Local HTTP demo only.
        )
        return {
            "id": row["id"],
            "username": row["username"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "role": row["role"],
        }

    @app.post("/api/logout")
    def logout(request: Request, response: Response) -> dict:
        token = request.cookies.get(COOKIE_NAME)
        if token:
            request.app.state.sessions.pop(token, None)
            request.app.state.exports = {
                key: value
                for key, value in request.app.state.exports.items()
                if value["session_token"] != token
            }
        response.delete_cookie(COOKIE_NAME)
        return {"signed_out": True}

    @app.get("/api/me")
    def me(identity: tuple[str, dict] = Depends(current_user)) -> dict:
        return identity[1]

    @app.get("/api/records")
    def list_records(
        request: Request,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        identity: tuple[str, dict] = Depends(current_user),
    ) -> dict:
        user = identity[1]
        restriction = "" if user["role"] == "manager" else " WHERE assigned_volunteer_id = ?"
        parameters = () if user["role"] == "manager" else (user["id"],)
        with closing(connect(request.app.state.database_path)) as connection:
            total = connection.execute(
                "SELECT COUNT(*) FROM patients" + restriction, parameters
            ).fetchone()[0]
            rows = connection.execute(
                "SELECT id, first_name, last_name, birth_date, assigned_volunteer_id "
                "FROM patients" + restriction + " ORDER BY id LIMIT ? OFFSET ?",
                (*parameters, page_size, (page - 1) * page_size),
            ).fetchall()
        return {"total": total, "page": page, "items": [dict(row) for row in rows]}

    @app.get("/api/records/{patient_id}")
    def get_record(
        patient_id: int,
        request: Request,
        identity: tuple[str, dict] = Depends(current_user),
    ) -> dict:
        user = identity[1]
        with closing(connect(request.app.state.database_path)) as connection:
            row = connection.execute(
                "SELECT id, first_name, last_name, birth_date, assigned_volunteer_id "
                "FROM patients WHERE id = ?",
                (patient_id,),
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Patient not found")
            if user["role"] != "manager" and row["assigned_volunteer_id"] != user["id"]:
                raise HTTPException(status_code=403, detail="Patient not assigned to user")
            visits = connection.execute(
                "SELECT id, patient_id, recorded_by_user_id, scheduled_at, status, reason "
                "FROM visits WHERE patient_id = ? ORDER BY scheduled_at, id",
                (patient_id,),
            ).fetchall()
        return {"patient": dict(row), "visits": [dict(visit) for visit in visits]}

    @app.post("/api/exports", status_code=201)
    def create_export(
        request: Request, identity: tuple[str, dict] = Depends(current_user)
    ) -> dict:
        token, user = identity
        if user["role"] != "manager":
            raise HTTPException(status_code=403, detail="Manager role required")
        with closing(connect(request.app.state.database_path)) as connection:
            patients = [
                dict(row)
                for row in connection.execute(
                    "SELECT id, first_name, last_name, birth_date, assigned_volunteer_id "
                    "FROM patients ORDER BY id"
                )
            ]
            visits = [
                dict(row)
                for row in connection.execute(
                    "SELECT id, patient_id, recorded_by_user_id, scheduled_at, status, reason "
                    "FROM visits ORDER BY id"
                )
            ]
        export_id = secrets.token_urlsafe(18)
        request.app.state.exports[export_id] = {
            "session_token": token,
            "payload": {"patients": patients, "visits": visits},
        }
        return {
            "id": export_id,
            "patient_count": len(patients),
            "visit_count": len(visits),
            "view_url": f"/api/exports/{export_id}",
        }

    @app.get("/api/exports/{export_id}")
    def view_export(
        export_id: str,
        request: Request,
        identity: tuple[str, dict] = Depends(current_user),
    ) -> JSONResponse:
        token, user = identity
        if user["role"] != "manager":
            raise HTTPException(status_code=403, detail="Manager role required")
        export = request.app.state.exports.get(export_id)
        if export is None or export["session_token"] != token:
            raise HTTPException(status_code=404, detail="Export not found")
        return JSONResponse(export["payload"], headers={"Cache-Control": "no-store"})

    return app


app = create_app()
