# Cleon Guide Execution Plan

## Prefix: `cg-` · Hero icon: `fa-question-circle-o`

## Files to Create (5 + 1 edit)

### 1. Interactive HTML
**Path:** `interactive/all-modules/platform-intelligence/cleon-guide/cleon-guide.html`
- Full CleonHR navbar (`#chr-nav`) + footer (`chr-footer`)
- `../../../` paths for `main.css`, `navbar.css`, `navbar.js`
- CTAs → `../signup/signup.html`
- Sections: Hero → Who It's For → Key Features → How It Helps → Additional Benefits → Use Cases → CTA
- Scripts: `../../../js/navbar.js` + `js/cleon-guide.js`

### 2. Interactive CSS
**Path:** `interactive/.../cleon-guide/css/cleon-guide.css`
- Scoped `cg-` prefix, no global resets
- CSS vars: `--cg-primary: #E01E5A`, `--cg-primary-gradient`, `--cg-light-bg: #F8FAFC`
- All section styles: `.cg-container`, `.cg-hero`, `.cg-card`, `.cg-feature-item`, `.cg-benefit-card`, `.cg-list-item`, `.cg-usecase-card`, `.cg-cta`
- Responsive: 991px (2-col), 767px (1-col)

### 3. Interactive JS
**Path:** `interactive/.../cleon-guide/js/cleon-guide.js`
```js
document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.cg-nav-link, .cg-footer-links a, .cg-auth-buttons a');
    elements.forEach(element => {
        if (element.getAttribute('href') === '#') {
            element.addEventListener('click', (e) => e.preventDefault());
        }
    });
});
```

### 4. Extracted HTML
**Path:** `extracted-components/.../cleon-guide/cleon-guide.html`
- Self-contained DOCTYPE, no navbar/footer
- All text wrapped in `<span>`: `<h1 class="cg-hero-title"><span>Cleon Guide</span></h1>`
- Links: `href="#"`

### 5. Extracted CSS
**Path:** `extracted-components/.../cleon-guide/css/cleon-guide.css`
- `*` global reset, `body` styles
- All `cg-` scoped classes + `span !important` overrides for every text class
- Responsive span overrides in media queries

### 6. Navbar.js Edit
**File:** `interactive/js/navbar.js`
**Change:** Add `url` to `cleon-guide` module line:
```js
{ id: 'cleon-guide', icon: 'fa-question-circle', iconClass: 'chr-svc-card__icon--teal', title: 'Cleon Guide', desc: 'Interactive HR guidance and support', url: 'all-modules/platform-intelligence/cleon-guide/cleon-guide.html' },
```

## Sections Content

| Section | Source |
|---------|--------|
| Hero | `fa-question-circle-o` · *Cleon Guide* · *Contextual, step-by-step HR guidance built right into the platform* · Desc from user's HTML |
| Who It's For | New Employees & Users (`fa-users`) · HR Administrators (`fa-user-circle-o`) · System Administrators (`fa-sliders`) |
| Key Features | Interactive Step-by-Step Tours (`fa-compass`) · Contextual Tooltips & Hints (`fa-info-circle`) · HR Process Library (`fa-book`) · Custom Guide Builder (`fa-wrench`) |
| How It Helps | Reduces Onboarding Time · Cuts Support Tickets · Improves Process Compliance · Scales HR Knowledge |
| Additional Benefits | 6 items from user's HTML |
| Use Cases | Enterprise Employee Onboarding (50% faster ramp-up, 60% fewer tickets) · HR Policy Compliance Rollout (95% completion in 2 weeks) |
| CTA | *Start now for free and experience the power of Cleon Guide* |
