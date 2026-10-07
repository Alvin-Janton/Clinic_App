import secrets
import time
from contextlib import closing
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

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
        return token, dict(row)

    @app.post("/api/login")
    def login(payload: LoginInput, request: Request, response: Response) -> dict:
        with closing(connect(request.app.state.database_path)) as connection:
            row = connection.execute(
                "SELECT id, username, password_hash, first_name, last_name, role "
                "FROM users WHERE username = ?",
                (payload.username.strip().lower(),),
            ).fetchone()
        if row is None or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")

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
