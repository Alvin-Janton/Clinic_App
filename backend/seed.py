import argparse
import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

from backend.db import DEFAULT_DB_PATH, ROOT, connect, hash_password


FIXTURE_PATH = ROOT / "data" / "seed.json"
FIRST_NAMES = (
    "Camila", "Daniel", "Elena", "Gabriel", "Isabel", "Julian", "Lucia",
    "Mateo", "Nadia", "Omar", "Sofia", "Tomas", "Valeria", "Xavier",
    "Ana", "Bruno", "Carla", "Diego", "Eva", "Felix",
)
LAST_NAMES = (
    "Acosta", "Benitez", "Castillo", "Delgado", "Espinoza", "Fernandez",
    "Garcia", "Herrera", "Iglesias", "Jimenez", "Lopez", "Morales",
    "Navarro", "Ortiz", "Perez", "Quintero", "Rivera", "Sanchez",
    "Torres", "Vega",
)
DEMO_USERS = (
    (1, "andy", "Andy", "Sotomayor", "manager"),
    (2, "elodie", "Elodie", "Coleman", "volunteer"),
    (3, "jacob", "Jacob", "Schnellinger", "volunteer"),
    (4, "kwesi", "Kwesi", "Mcneishie", "volunteer"),
)
STATUSES = ("scheduled", "arrived", "missed", "cancelled")
REASONS = ("vaccine", "bloodwork", "routine checkup")

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('manager', 'volunteer'))
);

CREATE TABLE patients (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    assigned_volunteer_id INTEGER REFERENCES users(id)
);

CREATE TABLE visits (
    id INTEGER PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    recorded_by_user_id INTEGER NOT NULL REFERENCES users(id),
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'arrived', 'missed', 'cancelled')),
    reason TEXT NOT NULL
);

CREATE INDEX idx_patients_assigned_volunteer ON patients(assigned_volunteer_id);
CREATE INDEX idx_visits_patient ON visits(patient_id);

CREATE TABLE export_access_logs (
    id INTEGER PRIMARY KEY,
    occurred_at TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    status_code INTEGER NOT NULL
);
CREATE INDEX idx_export_logs_time ON export_access_logs(occurred_at, id);

CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY,
    occurred_at TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    event_type TEXT NOT NULL,
    action TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    attempted_username TEXT,
    patient_id INTEGER
);
CREATE INDEX idx_activity_logs_time ON activity_logs(occurred_at, id);
"""


def build_fixture() -> dict:
    rng = random.Random(20261001)
    patients = []
    visits = []
    visit_id = 1
    week_start = date(2026, 10, 1)

    for patient_id in range(1, 201):
        birth_year = rng.randint(1986, 1996)
        last_birthday = date(birth_year, 9, 30) if birth_year == 1996 else date(birth_year, 12, 31)
        birth_day = date(birth_year, 1, 1) + timedelta(
            days=rng.randint(0, (last_birthday - date(birth_year, 1, 1)).days)
        )
        assigned_volunteer_id = rng.choice((None, 2, 3, 4))
        patients.append(
            {
                "id": patient_id,
                "first_name": FIRST_NAMES[(patient_id - 1) % len(FIRST_NAMES)],
                "last_name": LAST_NAMES[(patient_id * 7) % len(LAST_NAMES)],
                "birth_date": birth_day.isoformat(),
                "assigned_volunteer_id": assigned_volunteer_id,
            }
        )

        for _ in range(1 + (patient_id % 4 == 0)):
            visit_day = week_start + timedelta(days=rng.randint(0, 6))
            visit_time = datetime(
                visit_day.year, visit_day.month, visit_day.day,
                rng.randint(8, 16), rng.choice((0, 15, 30, 45)),
            )
            visits.append(
                {
                    "id": visit_id,
                    "patient_id": patient_id,
                    "recorded_by_user_id": assigned_volunteer_id or 1,
                    "scheduled_at": visit_time.isoformat(timespec="minutes") + "-04:00",
                    "status": rng.choice(STATUSES),
                    "reason": rng.choice(REASONS),
                }
            )
            visit_id += 1

    return {
        "note": "Synthetic demonstration data; no real patient records.",
        "users": [
            {
                "id": user_id,
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
            }
            for user_id, username, first_name, last_name, role in DEMO_USERS
        ],
        "patients": patients,
        "visits": visits,
    }


def generate_fixture(path: Path = FIXTURE_PATH) -> dict:
    if path.exists():
        raise FileExistsError(f"Fixture already exists: {path}")
    fixture = build_fixture()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fixture, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return fixture


def load_database(fixture_path: Path = FIXTURE_PATH, db_path: Path = DEFAULT_DB_PATH) -> dict:
    if db_path.exists():
        raise FileExistsError(f"Database already exists: {db_path}")
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = db_path.with_suffix(".building.sqlite3")
    if temporary_path.exists():
        raise FileExistsError(f"Temporary database already exists: {temporary_path}")
    connection = connect(temporary_path)
    try:
        connection.executescript(SCHEMA)
        with connection:
            connection.executemany(
                "INSERT INTO users (id, username, password_hash, first_name, last_name, role) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                [
                    (user["id"], user["username"], hash_password("password"),
                     user["first_name"], user["last_name"], user["role"])
                    for user in fixture["users"]
                ],
            )
            connection.executemany(
                "INSERT INTO patients (id, first_name, last_name, birth_date, assigned_volunteer_id) "
                "VALUES (:id, :first_name, :last_name, :birth_date, :assigned_volunteer_id)",
                fixture["patients"],
            )
            connection.executemany(
                "INSERT INTO visits (id, patient_id, recorded_by_user_id, scheduled_at, status, reason) "
                "VALUES (:id, :patient_id, :recorded_by_user_id, :scheduled_at, :status, :reason)",
                fixture["visits"],
            )
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"SQLite integrity check failed: {integrity}")
    finally:
        connection.close()
    temporary_path.replace(db_path)
    return {
        "users": len(fixture["users"]),
        "patients": len(fixture["patients"]),
        "visits": len(fixture["visits"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate or load synthetic clinic data")
    parser.add_argument("action", choices=("generate", "load"))
    parser.add_argument("--fixture", type=Path, default=FIXTURE_PATH)
    parser.add_argument("--database", type=Path, default=DEFAULT_DB_PATH)
    args = parser.parse_args()
    if args.action == "generate":
        fixture = generate_fixture(args.fixture)
        print(f"Generated {len(fixture['patients'])} patients and {len(fixture['visits'])} visits in {args.fixture}")
    else:
        counts = load_database(args.fixture, args.database)
        print(f"Loaded {counts} into {args.database}")


if __name__ == "__main__":
    main()
