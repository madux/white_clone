/* ================================================================
   CleonHR Pricing Page – Interactive JS
   ================================================================ */

(function () {
  const YEARLY_DISCOUNT = 0.1;

  const CATEGORIES = {
    'hr-admin': {
      title: 'HR Administration Pricing',
      desc: "Select the plan that best fits your organization's needs",
    },
    recruitment: {
      title: 'Recruitment Pricing',
      desc: 'Hire faster with plans built for growing talent teams',
    },
    payroll: {
      title: 'Payroll & Remittance Pricing',
      desc: 'Accurate payroll and remittance for every workforce size',
    },
    finance: {
      title: 'Finance Pricing',
      desc: 'Financial controls and reporting tailored to your scale',
    },
    more: {
      title: 'Additional Modules Pricing',
      desc: 'Explore pricing for more CleonHR modules',
    },
  };

  const PLANS = [
    {
      id: 'standard',
      name: 'Standard',
      tagline: 'Beginner-friendly',
      monthly: 10780,
      popular: false,
      cta: 'outline',
      featuresLabel: 'All the essentials:',
      features: [
        'Access to selected modules only',
        'Basic HR workflows',
        'Limited integrations',
        'Up to 50 employees',
        'Email support',
      ],
      note: null,
    },
    {
      id: 'professional',
      name: 'Professional',
      tagline: 'Automation and AI',
      monthly: 17710,
      popular: true,
      cta: 'solid',
      featuresLabel: 'Everything in Standard +',
      features: [
        'All apps inside selected modules',
        'Advanced workflows',
        'Team collaboration tools',
        'Payroll & compliance tools',
        'API integrations',
        'Multi-department support',
      ],
      note: 'Includes all apps and submodules within selected modules.',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      tagline: 'Deep customizability',
      monthly: 30800,
      popular: false,
      cta: 'outline',
      featuresLabel: 'Everything in Professional +',
      features: [
        'Full platform access',
        'Advanced security controls',
        'Dedicated onboarding',
        'Multi-company management',
        'Audit logs',
        'Custom workflows',
        'Priority support',
      ],
      note: null,
    },
  ];

  const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

  const titleEl = document.getElementById('pricing-section-title');
  const descEl = document.getElementById('pricing-section-desc');
  const gridEl = document.getElementById('pricing-grid');
  const tabs = [...document.querySelectorAll('.pricing-tab')];
  const billingBtns = [...document.querySelectorAll('[data-billing]')];

  let billing = 'monthly';
  let category = 'hr-admin';

  function formatNaira(amount) {
    return '₦' + Math.round(amount).toLocaleString('en-NG');
  }

  function priceFor(plan) {
    if (billing === 'yearly') return plan.monthly * (1 - YEARLY_DISCOUNT);
    return plan.monthly;
  }

  function renderPlans() {
    if (!gridEl) return;
    gridEl.innerHTML = PLANS.map((plan) => {
      const features = plan.features
        .map((f) => `<li>${checkIcon}<span>${f}</span></li>`)
        .join('');
      const note = plan.note
        ? `<div class="pricing-card-note"><p>${plan.note}</p></div>`
        : '';
      const badge = plan.popular
        ? `<div class="pricing-popular-badge">Most Popular</div>`
        : '';
      const ctaClass = plan.cta === 'solid' ? 'pricing-cta--solid' : 'pricing-cta--outline';
      const cardClass = plan.popular ? 'pricing-card pricing-card--popular' : 'pricing-card';

      return `
        <div class="${cardClass}">
          ${badge}
          <div class="pricing-card-body">
            <h3 class="pricing-card-name">${plan.name}</h3>
            <p class="pricing-card-tagline">${plan.tagline}</p>
            <div class="pricing-card-price">
              <div class="pricing-card-amount" data-plan-price="${plan.id}">${formatNaira(priceFor(plan))}</div>
              <p class="pricing-card-period">/user/month</p>
            </div>
            <button type="button" class="pricing-cta ${ctaClass}">START FREE TRIAL</button>
            <div>
              <p class="pricing-features-label">${plan.featuresLabel}</p>
              <ul class="pricing-features">${features}</ul>
            </div>
            ${note}
          </div>
        </div>`;
    }).join('');
  }

  function setCategory(key) {
    category = key;
    const meta = CATEGORIES[key] || CATEGORIES['hr-admin'];
    if (titleEl) titleEl.textContent = meta.title;
    if (descEl) descEl.textContent = meta.desc;
    tabs.forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.category === key);
    });
  }

  function setBilling(mode) {
    billing = mode;
    billingBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.billing === mode);
    });
    document.querySelectorAll('[data-plan-price]').forEach((el) => {
      const plan = PLANS.find((p) => p.id === el.dataset.planPrice);
      if (plan) el.textContent = formatNaira(priceFor(plan));
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.category;
      if (!key) return;
      setCategory(key);
    });
  });

  billingBtns.forEach((btn) => {
    btn.addEventListener('click', () => setBilling(btn.dataset.billing));
  });

  document.querySelectorAll('.pricing-faq-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.pricing-faq-item');
      if (!item) return;
      const open = item.classList.contains('is-open');
      document.querySelectorAll('.pricing-faq-item.is-open').forEach((el) => {
        el.classList.remove('is-open');
      });
      if (!open) item.classList.add('is-open');
    });
  });

  renderPlans();
  setCategory(category);
  setBilling(billing);
})();
