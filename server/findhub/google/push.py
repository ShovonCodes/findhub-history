import asyncio
import base64
import logging
from collections.abc import Callable

from findhub.google.auth import APP_SIGNATURE_SHA1, FIND_HUB_APP
from findhub.google.credentials import FCM_CREDENTIALS, CredentialStore
from findhub.google.errors import GoogleRequestError
from findhub.google.fcm import FcmPushClient, FcmRegisterConfig

FIND_HUB_FIREBASE = FcmRegisterConfig(
    project_id="google.com:api-project-289722593072",
    app_id="1:289722593072:android:3cfcf5bc359f0308",
    api_key="AIzaSyD_gko3P392v6how2H7UpdeXQ0v2HLettc",
    messaging_sender_id="289722593072",
    bundle_id=FIND_HUB_APP,
    android_package=FIND_HUB_APP,
    android_cert_sha1=APP_SIGNATURE_SHA1,
)
FIND_HUB_PAYLOAD_KEY = "com.google.android.apps.adm.FCM_PAYLOAD"

logger = logging.getLogger(__name__)


class PushListener:
    """Receives Find Hub push messages as the Android device registered in the credentials."""

    def __init__(self, credentials: CredentialStore, on_payload: Callable[[bytes], None]):
        self._credentials = credentials
        self._on_payload = on_payload
        self._client = FcmPushClient(
            self._on_message,
            FIND_HUB_FIREBASE,
            credentials.get(FCM_CREDENTIALS),
            self._on_credentials_updated,
        )
        self.token: str | None = None

    @property
    def android_id(self) -> int:
        if self._client.credentials is None:
            raise RuntimeError("register() must run before android_id is known")
        return int(self._client.credentials["gcm"]["android_id"])

    async def register(self) -> str:
        """Check in with Firebase (registering on first use) and return the push token."""
        try:
            self.token = await self._client.checkin_or_register()
        except Exception as error:
            raise GoogleRequestError(f"Could not register for push messages: {error}") from error
        return self.token

    async def start(self) -> None:
        if self.token is None:
            await self.register()
        await self._client.start()

    async def stop(self) -> None:
        await self._client.stop()
        await asyncio.gather(*self._client.tasks, return_exceptions=True)

    def _on_message(self, message: object, persistent_id: str, context: object) -> None:
        data = message.get("data", {}) if isinstance(message, dict) else {}
        payload = data.get(FIND_HUB_PAYLOAD_KEY)
        if payload is None:
            logger.warning("Ignoring push message %s without a Find Hub payload", persistent_id)
            return
        self._on_payload(base64.b64decode(payload))

    def _on_credentials_updated(self, credentials: dict) -> None:
        self._credentials.set(FCM_CREDENTIALS, credentials)
