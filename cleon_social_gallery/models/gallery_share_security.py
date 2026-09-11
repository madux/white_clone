# -*- coding: utf-8 -*-
import hashlib
import secrets


def hash_share_password(password):
    plain = (password or "").strip()
    if not plain:
        return False
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", plain.encode("utf-8"), salt.encode("utf-8"), 120000
    ).hex()
    return "pbkdf2_sha256$%s$%s" % (salt, digest)


def verify_share_password(password, stored):
    plain = (password or "").strip()
    stored = stored or ""
    if not stored:
        return True
    if not plain:
        return False
    if stored.startswith("pbkdf2_sha256$"):
        try:
            _, salt, digest = stored.split("$", 2)
        except ValueError:
            return False
        check = hashlib.pbkdf2_hmac(
            "sha256", plain.encode("utf-8"), salt.encode("utf-8"), 120000
        ).hex()
        return check == digest
    return plain == stored
