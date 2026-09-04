# CLEONHR Document Management Frontend

This is the Next.js frontend for the Odoo `cleon_document_management` module.
The frontend is exported as static files and served by Odoo at:

```text
/document-management
```

## Requirements

- Node.js and npm
- The Odoo project and Python environment used by this repository
- A running Odoo instance for backend-backed testing

Install dependencies from this directory:

```bash
cd cleon_document_management/next-app
npm install
```

## Development

Start the Next.js development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3030/document-management
```

The development environment is configured in `.env.development`:

```env
NEXT_PUBLIC_HMR_PORT=3030
WDS_SOCKET_PORT=3030
NEXT_PUBLIC_ODOO_URL=http://localhost:8069
NEXT_PUBLIC_USE_TEST_DATA=true
```

`NEXT_PUBLIC_USE_TEST_DATA=true` uses realistic local fixtures during
development. It only applies when `NODE_ENV=development`; production builds
use Odoo. Restart Next.js after changing environment variables.

To test the frontend against real Odoo data, use:

```env
NEXT_PUBLIC_USE_TEST_DATA=false
NEXT_PUBLIC_ODOO_URL=http://localhost:8069
```

## Deploy Into Odoo

Run this from `next-app`:

```bash
cd cleon_document_management/next-app
npm run deploy
```

`npm run deploy`:

1. Runs `next build --webpack` and creates the static export in `next-app/out`.
2. Runs `npm run sync` and copies the export into:

```text
cleon_document_management/static/src/nextapp
```

Never manually edit `static/src/nextapp`; it is generated output and is
replaced by the next sync.

After deployment, restart Odoo or update the module so Odoo serves the new
assets. A typical development command from the Odoo project directory is:

```bash
../white_clone/.venv/bin/python odoo-bin \
  -c odoo.conf \
  -d white_cleon_17 \
  -u cleon_document_management \
  --dev=all
```

Then open:

```text
http://localhost:8069/document-management
```

Use a hard refresh if the browser still shows older assets.

## Useful Commands

```bash
npm run dev       # Next.js development server on port 3030
npm run build     # Production static build only
npm run sync      # Copy an existing out/ export into Odoo static files
npm run deploy    # Build with Webpack and sync into Odoo
npx tsc --noEmit  # TypeScript validation
```

Run `npm run deploy`, rather than only `npm run build`, whenever the goal is
to update the Odoo-served frontend.

## Routing

The Next.js base path is configured as `/document-management` in
`next.config.ts`. Application routes are written without that prefix:

```text
/pages/employee
/pages/organization
/pages/compliance
/pages/document-intelligence
```

Next.js adds the base path to browser links automatically. Backend API calls
use `NEXT_PUBLIC_ODOO_URL` in development and the current Odoo origin in the
deployed static app.

## Troubleshooting

### “Next.js build not found”

Odoo cannot find the generated export. Run:

```bash
npm run deploy
```

Confirm that `cleon_document_management/static/src/nextapp` contains
`index.html` and the `_next` assets.

### It works on port 3030 but not through Odoo

The development server and Odoo serve different builds. Run `npm run deploy`,
restart/update Odoo, and open port `8069`.

### API calls return HTML instead of JSON or a download

In development, backend requests must target `NEXT_PUBLIC_ODOO_URL`, normally
`http://localhost:8069`. If it is missing, the Next.js dev server can return
its HTML fallback for an Odoo route.

### `useSearchParams()` build error

Routes using `useSearchParams()` must render their client component inside a
React `Suspense` boundary in `page.tsx`, otherwise static export fails during
prerendering.

### Mock data is still visible

Set `NEXT_PUBLIC_USE_TEST_DATA=false` or unset it, restart Next.js, rebuild,
run `npm run sync`, and restart/update Odoo.

### New code is not visible

Check that `npm run deploy` completed, `static/src/nextapp` was updated, Odoo
was restarted or the module updated, and the browser was hard-refreshed.

## Backend Changes

Frontend API routes are implemented in:

```text
cleon_document_management/controllers
cleon_document_management/models
```

When adding a backend controller or model field, restart Odoo and update the
module before testing the production/static frontend path.
