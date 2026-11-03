import pytest

from findhub import db
from findhub.google.errors import AuthRequiredError
from findhub.models import Device, Location
from findhub.poll import poll

PHONE = Device(id="phone-1", name="Phone")
KEYS = Device(id="tag-1", name="Keys")


class FakeSource:
    def __init__(self, results: dict):
        self._results = results

    def list_devices(self):
        return [PHONE, KEYS]

    def fetch_locations(self, device_id):
        result = self._results[device_id]
        if isinstance(result, Exception):
            raise result
        return result


def location(reported_at: int) -> Location:
    return Location(reported_at=reported_at, latitude=1.0, longitude=2.0)


def test_stores_locations_for_every_device(database):
    source = FakeSource({PHONE.id: [location(10)], KEYS.id: [location(20), location(30)]})

    assert poll(database, source) is True

    assert len(db.trail(database, KEYS.id, since=0)) == 2
    assert len(db.trail(database, PHONE.id, since=0)) == 1


def test_one_failing_device_does_not_stop_the_others(database):
    source = FakeSource({PHONE.id: TimeoutError(), KEYS.id: [location(20)]})

    assert poll(database, source) is False

    assert len(db.trail(database, KEYS.id, since=0)) == 1
    assert db.poll_schedule(database)["last"]["succeeded"] is False


def test_records_each_run(database):
    poll(database, FakeSource({PHONE.id: [], KEYS.id: []}))

    assert db.poll_schedule(database)["last"]["succeeded"] is True


def test_login_problems_stop_the_poll(database):
    source = FakeSource({PHONE.id: AuthRequiredError("log in"), KEYS.id: [location(20)]})

    with pytest.raises(AuthRequiredError):
        poll(database, source)

    assert db.poll_schedule(database)["last"]["succeeded"] is False
