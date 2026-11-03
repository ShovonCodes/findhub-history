import os

import pytest
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from findhub.google import crypto

# Generated with google-find-hub-sync's original FMDN implementation.
IDENTITY_KEY = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
LOCATION = bytes.fromhex("0dd829310e1548dae335180c")
BEACON_TIME = 0x84D123
CROWDSOURCED_REPORT = bytes.fromhex("8bbab71335a53700a63d7dd9feaa826bf0b7bd25c815089d2ee3d45b")
SENDER_PUBLIC_X = bytes.fromhex("108590fb3ef32087b8a47f93b307605731539dcb")


def encrypt_gcm(key: bytes, plaintext: bytes) -> bytes:
    iv = os.urandom(12)
    return iv + AESGCM(key).encrypt(iv, plaintext, None)


def encrypt_cbc(key: bytes, plaintext: bytes) -> bytes:
    iv = os.urandom(16)
    encryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor()
    return iv + encryptor.update(plaintext) + encryptor.finalize()


def test_decrypts_crowdsourced_report_like_the_original_implementation():
    decrypted = crypto.decrypt_crowdsourced_report(
        IDENTITY_KEY, CROWDSOURCED_REPORT, SENDER_PUBLIC_X, BEACON_TIME
    )

    assert decrypted == LOCATION


def test_beacon_time_within_the_same_rotation_period_decrypts():
    rotation_start = BEACON_TIME & ~0x3FF

    decrypted = crypto.decrypt_crowdsourced_report(
        IDENTITY_KEY, CROWDSOURCED_REPORT, SENDER_PUBLIC_X, rotation_start
    )

    assert decrypted == LOCATION


def test_tampered_crowdsourced_report_is_rejected():
    tampered = bytes([CROWDSOURCED_REPORT[0] ^ 1]) + CROWDSOURCED_REPORT[1:]

    with pytest.raises(ValueError):
        crypto.decrypt_crowdsourced_report(IDENTITY_KEY, tampered, SENDER_PUBLIC_X, BEACON_TIME)


@pytest.mark.parametrize("encrypt", [encrypt_gcm, encrypt_cbc])
def test_decrypts_identity_key_in_both_formats(encrypt):
    owner_key = os.urandom(32)

    assert crypto.decrypt_identity_key(owner_key, encrypt(owner_key, IDENTITY_KEY)) == IDENTITY_KEY


def test_rejects_identity_key_of_unknown_length():
    with pytest.raises(ValueError, match="length"):
        crypto.decrypt_identity_key(os.urandom(32), b"\x00" * 50)


def test_decrypts_owner_key():
    shared_key = os.urandom(32)
    owner_key = os.urandom(32)

    assert crypto.decrypt_owner_key(shared_key, encrypt_gcm(shared_key, owner_key)) == owner_key
