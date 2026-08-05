# TODO — Move favicon & browser-title branding to `white_clone_theme`

**Status:** Open
**Owner:** CleonHR dev
**Scope:** Move all global "favicon + title" branding out of `hr_staff_directory` and
into the dedicated branding module `white_clone_theme`.

---

## 1. Why

`hr_staff_directory` is the Staff Directory dashboard module. Global chrome
(browser tab icon + page title) is a **branding** concern and does not belong
here. `white_clone_theme` is the designated theme/branding module
(`category: 'Branding'`, `application: True`) and should own it.

Both modules are currently **installed** in `white_clone_db_v1`, and
`white_clone_theme` depends only on `web` — which is all that is needed for
both pieces of this feature.

## 2. What moves (current location — all inside `hr_staff_directory`)

| Piece | Current file | Notes |
| --- | --- | --- |
| Favicon template | `hr_staff_directory/views/assets.xml` → `<template id="assets_backend_favicon">` | Replaces `web.layout`'s shortcut-icon `<link>` with `/hr_staff_directory/static/src/img/favicon.png` |
| Layout title template | `hr_staff_directory/views/assets.xml` → `<template id="assets_backend_layout_title">` | Replaces `<title t-esc="title or 'Odoo'"/>` fallback with `'CleonHR'` |
| Title JS patch | `hr_staff_directory/static/src/js/cleonhr_title.js` | Patches `WebClient.setup()` → `title.setParts({ zopenerp: "CleonHR" })`; turns `Odoo - <Action>` into `CleonHR - <Action>` after load |
| Favicon image | `hr_staff_directory/static/src/img/favicon.png` | The PNG itself |
| Manifest wiring | `hr_staff_directory/__manifest__.py` | `cleonhr_title.js` in `assets['web.assets_backend']`; `views/assets.xml` in `data` |

> **Why the title is handled in two places:** the `<title>` tag in
> `web.layout` is the *server-rendered* initial title (visible while the page
> loads); `cleonhr_title.js` sets the *runtime* title once the web client
> boots (because Odoo appends the current action name in JS). Both must move.

## 3. How `white_clone_theme` is structured (target)

```
white_clone_theme/
├── __init__.py                      # empty (no python models)
├── __manifest__.py                  # name 'White Clone Theme (Pink)', category 'Branding',
│                                    #   depends: ['web'], application: True, installable: True
├── static/
│   ├── description/                 # module icon + screenshots (leave alone)
│   └── src/
│       ├── scss/backend_theme.scss              # → web.assets_backend
│       ├── scss/primary_variable_custom.scss    # → web._assets_primary_variables
│       └── status_bar.xml           # QWeb asset template, currently commented out in manifest (leave alone)
└── views/
    └── webclient_template_extend.xml # DEAD STUB — commented out in `data`, references the
                                       #   non-existent module `legion_enterprise_theme`. Remove it.
```

Manifest conventions observed:
- Asset paths use a **leading slash**: `'/white_clone_theme/static/src/scss/backend_theme.scss'`
- Bundle keys used: `web.assets_backend`, `web._assets_primary_variables`

## 4. Steps

### 4.1 Copy the branding assets into `white_clone_theme`

- `mkdir -p white_clone_theme/static/src/img white_clone_theme/static/src/js`
- Copy `hr_staff_directory/static/src/img/favicon.png` → `white_clone_theme/static/src/img/favicon.png`
- Move/copy `hr_staff_directory/static/src/js/cleonhr_title.js` → `white_clone_theme/static/src/js/cleonhr_title.js`
  - Content needs **no change** — it imports only from `@web/core/utils/patch` and
    `@web/webclient/webclient`, both shipped by the `web` addon the theme already depends on.
  - (Optional) rename the file to something neutral like `webclient_title.js` — cosmetic only.

### 4.2 Create `white_clone_theme/views/branding.xml`

Two templates, copied from `hr_staff_directory/views/assets.xml`, with the
icon `href` repointed at the theme and template ids namespaced for the theme.

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <template id="branding_favicon"
              inherit_id="web.layout"
              name="CleonHR Favicon">
        <xpath expr="//link[@rel='shortcut icon']" position="replace">
            <link type="image/x-icon" rel="shortcut icon"
                  href="/white_clone_theme/static/src/img/favicon.png"/>
        </xpath>
    </template>

    <template id="branding_layout_title"
              inherit_id="web.layout"
              name="CleonHR Layout Title">
        <xpath expr="//title" position="replace">
            <title t-esc="title or 'CleonHR'"/>
        </xpath>
    </template>

</odoo>
```

> The `<title t-esc="title or 'CleonHR'"/>` fallback is intentional: pages that
> pass their own `title` (e.g. website pages) are unaffected; only the
> `'Odoo'` fallback is replaced.

### 4.3 Update `white_clone_theme/__manifest__.py`

- `data`: add `'views/branding.xml'`
- `assets['web.assets_backend']`: add `'/white_clone_theme/static/src/js/cleonhr_title.js'`
  (match the existing leading-slash style)
- Remove the stale `views/webclient_template_extend.xml` entry (it is commented
  out anyway) and **delete the file** — it references the non-existent module
  `legion_enterprise_theme`.

### 4.4 Remove the feature from `hr_staff_directory`

- `hr_staff_directory/views/assets.xml`: delete the `assets_backend_favicon` and
  `assets_backend_layout_title` templates. **Keep** `assets_backend_dm_sans`
  (DM Sans font) — it stays with the Staff Directory styling.
- `hr_staff_directory/__manifest__.py`:
  - remove `'hr_staff_directory/static/src/js/cleonhr_title.js'` from
    `assets['web.assets_backend']`
  - keep `'views/assets.xml'` in `data` (still contains the DM Sans template)
- Delete `hr_staff_directory/static/src/js/cleonhr_title.js`
- Delete `hr_staff_directory/static/src/img/favicon.png`

### 4.5 Apply to the DB

Both modules are already installed, so:

```
./venv/bin/python ./odoo-bin -c ./white_clone.conf -d white_clone_db_v1 -u white_clone_theme,hr_staff_directory
```

Then **restart the server**. This step is mandatory: asset file lists are
process-cached (`ir.asset._get_asset_paths`, `cache='assets'` in
`odoo/addons/base/models/ir_asset.py`), and a fresh process is required to pick
up the new JS asset in `web.assets_backend`.

### 4.6 Verify

1. Hard-refresh the browser (`Ctrl+Shift+R`).
2. Browser tab icon = `favicon.png`.
3. Title during page load = **CleonHR**; after load = **CleonHR - Staff Directory**.
4. Staff Directory dashboard still renders (OWL action, CSS, DM Sans font).
5. `white_clone_theme` pink theme still applies (back-end SCSS unaffected).

## 5. Notes / considerations

- **Install-state coupling:** the branding only exists while `white_clone_theme`
  is installed. `hr_staff_directory` no longer needs `web`-dependent branding,
  but keep its existing `'web'` dependency (the dashboard is an OWL web-client
  action and uses `web` assets regardless).
- **Load order:** `white_clone_theme` depends on `web`, so its templates and JS
  apply globally no matter what else is installed.
- **Optional follow-up:** `assets_backend_dm_sans` (the global DM Sans font
  `<link>` injected into `web.layout`) is also global branding that currently
  lives in `hr_staff_directory/views/assets.xml`. Out of scope here — consider
  moving it to `white_clone_theme` in a later pass.
- **Optional follow-up:** after the move, review `white_clone_theme`'s dead
  `webclient_template_extend.xml` / `status_bar.xml` assets for cleanup
  (the latter is currently commented out in the manifest).
