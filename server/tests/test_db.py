from findhub import db
from findhub.models import Device, Location

KEYS = Device(id="tag-1", name="Keys")


def position(reported_at: int, latitude: float = 23.8) -> Location:
    return Location(
        reported_at=reported_at, latitude=latitude, longitude=90.4, accuracy=12, is_own_report=True
    )


def test_save_skips_locations_already_stored(database):
    assert db.save(database, KEYS, [position(100), position(200)]) == 2
    assert db.save(database, KEYS, [position(200), position(300)]) == 1


def test_save_renames_devices(database):
    db.save(database, KEYS, [])
    db.save(database, Device(id=KEYS.id, name="Car keys"), [])

    assert [device["name"] for device in db.devices_with_latest(database)] == ["Car keys"]


def test_latest_separates_last_report_from_last_coordinates(database):
    db.save(database, KEYS, [position(100), Location(reported_at=200, semantic_name="Home")])
    db.save(database, Device(id="tag-2", name="Bag"), [])

    keys, bag = sorted(db.devices_with_latest(database), key=lambda device: device["id"])

    assert keys["last_seen"]["semantic_name"] == "Home"
    assert keys["position"]["reported_at"] == 100
    assert bag["last_seen"] is None and bag["position"] is None


def test_trail_returns_positions_since_oldest_first(database):
    db.save(
        database,
        KEYS,
        [
            position(300),
            position(100),
            Location(reported_at=250, semantic_name="Home"),
            position(200),
        ],
    )

    assert [point["reported_at"] for point in db.trail(database, KEYS.id, since=150)] == [200, 300]
