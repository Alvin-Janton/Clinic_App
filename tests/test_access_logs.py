from contextlib import closing
from datetime import datetime

from fastapi.testclient import TestClient

from backend.app import create_app
from backend.db import connect
from backend.seed import load_database


def test_export_logging_and_monitoring(tmp_path):
    path = tmp_path / "clinic.sqlite3"
    load_database(db_path=path)
    app = create_app(path)
    with TestClient(app) as manager, TestClient(app) as volunteer, TestClient(app) as anonymous:
        assert anonymous.post("/api/exports").status_code == 401
        assert anonymous.get("/api/export-access-logs").status_code == 401
        manager.post("/api/login", json={"username": "andy", "password": "password"})
        volunteer.post("/api/login", json={"username": "elodie", "password": "password"})
        assert volunteer.post("/api/exports").status_code == 403
        assert volunteer.get("/api/export-access-logs").status_code == 403
        export = manager.post("/api/exports").json()
        assert manager.get(export["view_url"]).status_code == 200
        assert volunteer.get(export["view_url"]).status_code == 403
        assert manager.get("/api/exports/missing").status_code == 404
        logs = manager.get("/api/export-access-logs").json()
        assert logs["total"] == 6
        assert [row["status_code"] for row in logs["items"]] == [404, 403, 200, 201, 403, 401]
        assert logs["items"][-1]["user_id"] is None
        assert datetime.fromisoformat(logs["items"][0]["occurred_at"]).utcoffset().total_seconds() == 0
        filtered = manager.get("/api/export-access-logs?user_id=2&outcome=failure&action=view").json()
        assert filtered["total"] == 1
        assert filtered["items"][0]["status_code"] == 403
        assert manager.get("/api/export-access-logs?anonymous=true").json()["total"] == 1
        assert manager.get("/api/export-access-logs?outcome=success").json()["total"] == 2
        oldest = manager.get("/api/export-access-logs?order=oldest&page_size=2&page=2").json()
        assert [row["status_code"] for row in oldest["items"]] == [201, 200]
        assert manager.get("/api/export-access-logs?order=invalid").status_code == 422
        # Only event metadata is retained, never cookies, paths, or patient payloads.
        assert set(logs["items"][0]) == {"id", "occurred_at", "user_id", "action", "status_code", "first_name", "last_name"}
    with closing(connect(path)) as connection:
        assert connection.execute("SELECT COUNT(*) FROM export_access_logs").fetchone()[0] == 6
    with TestClient(create_app(path)) as restarted:
        restarted.post("/api/login", json={"username": "andy", "password": "password"})
        assert restarted.get("/api/export-access-logs").json()["total"] == 6
