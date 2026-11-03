import time

import pytest
from fastapi.testclient import TestClient

from findhub import db, web
from findhub.models import Device, Location

KEYS = Device(id="tag-1", name="Keys")


@pytest.fixture
def client(tmp_path, monkeypatch) -> TestClient:
    database_path = tmp_path / "findhub.db"
    monkeypatch.setattr(db, "DB_PATH", database_path)
    return TestClient(web.app)


def store(*reported_ats: int) -> None:
    connection = db.connect()
    db.save(
        connection, KEYS, [Location(reported_at=t, latitude=1, longitude=2) for t in reported_ats]
    )
    connection.close()


def test_devices_include_latest_position(client):
    store(100, 200)

    assert client.get("/api/devices").json()[0]["position"]["reported_at"] == 200


def test_locations_default_to_the_last_day(client):
    now = int(time.time())
    store(now - 2 * 24 * 3600, now - 3600)

    locations = client.get(f"/api/devices/{KEYS.id}/locations").json()

    assert [location["reported_at"] for location in locations] == [now - 3600]


def test_locations_since(client):
    store(100, 200, 300)

    locations = client.get(f"/api/devices/{KEYS.id}/locations", params={"since": 150}).json()

    assert [location["reported_at"] for location in locations] == [200, 300]
