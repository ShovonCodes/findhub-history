import asyncio
import uuid

from findhub.google import auth
from findhub.google.credentials import (
    AAS_TOKEN,
    FCM_CREDENTIALS,
    OWNER_KEY,
    USERNAME,
    CredentialStore,
)
from findhub.google.errors import LocationTimeoutError
from findhub.google.locations import decrypt_locations
from findhub.google.nova import NovaClient
from findhub.google.proto import device_update_pb2
from findhub.google.push import PushListener
from findhub.models import Device, Location


class FindHubClient:
    """Lists Find Hub devices and fetches their latest locations using stored credentials."""

    def __init__(self, credentials: CredentialStore, location_timeout_seconds: float):
        self._credentials = credentials
        self._location_timeout_seconds = location_timeout_seconds
        self._loop = asyncio.new_event_loop()
        self._push = PushListener(credentials, self._on_push_payload)
        self._listening = False
        self._nova: NovaClient | None = None
        self._pending_replies: dict[str, asyncio.Future] = {}

    def list_devices(self) -> list[Device]:
        return [
            Device(id=device_id, name=name)
            for name, device_id in self._nova_client().list_devices()
        ]

    def fetch_locations(self, device_id: str) -> list[Location]:
        owner_key = bytes.fromhex(self._credentials.require(OWNER_KEY))
        self._start_listening()

        request_uuid = str(uuid.uuid4())
        reply = self._loop.create_future()
        self._pending_replies[request_uuid] = reply
        try:
            self._nova_client().request_location(device_id, self._push.token, request_uuid)
            device_update = self._loop.run_until_complete(
                asyncio.wait_for(reply, self._location_timeout_seconds)
            )
        except asyncio.TimeoutError as error:
            raise LocationTimeoutError(
                f"No location reply within {self._location_timeout_seconds:g} seconds"
            ) from error
        finally:
            self._pending_replies.pop(request_uuid, None)

        return decrypt_locations(device_update, owner_key)

    def close(self) -> None:
        if self._listening:
            self._loop.run_until_complete(self._push.stop())
        self._loop.close()

    def _nova_client(self) -> NovaClient:
        if self._nova is None:
            android_id = int(self._credentials.require(FCM_CREDENTIALS)["gcm"]["android_id"])
            access_token = auth.access_token(
                self._credentials.require(USERNAME),
                self._credentials.require(AAS_TOKEN),
                android_id,
                auth.FIND_HUB_SCOPE,
            )
            self._nova = NovaClient(access_token)
        return self._nova

    def _start_listening(self) -> None:
        if not self._listening:
            self._loop.run_until_complete(self._push.start())
            self._listening = True

    def _on_push_payload(self, payload: bytes) -> None:
        device_update = device_update_pb2.DeviceUpdate()
        device_update.ParseFromString(payload)
        reply = self._pending_replies.get(device_update.fcmMetadata.requestUuid)
        if reply is not None and not reply.done():
            reply.set_result(device_update)
