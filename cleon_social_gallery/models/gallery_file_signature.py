"""Validate upload MIME types using file magic bytes (SRS §10)."""

ALLOWED_SIGNATURES = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/gif": (b"GIF87a", b"GIF89a"),
    "image/webp": (b"RIFF",),  # RIFF....WEBP checked below
    "video/mp4": (b"\x00\x00\x00", b"ftyp"),  # ISO BMFF: size + ftyp at offset 4
    "video/webm": (b"\x1a\x45\xdf\xa3",),
    "video/quicktime": (b"\x00\x00\x00",),
}


def _starts_with(header, prefix):
    return header.startswith(prefix)


def _is_webp(header):
    return len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP"


def _is_mp4_or_mov(header):
    if len(header) < 12:
        return False
    if header[4:8] == b"ftyp":
        return True
    if len(header) >= 8 and header[4:8] in {b"qt  ", b"moov", b"mdat"}:
        return True
    return False


def mime_matches_bytes(mime_type, header):
    if not header:
        return False
    mime = (mime_type or "").lower().strip()
    if mime == "image/webp":
        return _is_webp(header)
    if mime in ("video/mp4", "video/quicktime"):
        return _is_mp4_or_mov(header)
    prefixes = ALLOWED_SIGNATURES.get(mime, ())
    return any(_starts_with(header, prefix) for prefix in prefixes)
