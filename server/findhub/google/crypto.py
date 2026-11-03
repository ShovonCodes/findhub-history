"""Decryption for Find Hub keys and location reports (Fast Pair Find My Device Network spec)."""

from Cryptodome.Cipher import AES
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from ecdsa import SECP160r1
from ecdsa.ellipticcurve import Point

GCM_IV_LENGTH = 12
CBC_IV_LENGTH = 16
EAX_TAG_LENGTH = 16
EID_ROTATION_EXPONENT = 10
CBC_ENCRYPTED_EIK_LENGTH = 48
GCM_ENCRYPTED_EIK_LENGTH = 60


def decrypt_aes_gcm(key: bytes, iv_and_ciphertext: bytes) -> bytes:
    iv, ciphertext = iv_and_ciphertext[:GCM_IV_LENGTH], iv_and_ciphertext[GCM_IV_LENGTH:]
    return AESGCM(key).decrypt(iv, ciphertext, None)


def decrypt_aes_cbc_no_padding(key: bytes, iv_and_ciphertext: bytes) -> bytes:
    iv, ciphertext = iv_and_ciphertext[:CBC_IV_LENGTH], iv_and_ciphertext[CBC_IV_LENGTH:]
    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor()
    return decryptor.update(ciphertext) + decryptor.finalize()


def decrypt_owner_key(shared_key: bytes, encrypted_owner_key: bytes) -> bytes:
    return decrypt_aes_gcm(shared_key, encrypted_owner_key)


def decrypt_identity_key(owner_key: bytes, encrypted_identity_key: bytes) -> bytes:
    if len(encrypted_identity_key) == CBC_ENCRYPTED_EIK_LENGTH:
        return decrypt_aes_cbc_no_padding(owner_key, encrypted_identity_key)
    if len(encrypted_identity_key) == GCM_ENCRYPTED_EIK_LENGTH:
        return decrypt_aes_gcm(owner_key, encrypted_identity_key)
    raise ValueError(f"Unexpected encrypted identity key length {len(encrypted_identity_key)}")


def decrypt_crowdsourced_report(
    identity_key: bytes, encrypted_and_tag: bytes, sender_public_x: bytes, beacon_time: int
) -> bytes:
    """Decrypt a location report that another Android phone uploaded for the tracker."""
    curve = SECP160r1
    r = _ephemeral_private_key(identity_key, beacon_time)
    tracker_point = r * curve.generator

    sender_x = int.from_bytes(sender_public_x, "big")
    sender_point = Point(curve.curve, sender_x, _y_for_x(sender_x, curve.curve))

    shared_x = (r * sender_point).x().to_bytes(20, "big")
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"").derive(shared_x)
    nonce = tracker_point.x().to_bytes(20, "big")[12:] + sender_point.x().to_bytes(20, "big")[12:]

    ciphertext, tag = encrypted_and_tag[:-EAX_TAG_LENGTH], encrypted_and_tag[-EAX_TAG_LENGTH:]
    return AES.new(key, AES.MODE_EAX, nonce=nonce).decrypt_and_verify(ciphertext, tag)


def _ephemeral_private_key(identity_key: bytes, timestamp: int) -> int:
    masked_timestamp = (timestamp & ~((1 << EID_ROTATION_EXPONENT) - 1)).to_bytes(4, "big")
    block = (
        b"\xff" * 11
        + bytes([EID_ROTATION_EXPONENT])
        + masked_timestamp
        + b"\x00" * 11
        + bytes([EID_ROTATION_EXPONENT])
        + masked_timestamp
    )
    r_dash = AES.new(identity_key, AES.MODE_ECB).encrypt(block)
    return int.from_bytes(r_dash, "big") % SECP160r1.order


def _y_for_x(x: int, curve) -> int:
    y_squared = (x**3 + curve.a() * x + curve.b()) % curve.p()
    y = pow(y_squared, (curve.p() + 1) // 4, curve.p())
    if (y**2) % curve.p() != y_squared:
        raise ValueError("Report public key is not on the SECP160r1 curve")
    return curve.p() - y if y % 2 else y
