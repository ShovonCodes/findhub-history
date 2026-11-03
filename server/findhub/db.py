import os
import sqlite3
from pathlib import Path

from findhub.models import Device, Location

DB_PATH = Path(os.environ.get("FINDHUB_DB", "/var/lib/findhub/findhub.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS locations (
    device_id TEXT NOT NULL REFERENCES devices(id),
    reported_at INTEGER NOT NULL,
    latitude REAL,
    longitude REAL,
    altitude REAL,
    accuracy REAL,
    semantic_name TEXT,
    is_own_report INTEGER,
    PRIMARY KEY (device_id, reported_at)
);
"""
LOCATION_COLUMNS = (
    "reported_at, latitude, longitude, altitude, accuracy, semantic_name, is_own_report"
)


def connect(path: Path | None = None) -> sqlite3.Connection:
    path = path or DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode = WAL")
    db.executescript(SCHEMA)
    return db


def save(db: sqlite3.Connection, device: Device, locations: list[Location]) -> int:
    """Store a device and its locations, skipping ones already stored. Returns how many are new."""
    with db:
        db.execute(
            "INSERT INTO devices (id, name) VALUES (?, ?) "
            "ON CONFLICT (id) DO UPDATE SET name = excluded.name",
            (device.id, device.name),
        )
        before = db.total_changes
        db.executemany(
            f"INSERT OR IGNORE INTO locations (device_id, {LOCATION_COLUMNS}) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    device.id,
                    location.reported_at,
                    location.latitude,
                    location.longitude,
                    location.altitude,
                    location.accuracy,
                    location.semantic_name,
                    location.is_own_report,
                )
                for location in locations
            ],
        )
        return db.total_changes - before


def devices_with_latest(db: sqlite3.Connection) -> list[dict]:
    """Each device with its most recent report (`last_seen`) and most recent coordinates."""
    devices = db.execute("SELECT id, name FROM devices ORDER BY name").fetchall()
    return [
        {
            **dict(device),
            "last_seen": _latest(db, device["id"], "1 = 1"),
            "position": _latest(db, device["id"], "latitude IS NOT NULL"),
        }
        for device in devices
    ]


def trail(db: sqlite3.Connection, device_id: str, since: int) -> list[dict]:
    rows = db.execute(
        f"SELECT {LOCATION_COLUMNS} FROM locations "
        "WHERE device_id = ? AND reported_at >= ? AND latitude IS NOT NULL "
        "ORDER BY reported_at",
        (device_id, since),
    ).fetchall()
    return [dict(row) for row in rows]


def _latest(db: sqlite3.Connection, device_id: str, condition: str) -> dict | None:
    row = db.execute(
        f"SELECT {LOCATION_COLUMNS} FROM locations WHERE device_id = ? AND {condition} "
        "ORDER BY reported_at DESC LIMIT 1",
        (device_id,),
    ).fetchone()
    return dict(row) if row else None
