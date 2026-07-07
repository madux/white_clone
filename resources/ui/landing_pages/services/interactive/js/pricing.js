/* ═══════════════════════════════════════════════════════════
   CleonHR Pricing Page — pricing.js
   Tab switching, billing toggle, FAQ accordion
═══════════════════════════════════════════════════════════ */

'use strict';

/* ── PRICING DATA ────────────────────────────────────────── */
const CHR_PRICING = {
  'hr-admin': {
    title: 'HR Administration Pricing',
    sub: 'Select the plan that best fits your organization\'s needs',
    tiers: [
      {
        name: 'Standard', subtitle: 'Beginner-friendly',
        monthly: 10780, yearly: 9702,
        features: ['Access to selected modules only', 'Basic HR workflows', 'Limited integrations', 'Up to 50 employees', 'Email support'],
        extraFeatures: []
      },
      {
        name: 'Professional', subtitle: 'Automation and AI', popular: true,
        monthly: 17710, yearly: 15939,
        features: ['All apps inside selected modules', 'Advanced workflows', 'Team collaboration tools', 'Payroll & compliance tools', 'API integrations', 'Multi-department support'],
        extraFeatures: [],
        note: 'Includes all apps and submodules within selected modules.'
      },
      {
        name: 'Enterprise', subtitle: 'Deep customizability',
        monthly: 30800, yearly: 27720,
        features: ['Full platform access', 'Advanced security controls', 'Dedicated onboarding', 'Multi-company management', 'Audit logs', 'Custom workflows'],
        extraFeatures: ['Priority support']
      }
    ]
  },
  'recruitment': {
    title: 'Recruitment Pricing',
    sub: 'Streamline your hiring pipeline with the right plan',
    tiers: [
      {
        name: 'Starter', subtitle: 'For small teams',
        monthly: 8500, yearly: 7650,
        features: ['Up to 3 active job postings', 'Basic applicant tracking', 'Email notifications', 'Candidate database (500)', 'Standard support'],
        extraFeatures: []
      },
      {
        name: 'Growth', subtitle: 'For scaling teams', popular: true,
        monthly: 15200, yearly: 13680,
        features: ['Unlimited job postings', 'Advanced pipeline management', 'Interview scheduling', 'Candidate database (5,000)', 'Offer management', 'Analytics dashboard'],
        extraFeatures: ['Priority support']
      },
      {
        name: 'Enterprise', subtitle: 'Full recruitment suite',
        monthly: 28000, yearly: 25200,
        features: ['Everything in Growth', 'Custom recruitment workflows', 'API access', 'Unlimited candidates', 'Multi-brand support', 'Advanced analytics'],
        extraFeatures: ['Dedicated account manager', 'Custom integrations']
      }
    ]
  },
  'payroll': {
    title: 'Payroll & Remittance Pricing',
    sub: 'Automated payroll processing with compliance built in',
    tiers: [
      {
        name: 'Basic', subtitle: 'Up to 25 employees',
        monthly: 12000, yearly: 10800,
        features: ['Payroll for up to 25 employees', 'Basic tax calculations', 'Bank integration', 'Payslip generation', 'Email support'],
        extraFeatures: []
      },
      {
        name: 'Professional', subtitle: 'For growing companies', popular: true,
        monthly: 22000, yearly: 19800,
        features: ['Payroll for up to 200 employees', 'Tax automation (PAYE, NHIF, NSSF)', 'Multi-currency support', 'Compliance reporting', 'Bulk payments', 'API access'],
        extraFeatures: ['Priority support']
      },
      {
        name: 'Enterprise', subtitle: 'Unlimited scale',
        monthly: 40000, yearly: 36000,
        features: ['Unlimited employees', 'Multi-country payroll', 'Custom deductions', 'Advanced compliance', 'Audit trail', 'Dedicated support'],
        extraFeatures: ['On-site training', 'Custom integrations']
      }
    ]
  },
  'finance': {
    title: 'Finance Pricing',
    sub: 'Financial management and accounting integration',
    tiers: [
      {
        name: 'Essentials', subtitle: 'For startups',
        monthly: 9500, yearly: 8550,
        features: ['Basic budgeting tools', 'Expense tracking', 'Financial reports', '5 users included', 'Email support'],
        extraFeatures: []
      },
      {
        name: 'Business', subtitle: 'For established teams', popular: true,
        monthly: 19000, yearly: 17100,
        features: ['Advanced budgeting', 'Multi-department expenses', 'Custom reports', 'Unlimited users', 'Accounting integration', 'Approval workflows'],
        extraFeatures: ['Priority support']
      },
      {
        name: 'Enterprise', subtitle: 'Full financial control',
        monthly: 35000, yearly: 31500,
        features: ['Everything in Business', 'Multi-entity support', 'Advanced analytics', 'Custom integrations', 'Dedicated manager', 'Audit & compliance'],
        extraFeatures: ['On-site training', 'Custom SLA']
      }
    ]
  },
  'more': {
    title: 'Add-on Modules Pricing',
    sub: 'Extend your platform with powerful add-on modules',
    tiers: [
      {
        name: 'Single Add-on', subtitle: 'Per module',
        monthly: 5000, yearly: 4500,
        features: ['Choose any single module', 'Full feature access', 'Standard support', 'API access', 'Regular updates'],
        extraFeatures: []
      },
      {
        name: 'Bundle (3 modules)', subtitle: 'Best value', popular: true,
        monthly: 12000, yearly: 10800,
        features: ['Choose any 3 modules', 'Full feature access', 'Priority support', 'API access', 'Dedicated onboarding', 'Custom workflows'],
        extraFeatures: ['Multi-department support']
      },
      {
        name: 'All Access', subtitle: 'Complete platform',
        monthly: 30800, yearly: 27720,
        features: ['All modules included', 'All features unlocked', 'Dedicated support', 'Custom integrations', 'Advanced analytics', 'Multi-company'],
        extraFeatures: ['On-site training', 'Custom SLA']
      }
    ]
  }
};

