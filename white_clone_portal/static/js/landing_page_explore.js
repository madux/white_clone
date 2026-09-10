/* ================================================================
   Module Explore Page – render dynamic module detail
   ================================================================ */

(function () {
  const root = document.getElementById('explore-root');
  const labelEl = document.querySelector('.services-btn-label');
  const servicesBtn = document.getElementById('services-btn');
  const catalog = window.CLEON_MODULE_EXPLORE || {};
  const icons = window.CLEON_EXPLORE_ICONS || {};

  function slugFromPath() {
    const parts = window.location.pathname.replace(/\/+$/, '').split('/');
    const idx = parts.indexOf('explore');
    if (idx === -1 || !parts[idx + 1]) return '';
    return decodeURIComponent(parts[idx + 1]);
  }

  function iconSvg(name) {
    return icons[name] || icons.users || '';
  }

  function setNavLabel(text, active) {
    if (labelEl) labelEl.textContent = text || 'Services';
    if (servicesBtn) {
      servicesBtn.classList.toggle('services-btn--active', !!active);
    }
  }

  function readStoredModule() {
    try {
      return JSON.parse(sessionStorage.getItem('cleon_active_module') || 'null');
    } catch (e) {
      return null;
    }
  }

  function resolveModule(slug) {
    if (catalog[slug]) return catalog[slug];

    // Common aliases (e.g. toSlug("Employee Self-Service (ESS)") → …-ess)
    const aliases = {
      'employee-self-service-ess': 'employee-self-service',
      ess: 'employee-self-service',
    };
    if (aliases[slug] && catalog[aliases[slug]]) return catalog[aliases[slug]];

    for (const key of Object.keys(catalog)) {
      const mod = catalog[key];
      if (mod && mod.slug === slug) return mod;
    }

    const stored = readStoredModule();
    if (stored && stored.title) {
      const titleNorm = String(stored.title).trim().toLowerCase();
      for (const key of Object.keys(catalog)) {
        const mod = catalog[key];
        if (!mod) continue;
        if (String(mod.title || '').trim().toLowerCase() === titleNorm) return mod;
        if (String(mod.navLabel || '').trim().toLowerCase() === titleNorm) return mod;
      }
    }

    return null;
  }

  function fallbackModule(slug) {
    const stored = readStoredModule();
    const title =
      (stored && stored.slug === slug && stored.title) ||
      (stored && stored.title) ||
      slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      slug,
      title,
      navLabel: title,
      tagline: 'Explore this CleonHR module',
      description:
        'Detailed content for this module is coming soon. In the meantime, start a free trial to experience CleonHR.',
      heroIcon: icons.building || '',
      audience: [],
      features: [],
      helps: [],
      benefits: [],
      useCases: [],
      ctaTitle: 'Ready to get started?',
      ctaDesc: 'Start now for free and explore ' + title,
    };
  }

  function renderClassic(mod) {
    const audience = (mod.audience || [])
      .map(
        (a) => `
      <div class="explore-audience-card">
        <div class="explore-icon-box">${iconSvg(a.icon)}</div>
        <h3>${a.title}</h3>
        <p>${a.desc}</p>
      </div>`
      )
      .join('');

    const features = (mod.features || [])
      .map(
        (f) => `
      <div class="explore-feature-item">
        <div class="explore-icon-box">${iconSvg(f.icon)}</div>
        <div class="explore-feature-body">
          <h3>${f.title}</h3>
          <p>${f.desc}</p>
        </div>
      </div>`
      )
      .join('');

    const helps = (mod.helps || [])
      .map(
        (h) => `
      <div class="explore-help-card">
        <div class="explore-help-card-row">
          <div class="explore-icon-box explore-icon-box--xs">${iconSvg('check')}</div>
          <div>
            <h3>${h.title}</h3>
            <p>${h.desc}</p>
          </div>
        </div>
      </div>`
      )
      .join('');

    const benefits = (mod.benefits || [])
      .map(
        (b) => `
      <div class="explore-benefit-item">${iconSvg('check')}<span>${b}</span></div>`
      )
      .join('');

    const useCases = (mod.useCases || [])
      .map(
        (u) => `
      <div class="explore-usecase-card">
        <div class="explore-icon-box explore-icon-box--sm">${iconSvg('sparkles')}</div>
        <h3>${u.title}</h3>
        <p>${u.desc}</p>
      </div>`
      )
      .join('');

    root.innerHTML = `
      <section class="explore-hero">
        <div class="explore-hero-inner">
          <div class="explore-hero-icon">${mod.heroIcon || icons.building || ''}</div>
          <h1 class="explore-hero-title">${mod.title}</h1>
          <p class="explore-hero-tagline">${mod.tagline || ''}</p>
          <p class="explore-hero-desc">${mod.description || ''}</p>
          <a href="/landing" class="explore-hero-cta">
            Start now, It's free
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </a>
        </div>
      </section>

      ${
        audience
          ? `<section class="explore-section explore-section--muted">
              <div class="explore-section-inner">
                <h2 class="explore-section-title">Who It's For</h2>
                <div class="explore-audience-grid">${audience}</div>
              </div>
            </section>`
          : ''
      }

      ${
        features
          ? `<section class="explore-section explore-section--white">
              <div class="explore-section-inner">
                <h2 class="explore-section-title">Key Features</h2>
                <div class="explore-features-grid">${features}</div>
              </div>
            </section>`
          : ''
      }

      ${
        helps
          ? `<section class="explore-section explore-section--muted">
              <div class="explore-section-inner">
                <h2 class="explore-section-title">How It Helps Your Business</h2>
                <div class="explore-help-grid">${helps}</div>
              </div>
            </section>`
          : ''
      }

      ${
        benefits
          ? `<section class="explore-section explore-section--white">
              <div class="explore-section-inner explore-section-inner--narrow">
                <h2 class="explore-section-title">Additional Benefits</h2>
                <div class="explore-benefits-grid">${benefits}</div>
              </div>
            </section>`
          : ''
      }

      ${
        useCases
          ? `<section class="explore-section explore-section--muted">
              <div class="explore-section-inner">
                <h2 class="explore-section-title">Real-World Use Cases</h2>
                <div class="explore-usecase-grid">${useCases}</div>
              </div>
            </section>`
          : ''
      }

      <section class="explore-cta">
        <div class="explore-cta-inner">
          <h2 class="explore-cta-title">${mod.ctaTitle || 'Ready to get started?'}</h2>
          <p class="explore-cta-desc">${mod.ctaDesc || ''}</p>
          <a href="/landing" class="explore-cta-btn">Start Your Free Trial</a>
        </div>
      </section>`;
  }

  function renderExperience(mod) {
    const chevron = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
    const starIcon = iconSvg('star');

    const chips = (mod.heroChips || [])
      .map(
        (c) => `
      <div class="ee-chip">${iconSvg('circle-check')}<span>${c}</span></div>`
      )
      .join('');

    const audiences = (mod.audiences || [])
      .map((a) => {
        const tone = a.tone || 'pink';
        return `
        <div class="ee-audience-card">
          <div class="ee-audience-icon ee-audience-icon--${tone}">${iconSvg(a.icon)}</div>
          <h3>${a.title}</h3>
          <p>${a.desc}</p>
          <div class="ee-learn ee-learn--${tone}">Learn more ${chevron}</div>
        </div>`;
      })
      .join('');

    const capabilities = (mod.capabilities || [])
      .map(
        (c) => `
      <div class="ee-cap-card">
        <div class="ee-cap-icon">${iconSvg(c.icon)}</div>
        <h3>${c.title}</h3>
        <p>${c.desc}</p>
      </div>`
      )
      .join('');

    const impacts = (mod.impacts || [])
      .map(
        (i) => `
      <div class="ee-impact-card">
        <div class="ee-impact-icon ee-impact-icon--${i.tone || 'pink'}">${iconSvg(i.icon)}</div>
        <h3>${i.title}</h3>
        <p>${i.desc}</p>
      </div>`
      )
      .join('');

    const why = (mod.why || [])
      .map((w) => {
        const featured = w.featured ? ' ee-why-card--featured' : '';
        return `
        <div class="ee-why-card${featured}">
          <div class="ee-why-icon">${iconSvg(w.icon)}</div>
          <h3>${w.title}</h3>
          <p>${w.desc}</p>
        </div>`;
      })
      .join('');

    root.innerHTML = `
      <section class="ee-hero">
        <div class="ee-hero-orb ee-hero-orb--tr"></div>
        <div class="ee-hero-orb ee-hero-orb--bl"></div>
        <div class="ee-hero-inner">
          <div class="ee-hero-grid">
            <div>
              <div class="ee-badge">${iconSvg('sparkles')}${mod.badge || ''}</div>
              <h1 class="ee-hero-title">${mod.heroTitleLead || 'Employee'}<br><span class="ee-hero-title-accent">${mod.heroTitleAccent || 'Experience'}</span></h1>
              <p class="ee-hero-lead">${mod.heroLead || ''}</p>
              <p class="ee-hero-desc">${mod.heroDesc || ''}</p>
              <a href="/landing" class="ee-hero-cta">Start Free Trial</a>
              <div class="ee-chips">${chips}</div>
            </div>
            <div class="ee-mock-wrap">
              <div class="ee-mock">
                <div class="ee-mock-bar">
                  <div class="ee-mock-dot ee-mock-dot--r"></div>
                  <div class="ee-mock-dot ee-mock-dot--y"></div>
                  <div class="ee-mock-dot ee-mock-dot--g"></div>
                  <div class="ee-mock-url">app.cleonhr.com/employee-experience</div>
                </div>
                <div class="ee-mock-body">
                  <div class="ee-mock-welcome">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div class="ee-mock-avatar">A</div>
                      <div class="ee-mock-welcome-text">
                        <p>Welcome back, Adaeze 👋</p>
                        <p>Senior Designer · Lagos Office</p>
                      </div>
                    </div>
                    <div class="ee-mock-pts">${starIcon} 420 pts</div>
                  </div>
                  <div class="ee-mock-stats">
                    <div class="ee-mock-stat" style="background:rgb(255,240,247);">
                      <p class="ee-mock-stat-value" style="color:rgb(233,30,140);">12</p>
                      <p class="ee-mock-stat-label">Recognition</p>
                      <p class="ee-mock-stat-sub">this month</p>
                    </div>
                    <div class="ee-mock-stat" style="background:rgb(245,243,255);">
                      <p class="ee-mock-stat-value" style="color:rgb(124,58,237);">#3</p>
                      <p class="ee-mock-stat-label">AME Rank</p>
                      <p class="ee-mock-stat-sub">top performer</p>
                    </div>
                    <div class="ee-mock-stat" style="background:rgb(240,253,244);">
                      <p class="ee-mock-stat-value" style="color:rgb(5,150,105);">98%</p>
                      <p class="ee-mock-stat-label">Attendance</p>
                      <p class="ee-mock-stat-sub">on-time rate</p>
                    </div>
                  </div>
                  <div class="ee-mock-feed">
                    <div class="ee-mock-feed-head"><span style="font-weight:600;color:#374151;">Recognition Feed</span><span>View all</span></div>
                    <div class="ee-mock-feed-row">
                      <div class="ee-mock-feed-avatar" style="background:rgb(233,30,140);">T</div>
                      <div style="flex:1;min-width:0;">
                        <p style="margin:0;font-size:12px;font-weight:600;color:#1f2937;">Tunde O.</p>
                        <p style="margin:0;font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Amazing work on the Q2 presentation!</p>
                      </div>
                      <span style="font-size:12px;color:#9ca3af;flex-shrink:0;">2m ago</span>
                    </div>
                    <div class="ee-mock-feed-row">
                      <div class="ee-mock-feed-avatar" style="background:rgb(124,58,237);">N</div>
                      <div style="flex:1;min-width:0;">
                        <p style="margin:0;font-size:12px;font-weight:600;color:#1f2937;">Ngozi A.</p>
                        <p style="margin:0;font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Thank you for the quick turnaround!</p>
                      </div>
                      <span style="font-size:12px;color:#9ca3af;flex-shrink:0;">1h ago</span>
                    </div>
                  </div>
                  <div class="ee-mock-score">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                      <p style="margin:0;font-size:12px;font-weight:600;color:#374151;">Team Engagement Score</p>
                      <span style="font-size:12px;font-weight:700;color:#e91e8c;">87%</span>
                    </div>
                    <div class="ee-mock-score-bar"><div class="ee-mock-score-fill"></div></div>
                    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">↑ 4% from last month</p>
                  </div>
                </div>
              </div>
              <div class="ee-mock-float">
                <div class="ee-mock-float-icon">${iconSvg('trending-up')}</div>
                <div>
                  <p style="margin:0;font-size:12px;font-weight:700;color:#111827;">+28% Engagement</p>
                  <p style="margin:0;font-size:12px;color:#6b7280;">vs. previous quarter</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="ee-section ee-section--muted">
        <div class="ee-section-head">
          <p class="ee-eyebrow">Designed for everyone</p>
          <h2 class="ee-section-title">Built for Employees, Managers, and HR Teams</h2>
        </div>
        <div class="ee-grid-3">${audiences}</div>
      </section>

      <section class="ee-section ee-section--white">
        <div class="ee-section-head">
          <p class="ee-eyebrow">Core capabilities</p>
          <h2 class="ee-section-title">Everything Employees Need in One Connected Experience</h2>
          <p class="ee-section-sub">A comprehensive suite of engagement tools that bring your workforce together.</p>
        </div>
        <div class="ee-grid-3">${capabilities}</div>
      </section>

      <section class="ee-section ee-section--soft">
        <div class="ee-section-head">
          <p class="ee-eyebrow">Business impact</p>
          <h2 class="ee-section-title">Improve Workforce Engagement and Workplace Culture</h2>
        </div>
        <div class="ee-impact-grid">${impacts}</div>
      </section>

      <section class="ee-section ee-section--muted">
        <div class="ee-section-head">
          <p class="ee-eyebrow">Why CleonHR</p>
          <h2 class="ee-section-title">Why Organizations Choose CleonHR Employee Experience</h2>
        </div>
        <div class="ee-why-grid">${why}</div>
      </section>

      <section class="ee-cta">
        <div class="ee-cta-float ee-cta-float--tl"><span class="ee-dot"></span>87% Engagement Score</div>
        <div class="ee-cta-float ee-cta-float--br">${iconSvg('trophy')} Top Performer: Adaeze O.</div>
        <div class="ee-cta-float ee-cta-float--mr">${iconSvg('award')} 24 Recognitions Today</div>
        <div class="ee-cta-inner">
          <h2 class="ee-cta-title">${mod.ctaTitle || ''}</h2>
          <p class="ee-cta-desc">${mod.ctaDesc || ''}</p>
          <a href="/landing" class="ee-cta-btn">Start Free Trial</a>
          <p class="ee-cta-note">${mod.ctaNote || ''}</p>
        </div>
      </section>`;
  }

  function render(mod) {
    document.title = mod.title + ' – CleonHR';
    setNavLabel(mod.navLabel || mod.title, !!mod.navActive || mod.layout === 'experience');
    if (mod.layout === 'experience') renderExperience(mod);
    else renderClassic(mod);
  }

  if (!root) return;

  const slug = slugFromPath();
  if (!slug) {
    root.innerHTML = `
      <div class="explore-missing">
        <h1>Module not found</h1>
        <p>Choose a module from the Services menu to explore.</p>
        <a href="/landing" class="explore-cta-btn">Back to home</a>
      </div>`;
    setNavLabel('Services', false);
    return;
  }

  const mod = resolveModule(slug) || fallbackModule(slug);
  render(mod);
})();
