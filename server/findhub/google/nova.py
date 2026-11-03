import uuid

import requests
from google.protobuf.message import Message

from findhub.google.errors import AuthRequiredError, GoogleRequestError
from findhub.google.proto import device_update_pb2 as proto

NOVA_URL = "https://android.googleapis.com/nova/"
LIST_DEVICES = "nbe_list_devices"
EXECUTE_ACTION = "nbe_execute_action"
HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept-Language": "en-US",
    "User-Agent": "fmd/20006320; gzip",
}
REQUEST_TIMEOUT_SECONDS = 30
# Google requires this field to be set; any past timestamp is accepted.
HIGH_TRAFFIC_ENABLING_TIME = 1732120060


class NovaClient:
    """Find Hub's device API, as used by the Android app."""

    def __init__(self, access_token: str):
        self._access_token = access_token
        self._client_uuid = str(uuid.uuid4())

    def list_devices(self) -> list[tuple[str, str]]:
        """Return (name, device id) for every tracker and phone on the account."""
        request = proto.DevicesListRequest()
        request.deviceListRequestPayload.type = proto.DeviceType.SPOT_DEVICE
        request.deviceListRequestPayload.id = str(uuid.uuid4())

        devices = proto.DevicesList()
        devices.ParseFromString(self._post(LIST_DEVICES, request))
        return [
            (device.userDefinedDeviceName, canonic_id.id)
            for device in devices.deviceMetadata
            for canonic_id in _canonic_ids(device)
        ]

    def request_location(self, device_id: str, push_token: str, request_uuid: str) -> None:
        """Ask Google to locate a device; the answer arrives later as a push message."""
        request = proto.ExecuteActionRequest()
        request.scope.type = proto.DeviceType.SPOT_DEVICE
        request.scope.device.canonicId.id = device_id

        metadata = request.requestMetadata
        metadata.type = proto.DeviceType.SPOT_DEVICE
        metadata.requestUuid = request_uuid
        metadata.fmdClientUuid = self._client_uuid
        metadata.gcmRegistrationId.id = push_token
        metadata.unknown = True

        locate = request.action.locateTracker
        locate.lastHighTrafficEnablingTime.seconds = HIGH_TRAFFIC_ENABLING_TIME
        locate.contributorType = proto.SpotContributorType.FMDN_ALL_LOCATIONS

        self._post(EXECUTE_ACTION, request)

    def _post(self, scope: str, message: Message) -> bytes:
        response = requests.post(
            NOVA_URL + scope,
            headers={**HEADERS, "Authorization": f"Bearer {self._access_token}"},
            data=message.SerializeToString(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code == 401:
            raise AuthRequiredError("Google rejected the access token; log in again")
        if response.status_code != 200:
            raise GoogleRequestError(
                f"Find Hub {scope} failed with HTTP {response.status_code}: {response.text[:200]}"
            )
        return response.content


def _canonic_ids(device: proto.DeviceMetadata):
    identifiers = device.identifierInformation
    if identifiers.type == proto.IDENTIFIER_ANDROID:
        return identifiers.phoneInformation.canonicIds.canonicId
    return identifiers.canonicIds.canonicId
