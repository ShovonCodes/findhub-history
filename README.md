# Find Hub Tracker

Keeps a history of where your Google Find Hub trackers and phones have been, and shows it on a private map.

- `server/findhub/poll.py` asks Google for every device's latest location and stores new points in SQLite.
  A systemd timer runs it every 15 minutes.
- `server/findhub/web.py` serves two read-only JSON endpoints and the React app in `web/`.
- `server/findhub/login/` runs once on your Mac to sign in to Google and write the credentials file.
- `server/findhub/google/` is the Find Hub protocol code, trimmed down from [google-find-hub-sync](https://github.com/traccar/google-find-hub-sync) (see its `NOTICE.md`).

The web app has no login of its own.
It listens on `127.0.0.1` only and is reached through [Tailscale](https://tailscale.com), so only your own devices can open it.

## 1. Sign in on your Mac

Chrome must be installed.

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install '.[login]'
.venv/bin/python -m findhub.login --credentials ~/findhub-credentials.json
```

Chrome opens twice: once to sign in, and once to unlock your end-to-end encryption keys (Google may ask for your phone's screen lock).
The resulting file gives full access to your Google account, so keep it private and delete your local copy once it is on the server.

## 2. Install on the Ubuntu server

You need Python 3.10 or newer, Node.js 20.19 or newer (`sudo snap install node --classic`), and Tailscale.

```bash
sudo git clone <this repository> /opt/findhub
cd /opt/findhub
sudo python3 -m venv server/.venv
sudo server/.venv/bin/pip install ./server
(cd web && sudo npm ci && sudo npm run build)

sudo useradd --system --home-dir /var/lib/findhub --create-home --shell /usr/sbin/nologin findhub
sudo chmod 700 /var/lib/findhub
```

Copy the credentials from your Mac, then remove both temporary copies:

```bash
# On the Mac
scp ~/findhub-credentials.json server:/tmp/
rm ~/findhub-credentials.json

# On the server
sudo install -o findhub -g findhub -m 600 /tmp/findhub-credentials.json /var/lib/findhub/credentials.json
rm /tmp/findhub-credentials.json
```

Start everything and publish it on your tailnet:

```bash
sudo cp deploy/findhub-web.service deploy/findhub-poll.service deploy/findhub-poll.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now findhub-web.service findhub-poll.timer
sudo tailscale serve --bg 8400
```

Open the `https://<server>.<tailnet>.ts.net` address that `tailscale serve` prints, from any device signed in to your Tailscale account.

## Day to day

| Task | Command |
|---|---|
| See poll results | `journalctl -u findhub-poll -n 50` |
| Poll right now | `sudo systemctl start findhub-poll` |
| Change the interval | `sudo systemctl edit findhub-poll.timer` and set `OnCalendar=` |
| Update | `cd /opt/findhub && sudo git pull`, repeat the `pip install` and `npm` steps, `sudo systemctl restart findhub-web` |

If Google rejects the login, the poll log says so.
Run the sign-in step on your Mac again and copy the new file over the old one.

## Development

```bash
cd server && .venv/bin/pip install -e '.[login,dev]'
.venv/bin/pytest && .venv/bin/ruff check .

FINDHUB_DB=dev.db FINDHUB_CREDENTIALS=~/findhub-credentials.json .venv/bin/python -m findhub.poll
FINDHUB_DB=dev.db .venv/bin/uvicorn findhub.web:app --port 8400 --reload

cd web && npm install && npm run dev    # proxies /api to port 8400
npm run check                           # typecheck, lint, tests
```
