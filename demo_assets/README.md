# Demo assets — board presentation

Drop your files here, then run the seed script (see below). Nothing in this folder is committed to git except this README and `.gitkeep` files.

## Folder layout

```
demo_assets/
├── social_gallery/           # Photos & short videos for Social Gallery
│   ├── team_events/          # Each subfolder → one album
│   │   ├── photo1.jpg
│   │   └── photo2.png
│   └── office_life/
│       └── ...
├── company_documentary/        # Training / culture videos
│   ├── onboarding/
│   │   └── welcome.mp4
│   └── culture/
│       └── ...
└── documents/                # HR documents (PDF, images, Word)
    ├── Sarah Chen/           # Subfolder name → employee (name or barcode)
    │   ├── contract.pdf
    │   └── id_card.jpg
    ├── EMP-2020-0002/        # Or match by employee barcode
    │   └── passport.pdf
    └── Company Policies/     # Organizational folder (no employee)
        └── handbook.pdf
```

### Supported file types

| Module | Extensions |
|--------|------------|
| Social Gallery | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.mp4`, `.webm`, `.mov` |
| Company Documentary | `.mp4`, `.webm`, `.mov` |
| Document Management | `.pdf`, `.jpg`, `.jpeg`, `.png`, `.doc`, `.docx` |

## Before you seed

1. **R2** — `.env` has working `SOCIAL_GALLERY_R2_*` and `COMPANY_DOCUMENTARY_R2_*` keys; Odoo was restarted after setting them.
2. **Employees** — run `hr_staff_directory/dev_seed.sql` if you want a full org chart (optional but recommended for documents/compliance).
3. **Copy your files** into the folders above.

## Run the seed script

From your Odoo install directory (where `odoo-bin` lives):

```bash
./odoo-bin shell -c odoo.conf -d white_cleon_17 < /path/to/white_clone/scripts/seed_demo_assets.py
```

Example:

```bash
cd ~/Documents/Projects/odoo-17.0
./odoo-bin shell -c odoo.conf -d white_cleon_17 < ~/Documents/Projects/white_clone/scripts/seed_demo_assets.py
```

The script will:

- Create albums / documentary folders from subfolder names
- Upload images and videos to R2
- Create employee or organizational document folders and attach files
- Add one sample compliance policy (if none exist)
- Mark gallery uploads as **approved** and skip AI screening for demo speed

Re-running is safe: files already uploaded (same checksum) are skipped.

## Manual UI fallback

If you prefer uploading by hand:

### Social Gallery
1. Open **Social Gallery** → create albums (Team Events, Office Life).
2. **Upload** → select album → drop images → approve from **Pending Review** if needed.

### Company Documentary
1. Open **Company Documentary** → **Folders** → create folders.
2. Open a folder → **Upload video** → complete upload → approve if required.

### Document Management
1. **Documents** → **Folders** → create employee or org folders.
2. Open folder → **Upload** → pick document type → attach file.

## Demo tips

- Upload **10–20 gallery photos** across 2–3 albums for a lively feed.
- Add **3–5 short videos** in Documentary (onboarding + culture).
- Put **2–3 documents per employee** for 5–10 employees to show compliance folders.
- Log in as admin for moderation, analytics, and bulk actions.
