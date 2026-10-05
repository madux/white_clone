<script>
/* =========================================================================
   DATA LAYER
   Everything below reads from the `calendar.event` table, filtered by
   `event_type` (e.g. "campaign", "birthday", "work_anniversary",
   "retirement"). Replace `fetchCalendarEvents()` with your real API/DB
   call — the rest of the rendering code only depends on the shape
   documented below.

   Expected row shape from calendar.event:
   {
     id: string,
     event_type: "campaign" | "birthday" | "work_anniversary" | "retirement",
     title: string,               // e.g. "Birthday Celebration Campaign" or employee name
     status: string,               // e.g. "active", "scheduled", "completed"
     progress_pct: number|null,    // campaigns only, 0-100 or null
     department: string|null,      // celebrations only
     event_date: string,           // ISO date, used to compute "days away"
     department_or_type_label: string|null
   }
   ========================================================================= */

async function fetchCalendarEvents(eventTypes) {
  // ---- Replace this block with your real backend call, e.g.: -------------
  // const res = await fetch(`/api/method/calendar.get_events?event_type=${eventTypes.join(',')}`);
  // if (!res.ok) throw new Error('Failed to load calendar.event');
  // return await res.json();
  // --------------------------------------------------------------------
  // Demo fallback data below mirrors calendar.event rows so the page
  // renders standalone until the real endpoint is wired in.
  const demoRows = [
    { id: 'c1', event_type: 'campaign', title: 'Birthday Celebration Campaign', status: 'active', progress_pct: 82, event_date: '2026-08-19' },
    { id: 'c2', event_type: 'campaign', title: 'Work Anniversary Campaign', status: 'active', progress_pct: 74, event_date: '2026-08-19' },
    { id: 'c3', event_type: 'campaign', title: 'Christmas 2026', status: 'scheduled', progress_pct: null, event_date: '2026-12-25' },

    { id: 'e1', event_type: 'birthday', title: 'Emma Johnson', department_or_type_label: 'Birthday · Marketing', event_date: '2026-08-21' },
    { id: 'e2', event_type: 'work_anniversary', title: 'James Okafor', department_or_type_label: 'Work Anniversary · Engineering', event_date: '2026-08-24' },
    { id: 'e3', event_type: 'work_anniversary', title: 'Sarah Chen', department_or_type_label: 'Work Anniversary · Sales', event_date: '2026-08-26' },
    { id: 'e4', event_type: 'birthday', title: 'Michael Brown', department_or_type_label: 'Birthday · HR', event_date: '2026-08-29' },
    { id: 'e5', event_type: 'retirement', title: 'Lisa Anderson', department_or_type_label: 'Retirement · Finance', event_date: '2026-09-02' },
  ];
  return demoRows.filter(r => eventTypes.includes(r.event_type));
}

const EXP_CELEBRATION_ICONS = {
  birthday: '🎂',
  work_anniversary: '🎉',
  retirement: '🏅',
};

function exp_daysFromToday(isoDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  const diffMs = target - today;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function exp_renderCampaigns(rows) {
  const container = document.getElementById('exp_campaigns_list');
  if (!rows.length) {
    container.innerHTML = '<div class="exp_list_empty">No active campaigns.</div>';
    return;
  }
  container.innerHTML = rows.map(row => {
    const hasProgress = row.progress_pct !== null && row.progress_pct !== undefined;
    const progressLabel = hasProgress ? `${row.progress_pct}%` : 'N/A';
    const actionLabel = row.status === 'active' ? 'Pause' : (row.status === 'scheduled' ? 'Scheduled' : row.status);
    const statusLabel = row.status.charAt(0).toUpperCase() + row.status.slice(1);
    return `
      <div class="exp_campaign_row">
        <div>
          <p class="exp_campaign_name">${row.title}</p>
          <p class="exp_campaign_status">${statusLabel}</p>
        </div>
        <div class="exp_campaign_meta">
          <p class="exp_campaign_progress ${hasProgress ? '' : 'exp_no_progress'}">${progressLabel}</p>
          <p class="exp_campaign_action">${actionLabel}</p>
        </div>
      </div>`;
  }).join('');
}

function exp_renderCelebrations(rows) {
  const container = document.getElementById('exp_celebrations_list');
  if (!rows.length) {
    container.innerHTML = '<div class="exp_list_empty">No upcoming celebrations.</div>';
    return;
  }
  const sorted = [...rows].sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  container.innerHTML = sorted.map(row => {
    const icon = EXP_CELEBRATION_ICONS[row.event_type] || '📌';
    const days = exp_daysFromToday(row.event_date);
    const daysLabel = days <= 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`;
    return `
      <div class="exp_celebration_row">
        <div class="exp_celebration_avatar">${icon}</div>
        <div class="exp_celebration_info">
          <p class="exp_celebration_name">${row.title}</p>
          <p class="exp_celebration_sub">${row.department_or_type_label || ''}</p>
        </div>
        <div class="exp_celebration_days">${daysLabel}</div>
      </div>`;
  }).join('');
}

function exp_setStat(id, value) {
  document.getElementById(id).textContent = value;
}

async function exp_init() {
  try {
    const campaignRows = await fetchCalendarEvents(['campaign']);
    exp_renderCampaigns(campaignRows);
    exp_setStat('exp_stat_campaigns', campaignRows.filter(r => r.status === 'active').length);

    const celebrationTypes = ['birthday', 'work_anniversary', 'retirement'];
    const celebrationRows = await fetchCalendarEvents(celebrationTypes);
    // Keep only celebrations within the next 30 days for the list + stat.
    const upcoming = celebrationRows.filter(r => {
      const d = exp_daysFromToday(r.event_date);
      return d >= 0 && d <= 30;
    });
    exp_renderCelebrations(upcoming);
    exp_setStat('exp_stat_celebrations', upcoming.length);

    // These three stats aren't sourced from calendar.event in the
    // reference design — wire them to their own endpoints as needed.
    exp_setStat('exp_stat_videos', 18);
    exp_setStat('exp_stat_messages', 47);
    exp_setStat('exp_stat_knowledge', 8);
    exp_setStat('exp_stat_recognitions', 43);
  } catch (err) {
    console.error(err);
    document.getElementById('exp_campaigns_list').innerHTML = '<div class="exp_error">Could not load campaigns.</div>';
    document.getElementById('exp_celebrations_list').innerHTML = '<div class="exp_error">Could not load celebrations.</div>';
  }
}
 
</script>