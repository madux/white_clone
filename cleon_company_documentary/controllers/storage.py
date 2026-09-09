import logging
import os

from odoo import _
from odoo.exceptions import UserError


_logger = logging.getLogger(__name__)

_ENV_SECRET_KEYS = {
    "access_key_id": "COMPANY_DOCUMENTARY_R2_ACCESS_KEY_ID",
    "secret_access_key": "COMPANY_DOCUMENTARY_R2_SECRET_ACCESS_KEY",
}


class CloudflareR2Storage:
    """S3-compatible Cloudflare R2 adapter.

    Credentials are platform-managed via ir.config_parameter (and optional
    environment-variable overrides for secrets). They are never returned to the
    browser. boto3 is imported lazily so the addon can be installed before
    the deployment image adds the storage dependency.
    """

    PARAMS = {
        "account_id": "company_documentary.r2_account_id",
        "endpoint_url": "company_documentary.r2_endpoint_url",
        "access_key_id": "company_documentary.r2_access_key_id",
        "secret_access_key": "company_documentary.r2_secret_access_key",
        "bucket": "company_documentary.r2_bucket",
        "region": "company_documentary.r2_region",
    }

    def __init__(self, env):
        self.env = env

    def config(self):
        params = self.env["ir.config_parameter"].sudo()
        values = {name: params.get_param(key, "") for name, key in self.PARAMS.items()}
        for name, env_key in _ENV_SECRET_KEYS.items():
            env_value = os.environ.get(env_key, "").strip()
            if env_value:
                values[name] = env_value
        values["region"] = values["region"] or "auto"
        return values

    def is_configured(self):
        config = self.config()
        return all(config.get(key) for key in ("endpoint_url", "access_key_id", "secret_access_key", "bucket"))

    def public_status(self):
        config = self.config()
        return {
            "provider": "cloudflare_r2",
            "configured": self.is_configured(),
            "bucket": config["bucket"] or None,
            "endpoint_url": config["endpoint_url"] or None,
            "region": config["region"],
            "credentials_present": bool(config["access_key_id"] and config["secret_access_key"]),
        }

    def save_config(self, values):
        _logger.info(
            "Rejected attempt to change platform-managed Company Documentary storage settings.",
        )
        raise UserError(
            _("Cloudflare R2 storage is platform-managed and cannot be changed from the app."),
        )

    def cors_origins(self):
        params = self.env["ir.config_parameter"].sudo()
        configured = params.get_param("company_documentary.r2_cors_origins", "")
        origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
        base_url = params.get_param("web.base.url", "").strip().rstrip("/")
        if base_url:
            origins.append(base_url)
        origins.append("http://localhost:8069")
        return list(dict.fromkeys(origins))

    def ensure_bucket_cors(self):
        if not self.is_configured():
            return []
        config = self.config()
        origins = self.cors_origins()
        try:
            self._client().put_bucket_cors(
                Bucket=config["bucket"],
                CORSConfiguration={
                    "CORSRules": [{
                        "AllowedHeaders": ["*"],
                        "AllowedMethods": ["GET", "PUT", "HEAD", "POST"],
                        "AllowedOrigins": origins,
                        "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
                        "MaxAgeSeconds": 3600,
                    }],
                },
            )
            return origins
        except Exception as error:
            _logger.warning(
                "Could not apply Company Documentary R2 CORS via API (%s). "
                "Add the CORS policy manually in Cloudflare for bucket %s. Origins: %s",
                error,
                config["bucket"],
                ", ".join(origins),
            )
            return []

    def _client(self):
        config = self.config()
        if not self.is_configured():
            raise UserError(_("Cloudflare R2 storage is not configured yet."))
        try:
            import boto3
        except ImportError as error:
            _logger.exception("boto3 is required for Company Documentary storage")
            raise UserError(_("The server storage dependency boto3 is not installed.")) from error
        return boto3.client(
            "s3",
            endpoint_url=config["endpoint_url"],
            aws_access_key_id=config["access_key_id"],
            aws_secret_access_key=config["secret_access_key"],
            region_name=config["region"],
        )

    def initiate_multipart(self, object_key, content_type):
        config = self.config()
        response = self._client().create_multipart_upload(Bucket=config["bucket"], Key=object_key, ContentType=content_type)
        return response["UploadId"]

    def sign_part(self, object_key, upload_id, part_number, expires=900):
        config = self.config()
        return self._client().generate_presigned_url(
            "upload_part",
            Params={"Bucket": config["bucket"], "Key": object_key, "UploadId": upload_id, "PartNumber": part_number},
            ExpiresIn=expires,
            HttpMethod="PUT",
        )

    def sign_put_object(self, object_key, content_type, expires=900):
        config = self.config()
        return self._client().generate_presigned_url(
            "put_object",
            Params={
                "Bucket": config["bucket"],
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires,
            HttpMethod="PUT",
        )

    def complete_multipart(self, object_key, upload_id, parts):
        config = self.config()
        return self._client().complete_multipart_upload(
            Bucket=config["bucket"], Key=object_key, UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )

    def abort_multipart(self, object_key, upload_id):
        config = self.config()
        return self._client().abort_multipart_upload(Bucket=config["bucket"], Key=object_key, UploadId=upload_id)

    def signed_object_url(self, object_key, download=False, filename=None, expires=600):
        config = self.config()
        params = {"Bucket": config["bucket"], "Key": object_key}
        if download:
            params["ResponseContentDisposition"] = "attachment; filename=%s" % (filename or "download")
        return self._client().generate_presigned_url("get_object", Params=params, ExpiresIn=expires)

    def check_connection(self):
        config = self.config()
        origins = self.ensure_bucket_cors()
        self._client().head_bucket(Bucket=config["bucket"])
        return {"reachable": True, "bucket": config["bucket"], "cors_origins": origins}
