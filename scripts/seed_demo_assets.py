# -*- coding: utf-8 -*-
"""Seed demo content from demo_assets/ into Cleon modules.

Run from Odoo shell:
    ./odoo-bin shell -c odoo.conf -d YOUR_DB < /path/to/white_clone/scripts/seed_demo_assets.py

Expects:
    demo_assets/social_gallery/<album>/*.{jpg,png,...}
    demo_assets/company_documentary/<folder>/*.{mp4,webm,mov}
    demo_assets/documents/<employee or folder name>/*.{pdf,...}
"""
from __future__ import annotations

import base64
import hashlib
import mimetypes
import os
import uuid
from pathlib import Path

from odoo import fields

# Odoo shell injects `env`; when executed directly this is a no-op guard.
if "env" not in globals():
    raise SystemExit(
        "Run via Odoo shell:\n"
        "  ./odoo-bin shell -c odoo.conf -d DB < scripts/seed_demo_assets.py"
    )

try:
    REPO_ROOT = Path(__file__).resolve().parents[1]
except NameError:
    REPO_ROOT = Path(os.environ.get("WHITE_CLONE_ROOT", "/Users/bankai/Documents/Projects/white_clone"))
ASSETS_ROOT = Path(os.environ.get("DEMO_ASSETS_PATH", REPO_ROOT / "demo_assets"))

GALLERY_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov"}
DOC_VIDEO_EXTS = {".mp4", ".webm", ".mov"}
DOCUMENT_EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}

GALLERY_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
}


def _log(msg):
    print(msg)


def _checksum(data):
    return hashlib.sha256(data).hexdigest()


def _mime_for(path, fallback_map=None):
    ext = path.suffix.lower()
    if fallback_map and ext in fallback_map:
        return fallback_map[ext]
    guessed, _encoding = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def _iter_files(folder, extensions):
    if not folder.is_dir():
        return
    for path in sorted(folder.iterdir()):
        if path.is_file() and path.suffix.lower() in extensions and not path.name.startswith("."):
            yield path


def _upload_r2_put(storage, object_key, body, content_type):
    config = storage.config()
    storage._client().put_object(
        Bucket=config["bucket"],
        Key=object_key,
        Body=body,
        ContentType=content_type,
    )


def _admin_env(env):
    admin = env.ref("base.user_admin")
    return env(user=admin)


def _get_or_create_album(env, name, company):
    Album = env["social.gallery.album"]
    album = Album.search([("company_id", "=", company.id), ("name", "=", name)], limit=1)
    if album:
        return album
    return Album.create({
        "name": name,
        "company_id": company.id,
        "created_by": env.user.id,
        "status": "approved",
        "visibility": "public",
        "access_scope": "company",
    })


def _get_or_create_doc_folder(env, folder_name, folder_type="organizational", employee=None):
    Folder = env["doc.folder"]
    domain = [("folder_name", "=", folder_name), ("folder_type", "=", folder_type)]
    folder = Folder.search(domain, limit=1)
    if folder:
        return folder
    vals = {
        "folder_name": folder_name,
        "folder_type": folder_type,
        "access_scope": "all_staff" if folder_type == "organizational" else "individual",
        "require_upload_approval": False,
        "owner_id": env.user.id,
        "company_id": env.company.id,
    }
    if employee:
        vals["employee_ids"] = [(6, 0, [employee.id])]
    return Folder.create(vals)


def _get_or_create_documentary_folder(env, name, company):
    Folder = env["company.documentary.folder"]
    folder = Folder.search([("company_id", "=", company.id), ("name", "=", name)], limit=1)
    if folder:
        return folder
    return Folder.create({
        "name": name,
        "company_id": company.id,
        "owner_id": env.user.id,
        "access_scope": "company",
    })


def _get_or_create_document_type(env, name="General"):
    DocType = env["doc.document.type"]
    doc_type = DocType.search([("name", "=", name)], limit=1)
    if doc_type:
        return doc_type
    return DocType.create({"name": name, "category": "other"})


