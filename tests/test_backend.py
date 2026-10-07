from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.seed import FIXTURE_PATH, load_database


@pytest.fixture
def clients(tmp_path):
    db_path = tmp_path / "test.sqlite3"
    load_database(FIXTURE_PATH, db_path)
    app = create_app(db_path)
    with TestClient(app) as manager, TestClient(app) as volunteer:
        yield manager, volunteer


def login(client, username):
    response = client.post("/api/login", json={"username": username, "password": "password"})
    assert response.status_code == 200
    return response.json()


def test_fixture_ranges_and_count(clients):
    manager, _ = clients
    login(manager, "royce")
    response = manager.post("/api/exports")
    assert response.status_code == 201
    assert response.json()["patient_count"] == 200
    assert response.json()["visit_count"] == 250
    payload = manager.get(response.json()["view_url"]).json()
    assert len(payload["patients"]) == 200
    assert len(payload["visits"]) == 250
    assert all(date(1986, 1, 1) <= date.fromisoformat(p["birth_date"]) <= date(1996, 9, 30)
               for p in payload["patients"])
    assert all(date(2026, 10, 1) <= datetime.fromisoformat(v["scheduled_at"]).date() <= date(2026, 10, 7)
               for v in payload["visits"])


def test_volunteer_cannot_create_or_view_export(clients):
    manager, volunteer = clients
    login(manager, "royce")
    login(volunteer, "alvin")
    view_url = manager.post("/api/exports").json()["view_url"]

    denied = volunteer.post("/api/exports")
    assert denied.status_code == 403
    assert "patients" not in denied.json()
    assert volunteer.get(view_url).status_code == 403


def test_exports_disappear_on_logout_and_new_login(clients):
    manager, _ = clients
    login(manager, "royce")
    view_url = manager.post("/api/exports").json()["view_url"]
    assert manager.get(view_url).status_code == 200
    assert manager.post("/api/logout").status_code == 200
    assert manager.get(view_url).status_code == 401
    login(manager, "royce")
    assert manager.get(view_url).status_code == 404


def test_volunteer_records_are_scoped(clients):
    manager, volunteer = clients
    login(manager, "royce")
    login(volunteer, "alvin")
    all_count = manager.get("/api/records").json()["total"]
    assigned = volunteer.get("/api/records?page_size=100").json()
    assert all_count == 200
    assert 0 < assigned["total"] < 200
    assert all(row["assigned_volunteer_id"] == 2 for row in assigned["items"])
    unassigned_patient = next(
        row["id"] for row in manager.get("/api/records?page_size=100").json()["items"]
        if row["assigned_volunteer_id"] != 2
    )
    assert volunteer.get(f"/api/records/{unassigned_patient}").status_code == 403
