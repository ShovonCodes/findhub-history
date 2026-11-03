import base64

from findhub.google.credentials import FCM_CREDENTIALS, CredentialStore
from findhub.google.fcm.fcmpushclient import _header_param, _urlsafe_b64decode_unpadded
from findhub.google.push import FIND_HUB_PAYLOAD_KEY, PushListener


def listener(tmp_path, received: list) -> PushListener:
    return PushListener(CredentialStore(tmp_path / "credentials.json"), received.append)


def test_find_hub_payload_is_decoded_and_forwarded(tmp_path):
    received = []

    listener(tmp_path, received)._on_message(
        {"data": {FIND_HUB_PAYLOAD_KEY: base64.b64encode(b"device update").decode()}}, "id-1", None
    )

    assert received == [b"device update"]


def test_messages_without_payload_are_ignored(tmp_path):
    received = []

    listener(tmp_path, received)._on_message({"data": {"other": "value"}}, "id-1", None)
    listener(tmp_path, received)._on_message(b"raw bytes", "id-2", None)

    assert received == []


def test_updated_push_credentials_are_saved(tmp_path):
    push_listener = listener(tmp_path, [])

    push_listener._on_credentials_updated({"gcm": {"android_id": "123"}})

    assert CredentialStore(tmp_path / "credentials.json").get(FCM_CREDENTIALS) == {
        "gcm": {"android_id": "123"}
    }


def test_crypto_key_header_with_vapid_key_is_parsed():
    header = "dh=BO75875-GJqxD-ZFLaskzAgtZuw; p256ecdsa=BDOU99-h67HcA6JeFXHbSNMu"

    assert _header_param(header, "dh") == "BO75875-GJqxD-ZFLaskzAgtZuw"
    assert _header_param("salt=qDa_fq2TG1qiSRJKCajAaw==", "salt") == "qDa_fq2TG1qiSRJKCajAaw=="


def test_unpadded_base64_is_decoded():
    assert _urlsafe_b64decode_unpadded("aGk") == b"hi"