def _resolve_employee(env, label):
    Employee = env["hr.employee"]
    label = label.strip()
    employee = Employee.search([("barcode", "=", label)], limit=1)
    if employee:
        return employee
    return Employee.search([("name", "ilike", label)], limit=1)


def seed_social_gallery(env):
    from odoo.addons.cleon_social_gallery.controllers.storage import CloudflareR2Storage
    from odoo.addons.cleon_social_gallery.models.gallery_thumbnail import generate_image_thumbnail

    root = ASSETS_ROOT / "social_gallery"
    if not root.is_dir():
        _log("Skip social gallery: no demo_assets/social_gallery/")
        return 0

    storage = CloudflareR2Storage(env)
    if not storage.is_configured():
        _log("Skip social gallery: R2 not configured")
        return 0

    company = env.company
    Media = env["social.gallery.media"]
    created = 0

    for album_dir in sorted(root.iterdir()):
        if not album_dir.is_dir():
            continue
        album_name = album_dir.name.replace("_", " ").title()
        album = _get_or_create_album(env, album_name, company)
        for path in _iter_files(album_dir, GALLERY_EXTS):
            data = path.read_bytes()
            checksum = _checksum(data)
            if Media.search_count([
                ("company_id", "=", company.id),
                ("checksum", "=", checksum),
                ("deleted_at", "=", False),
            ]):
                _log(f"  skip gallery (duplicate): {path.name}")
                continue

            mime = _mime_for(path, GALLERY_MIME)
            media_type = "video" if mime.startswith("video/") else "image"
            safe = path.name.replace(" ", "_")
            object_key = "social-gallery/%s/%s-%s" % (company.id, uuid.uuid4().hex, safe)
            _upload_r2_put(storage, object_key, data, mime)

            media = Media.create({
                "display_name": path.stem.replace("_", " ").title(),
                "description": "Demo upload",
                "album_id": album.id,
                "company_id": company.id,
                "media_type": media_type,
                "uploaded_by": env.user.id,
                "file_name": path.name,
                "mime_type": mime,
                "file_size": len(data),
                "checksum": checksum,
                "storage_key": object_key,
                "approval_status": "approved",
                "approved_by": env.user.id,
                "approved_at": fields.Datetime.now(),
                "ai_review_status": "passed",
                "comments_enabled": True,
            })

            if media_type == "image":
                thumb_bytes, thumb_mime = generate_image_thumbnail(data)
                if thumb_bytes:
                    thumb_key = "%s-thumb.jpg" % object_key.rsplit(".", 1)[0]
                    if storage.put_object_bytes(thumb_key, thumb_bytes, thumb_mime):
                        media.thumbnail_key = thumb_key

            created += 1
            _log(f"  gallery: {album_name} / {path.name}")

    return created


def seed_company_documentary(env):
    from odoo.addons.cleon_company_documentary.controllers.storage import CloudflareR2Storage

    root = ASSETS_ROOT / "company_documentary"
    if not root.is_dir():
        _log("Skip company documentary: no demo_assets/company_documentary/")
        return 0

    storage = CloudflareR2Storage(env)
    if not storage.is_configured():
        _log("Skip company documentary: R2 not configured")
        return 0

    company = env.company
    Media = env["company.documentary.media"]
    created = 0
    now = fields.Datetime.now()

    for folder_dir in sorted(root.iterdir()):
        if not folder_dir.is_dir():
            continue
        folder_name = folder_dir.name.replace("_", " ").title()
        folder = _get_or_create_documentary_folder(env, folder_name, company)
        for path in _iter_files(folder_dir, DOC_VIDEO_EXTS):
            data = path.read_bytes()
            checksum = _checksum(data)
            if Media.search_count([
                ("company_id", "=", company.id),
                ("checksum", "=", checksum),
                ("deleted_at", "=", False),
            ]):
                _log(f"  skip documentary (duplicate): {path.name}")
                continue

            mime = _mime_for(path, GALLERY_MIME)
            object_key = "%s/%s/original/%s" % (company.id, uuid.uuid4().hex, path.name.replace(" ", "_"))
            _upload_r2_put(storage, object_key, data, mime)

            Media.create({
                "name": path.stem.replace("_", " ").title(),
                "description": "<p>Demo training video</p>",
                "folder_id": folder.id,
                "owner_id": env.user.id,
                "uploaded_by": env.user.id,
                "original_filename": path.name,
                "mime_type": mime,
                "file_size": len(data),
                "checksum": checksum,
                "storage_key": object_key,
                "processing_state": "ready",
                "approval_status": "approved",
                "published_at": now,
                "comments_enabled": True,
                "download_policy": "allow",
            })
            created += 1
            _log(f"  documentary: {folder_name} / {path.name}")

    return created


