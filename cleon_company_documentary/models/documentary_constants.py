# SRS Section 7.1 — nine distinct documentary statuses (never infer one from another).

DOCUMENTARY_STATUSES = [
    ("processing", "Processing"),
    ("processing_failed", "Processing Failed"),
    ("draft", "Draft"),
    ("pending_review", "Pending Review"),
    ("returned", "Returned"),
    ("approved", "Approved"),
    ("published", "Published"),
    ("archived", "Archived"),
    ("deleted", "Deleted"),
]

DOCUMENTARY_CATEGORIES = [
    ("general", "General"),
    ("onboarding", "Onboarding"),
    ("training", "Training"),
    ("marketing", "Marketing"),
    ("hr_updates", "HR Updates"),
    ("company_events", "Company Events"),
    ("product_launches", "Product Launches"),
]

FOLDER_COLOR_PALETTE = [
    "#E91E8C",
    "#1E3A5F",
    "#0EA5E9",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#EF4444",
    "#64748B",
]
