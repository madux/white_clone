# Employee portal extensions

The portal owns navigation and layout. Optional integrations contribute screens
through `employeePortalRegistry` exported by `@white_clone_portal/portal_registry`.

Create a small module depending on `white_clone_portal` and the feature module,
with `auto_install: True`. Register its JS in `web.assets_backend`.
Use `white_clone_portal_leave` or `white_clone_portal_time` as examples.

A provider registers with `add(key, provider, { sequence: 20 })` and supplies:

- `id`, translated `label`, and Font Awesome `icon` for its sidebar section.
- `load({ orm, user })`: returns the context used by visibility and dashboard.
- `pages`: entries with a stable `id`, translated `label`, `icon`, `sequence`,
  OWL `component`, optional `props`/`aliases`, and `visible(context)` predicate.
- Optional `dashboard`: OWL component. The loader returns its props under
  `dashboard`; the shell additionally passes `navigate(pageId)`.
- Optional page `welcome: true`: shows that page's action in the welcome banner.

Keep screen IDs stable for existing action links. Filter entries from server
access data; UI visibility never replaces ACLs, record rules or RPC checks.
Do not import feature modules into the portal shell. Each provider handles its
own module data; provider failure leaves other sections available.

Installation in an existing database requires updating the Apps list and
upgrading `white_clone_portal`; install `white_clone_portal_leave` and
`white_clone_portal_time` where their feature modules are installed. New installs
use Odoo's automatic installation of these integrations.

Navigation contract checks:

    node --test white_clone_portal/tests/portal_registry.test.cjs

These tests exercise real provider registrations and shell navigation with RPC
stubs. They do not replace Odoo browser and database integration checks.
