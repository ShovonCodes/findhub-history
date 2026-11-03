import struct

import httpx

from findhub.google.errors import AuthRequiredError, GoogleRequestError
from findhub.google.proto import common_pb2, device_update_pb2

SPOT_URL = "https://spot-pa.googleapis.com/google.internal.spot.v1.SpotService/"
GRPC_HEADER = struct.Struct(">BI")
REQUEST_TIMEOUT_SECONDS = 30


def encrypted_owner_key(access_token: str) -> bytes:
    """Fetch the account's owner key, encrypted with the end-to-end encryption shared key."""
    request = common_pb2.GetEidInfoForE2eeDevicesRequest(
        ownerKeyVersion=-1, hasOwnerKeyVersion=True
    )
    response = device_update_pb2.GetEidInfoForE2eeDevicesResponse()
    response.ParseFromString(_grpc_call(access_token, "GetEidInfoForE2eeDevices", request))
    return response.encryptedOwnerKeyAndMetadata.encryptedOwnerKey


def _grpc_call(access_token: str, method: str, request) -> bytes:
    payload = request.SerializeToString()
    with httpx.Client(http2=True, timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = client.post(
            SPOT_URL + method,
            headers={
                "User-Agent": "com.google.android.gms/244433022 grpc-java-cronet/1.69.0-SNAPSHOT",
                "Content-Type": "application/grpc",
                "Te": "trailers",
                "Authorization": f"Bearer {access_token}",
                "Grpc-Accept-Encoding": "gzip",
            },
            content=GRPC_HEADER.pack(0, len(payload)) + payload,
        )
    if response.status_code == 401:
        raise AuthRequiredError("Google rejected the access token; log in again")
    if response.status_code != 200 or len(response.content) < GRPC_HEADER.size:
        raise GoogleRequestError(f"Spot {method} failed with HTTP {response.status_code}")

    _, length = GRPC_HEADER.unpack_from(response.content)
    return response.content[GRPC_HEADER.size : GRPC_HEADER.size + length]
