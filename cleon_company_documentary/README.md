# CLEON Company Documentary backend

This addon provides the backend foundation for the Company Documentary video
library. Video bytes are not stored in PostgreSQL. The API creates Cloudflare
R2 multipart upload sessions, signs upload parts, completes/aborts uploads,
and returns short-lived signed playback/download URLs.

## Cloudflare R2 configuration

Set these protected Odoo system parameters later, through the authenticated
administrator endpoint or Odoo configuration:

| Parameter | Meaning |
| --- | --- |
| `company_documentary.r2_account_id` | Cloudflare account identifier |
| `company_documentary.r2_endpoint_url` | `https://<account-id>.r2.cloudflarestorage.com` |
| `company_documentary.r2_access_key_id` | R2 access key ID |
| `company_documentary.r2_secret_access_key` | R2 secret access key |
| `company_documentary.r2_bucket` | Private R2 bucket name |
| `company_documentary.r2_region` | Usually `auto` |

The API never returns the access key or secret. `POST /api/company-documentary/storage/config`
returns only safe configuration status and accepts `check: true` for a bucket
connectivity check. Install `boto3` in the Odoo runtime before enabling uploads.

## API groups

- `/api/company-documentary/storage/*` — protected storage configuration.
- `/api/company-documentary/folders/*` — hierarchy, access targets, archive,
  restore, and recycle state.
- `/api/company-documentary/media` — permission-filtered video listing.
- `/api/company-documentary/uploads/*` — resumable multipart upload lifecycle.
- `/api/company-documentary/media/*` — metadata, signed stream/download URLs,
  favorites, and lifecycle actions.
- `/api/company-documentary/watch-progress` — employee playback progress.
- `/api/company-documentary/analytics` and `/api/company-documentary/analytics/summary` — manager-level dashboard data with date, department, folder, and media filters.
- `company.documentary.watch.event` — auditable playback, completion, favorite, comment, and download events used for trend reporting.

The frontend should upload parts directly to the signed R2 URLs and then call
the completion endpoint with the returned ETags. It should never receive or
store the R2 secret.
