import logging

from odoo import _
from odoo.exceptions import UserError


_logger = logging.getLogger(__name__)


class CloudflareR2Storage:
    """S3-compatible Cloudflare R2 adapter.

    Credentials come from ir.config_parameter and are never returned to the
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
        unknown = set(values) - set(self.PARAMS)
        if unknown:
            raise UserError(_("Unsupported storage settings: %s") % ", ".join(sorted(unknown)))
        params = self.env["ir.config_parameter"].sudo()
        for name, value in values.items():
            if value is not None:
                params.set_param(self.PARAMS[name], str(value).strip())
        if values.get("account_id") and not values.get("endpoint_url"):
            params.set_param(
                self.PARAMS["endpoint_url"],
                "https://%s.r2.cloudflarestorage.com" % values["account_id"].strip(),
            )
        return self.public_status()

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
        self._client().head_bucket(Bucket=config["bucket"])
        return {"reachable": True, "bucket": config["bucket"]}