/* ── FAQ DATA ────────────────────────────────────────────── */
const CHR_FAQ = [
  { q: 'Is my data safe?', a: 'Absolutely. We use enterprise-grade encryption, SOC 2 compliance, and regular security audits to ensure your data is always protected and private.' },
  { q: 'What types of payment do you accept?', a: 'We accept all major credit/debit cards, bank transfers, and mobile money. Enterprise customers can also pay via invoice with NET 30 terms.' },
  { q: 'Does CleonHR support multiple languages?', a: 'Yes, CleonHR supports English, French, Swahili, and more languages coming soon. The platform is designed for multi-regional deployment.' },
  { q: 'How flexible are your contracts?', a: 'Very flexible. We offer monthly and annual plans. Annual plans come with a 10% discount. You can upgrade, downgrade, or cancel anytime.' },
  { q: 'Can I switch plans?', a: 'Yes, you can switch plans at any time. When upgrading, you\'ll be prorated for the remaining billing period. Downgrades take effect at the next billing cycle.' },
  { q: 'How do you support businesses signing up for CleonHR Administration?', a: 'We provide dedicated onboarding support, documentation, video tutorials, and live chat to help you get started with CleonHR Administration.' },
  { q: 'Do you provide any assistance in getting CleonHR Administration set up and running for our business?', a: 'Yes, Enterprise customers get dedicated onboarding assistance, custom configuration, data migration support, and training sessions for your team.' },
  { q: 'Does Payroll have a free edition?', a: 'We offer a 14-day free trial for all payroll plans. This gives you full access to test all features before committing to a paid plan.' },
  { q: 'How does per-user pricing work?', a: 'Per-user pricing means you pay based on the number of active employees in your system. As your team grows, your plan scales accordingly.' },
  { q: 'Do you offer discounts for non-profits and educational institutions?', a: 'Yes, we offer special pricing for registered non-profits and educational institutions. Contact our sales team for details.' },
  { q: 'Can I try CleonHR before committing?', a: 'Absolutely! We offer a 14-day free trial with full access to all features. No credit card required to start your trial.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data remains accessible for 30 days after cancellation. You can export all your data during this period. After 30 days, data is securely deleted.' }
];

/* ── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  let currentTab = 'hr-admin';
  let isYearly = false;

  const tabBtns = document.querySelectorAll('.chr-pr-tab');
  const toggle = document.getElementById('chr-pr-billing-toggle');
  const labelMonthly = document.getElementById('chr-pr-label-monthly');
  const labelYearly = document.getElementById('chr-pr-label-yearly');

  /* ── Tab switching ── */
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('chr-pr--active'));
      btn.classList.add('chr-pr--active');
      currentTab = btn.dataset.tab;
      renderPricing(currentTab, isYearly);
    });
  });

  /* ── Billing toggle ── */
  if (toggle) {
    toggle.addEventListener('click', () => {
      isYearly = !isYearly;
      toggle.classList.toggle('chr-pr--yearly', isYearly);
      labelMonthly.classList.toggle('chr-pr--active', !isYearly);
      labelYearly.classList.toggle('chr-pr--active', isYearly);
      renderPricing(currentTab, isYearly);
    });
  }

  /* ── Render pricing ── */
  function renderPricing(tab, yearly) {
    const data = CHR_PRICING[tab];
    if (!data) return;

    const titleEl = document.getElementById('chr-pr-section-title');
    const subEl = document.getElementById('chr-pr-section-sub');
    const tiersEl = document.getElementById('chr-pr-tiers');

    if (titleEl) titleEl.textContent = data.title;
    if (subEl) subEl.textContent = data.sub;
    if (!tiersEl) return;

    tiersEl.innerHTML = data.tiers.map(tier => {
      const price = yearly ? tier.yearly : tier.monthly;
      const priceFormatted = '\u20A6' + price.toLocaleString();
      const popularBadge = tier.popular ? '<span class="chr-pr-tier__badge">Most Popular</span>' : '';
      const tierClass = tier.popular ? ' chr-pr-tier--popular' : '';
      const btnClass = tier.popular ? 'chr-pr-tier__btn--primary' : 'chr-pr-tier__btn--outline';

      const featuresHTML = tier.features.map(f =>
        `<li><i class="fa fa-check"></i> ${f}</li>`
      ).join('');

      const extraHTML = tier.extraFeatures.length > 0
        ? `<ul class="chr-pr-tier__features chr-pr-tier__features--extra">
            ${tier.extraFeatures.map(f => `<li><i class="fa fa-check"></i> ${f}</li>`).join('')}
           </ul>`
        : '';

      const noteHTML = tier.note
        ? `<div class="chr-pr-tier__note">${tier.note}</div>`
        : '';

      return `
        <div class="chr-pr-tier${tierClass}">
          ${popularBadge}
          <div class="chr-pr-tier__name">${tier.name}</div>
          <div class="chr-pr-tier__subtitle">${tier.subtitle}</div>
          <div class="chr-pr-tier__price">${priceFormatted}</div>
          <div class="chr-pr-tier__period">/user/month</div>
          <a href="#" class="chr-pr-tier__btn ${btnClass}">START FREE TRIAL</a>
          <div class="chr-pr-tier__divider"></div>
          <div class="chr-pr-tier__features-label">All the essentials:</div>
          <ul class="chr-pr-tier__features">
            ${featuresHTML}
          </ul>
          ${extraHTML}
          ${noteHTML}
        </div>
      `;
    }).join('');
  }

  /* ── FAQ accordion ── */
  const faqList = document.getElementById('chr-pr-faq-list');
  if (faqList) {
    faqList.innerHTML = CHR_FAQ.map((item, i) => `
      <div class="chr-pr-faq-item" data-faq="${i}">
        <button class="chr-pr-faq-item__question">
          <span>${item.q}</span>
          <i class="fa fa-angle-down chr-pr-faq-item__chevron"></i>
        </button>
        <div class="chr-pr-faq-item__answer">
          <p>${item.a}</p>
        </div>
      </div>
    `).join('');

    faqList.querySelectorAll('.chr-pr-faq-item__question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.chr-pr-faq-item');
        const wasOpen = item.classList.contains('chr-pr--open');

        /* close all */
        faqList.querySelectorAll('.chr-pr-faq-item').forEach(el => el.classList.remove('chr-pr--open'));

        /* toggle clicked */
        if (!wasOpen) item.classList.add('chr-pr--open');
      });
    });
  }

  /* initial render */
  renderPricing(currentTab, isYearly);
});