def seed_documents(env):
    root = ASSETS_ROOT / "documents"
    if not root.is_dir():
        _log("Skip documents: no demo_assets/documents/")
        return 0

    Document = env["doc.document"]
    doc_type = _get_or_create_document_type(env)
    created = 0

    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            continue
        label = entry.name
        display_name = label.replace("_", " ").title()
        employee = _resolve_employee(env, label)
        if employee:
            folder = _get_or_create_doc_folder(env, employee.name, "employee", employee=employee)
        else:
            folder = _get_or_create_doc_folder(env, display_name, "organizational")
            _log(f"  note: no employee match for '{label}' — using organizational folder")

        for path in _iter_files(entry, DOCUMENT_EXTS):
            data = path.read_bytes()
            checksum = _checksum(data)
            attachment = env["ir.attachment"].search([
                ("checksum", "=", checksum),
                ("res_model", "=", "doc.document"),
            ], limit=1)
            if attachment:
                _log(f"  skip document (duplicate): {path.name}")
                continue

            attachment = env["ir.attachment"].create({
                "name": path.name,
                "datas": base64.b64encode(data),
                "mimetype": _mime_for(path),
                "type": "binary",
            })
            doc_vals = {
                "name": path.stem.replace("_", " ").title(),
                "folder_id": folder.id,
                "document_type_id": doc_type.id,
                "attachment_id": attachment.id,
                "uploaded_by": env.user.id,
                "owner_id": env.user.id,
                "state": "approved",
                "approval_state": "not_required",
            }
            if employee:
                doc_vals["employee_id"] = employee.id
            Document.create(doc_vals)
            created += 1
            _log(f"  document: {label} / {path.name}")

    return created


def seed_compliance_policy(env):
    Policy = env["doc.compliance.policy"]
    if Policy.search_count([]):
        _log("Skip compliance policy: policies already exist")
        return 0

    policy_type = env.ref("cleon_document_management.policy_type_document_requirement")
    doc_type = _get_or_create_document_type(env, "General")
    department = env["hr.department"].search([], limit=1)
    Policy.create({
        "name": "Demo — Required onboarding documents",
        "policy_type_id": policy_type.id,
        "document_type_ids": [(6, 0, [doc_type.id])],
        "applies_to": "department" if department else "all",
        "department_ids": [(6, 0, [department.id])] if department else [],
        "schedule": "one_time",
        "minimum_documents": 1,
        "grace_period_days": 14,
        "description": "Demo policy for board presentation.",
    })
    _log("  compliance: created demo policy")
    return 1


def main(env):
    if not ASSETS_ROOT.is_dir():
        raise SystemExit(f"Assets folder not found: {ASSETS_ROOT}")

    _log(f"Seeding demo assets from: {ASSETS_ROOT}")
    env = _admin_env(env)

    gallery_count = seed_social_gallery(env)
    documentary_count = seed_company_documentary(env)
    document_count = seed_documents(env)
    policy_count = seed_compliance_policy(env)

    env.cr.commit()
    _log("")
    _log("Done:")
    _log(f"  Social Gallery media:  {gallery_count}")
    _log(f"  Documentary videos:    {documentary_count}")
    _log(f"  HR documents:          {document_count}")
    _log(f"  Compliance policies:   {policy_count}")
    _log("")
    _log("Refresh the apps in your browser to see the new content.")


main(env)
