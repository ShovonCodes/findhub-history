"""Fetch the latest location of every Find Hub device and store it.

    python -m findhub.poll

Meant to run every few minutes from a systemd timer or cron.
"""

import logging
import os
import sqlite3
import sys
import time
from contextlib import closing
from pathlib import Path
from typing import Protocol

from findhub import db
from findhub.google.client import FindHubClient
from findhub.google.credentials import CredentialStore
from findhub.google.errors import AuthRequiredError
from findhub.models import Device, Location

CREDENTIALS_PATH = Path(
    os.environ.get("FINDHUB_CREDENTIALS", "/var/lib/findhub-history/credentials.json")
)
LOCATION_TIMEOUT_SECONDS = 60

logger = logging.getLogger("findhub.poll")


class DeviceSource(Protocol):
    def list_devices(self) -> list[Device]: ...

    def fetch_locations(self, device_id: str) -> list[Location]: ...


def poll(database: sqlite3.Connection, source: DeviceSource) -> bool:
    """Store new locations for every device and record the run. Returns False if any failed."""
    ran_at = int(time.time())
    try:
        succeeded = store_new_locations(database, source)
    except Exception:
        db.record_poll(database, ran_at, succeeded=False)
        raise
    db.record_poll(database, ran_at, succeeded)
    return succeeded


def store_new_locations(database: sqlite3.Connection, source: DeviceSource) -> bool:
    all_succeeded = True
    for device in source.list_devices():
        try:
            locations = source.fetch_locations(device.id)
        except AuthRequiredError:
            raise
        except Exception:
            logger.exception("Could not fetch locations for %s", device.name)
            all_succeeded = False
            continue
        added = db.save(database, device, locations)
        logger.info("%s: %d locations received, %d new", device.name, len(locations), added)
    return all_succeeded


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    client = FindHubClient(CredentialStore(CREDENTIALS_PATH), LOCATION_TIMEOUT_SECONDS)
    try:
        with closing(db.connect()) as database:
            return 0 if poll(database, client) else 1
    except AuthRequiredError as error:
        logger.error("%s. Run `python -m findhub.login` on your Mac and copy the file here.", error)
        return 2
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
