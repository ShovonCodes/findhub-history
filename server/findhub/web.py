"""Read-only API over the stored locations, plus the React app.

uvicorn findhub.web:app --host 127.0.0.1 --port 8400
"""

import os
import time
from contextlib import closing
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from findhub import db

WEB_DIST = Path(
    os.environ.get("FINDHUB_WEB_DIST", Path(__file__).resolve().parents[2] / "web" / "dist")
)
ONE_DAY = 24 * 60 * 60

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/api/devices")
def devices() -> list[dict]:
    with closing(db.connect()) as database:
        return db.devices_with_latest(database)


@app.get("/api/devices/{device_id}/locations")
def locations(device_id: str, since: int | None = None) -> list[dict]:
    with closing(db.connect()) as database:
        return db.trail(
            database, device_id, since if since is not None else int(time.time()) - ONE_DAY
        )


@app.get("/api/polls")
def polls() -> dict:
    with closing(db.connect()) as database:
        return db.poll_schedule(database)


app.mount("/", StaticFiles(directory=WEB_DIST, html=True, check_dir=False), name="web")
