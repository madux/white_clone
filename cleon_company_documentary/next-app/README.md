# CLEON Company Documentary frontend

This is a standalone Next.js service for the Company Documentary module. It is
intentionally separate from `cleon_document_management/next-app`; the two
frontends share no UI or client code and communicate through Odoo API routes.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_ODOO_URL` to the Odoo server that serves the
`cleon_company_documentary` addon. The browser uses Odoo's authenticated
session and never receives Cloudflare R2 credentials. Video upload parts go
directly to signed R2 URLs, then the app completes the upload through Odoo.

To build and copy the static export into the addon for Odoo to serve:

```bash
npm run deploy
```
