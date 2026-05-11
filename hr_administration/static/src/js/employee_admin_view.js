$(function () {
  'use strict';

  /* ── Colors ─────────────────────────────────────────── */
  var C = {
    rose:   '#FF2D78', cobalt: '#3D5AFE', emerald: '#00C48C',
    amber:  '#FF8F00', slate:  '#FF5252', lavender:'#7C4DFF',
    teal:   '#00BCD4', ink:    '#0D0F1C', ink2:    '#3D4263',
    ink3:   '#7B82A3', ink4:   '#B0B7D0', border:  '#E8EAF2', bg: '#F4F5FB'
  };
  var DEPT_COLORS = [C.cobalt, C.rose, C.amber, C.emerald, C.lavender, C.teal, '#FF8C42', '#FFD166'];

  /* ── Read defaultData from response header ───────────── */
  var DEFAULT_DATA = {};
  try {
    // Odoo passes user info in the 'defaultData' header via make_response()
    // jQuery doesn't expose custom response headers easily from the page context,
    // so we embed them as a meta tag in the controller (see instructions below),
    // OR we read from a global injected by Odoo session.
    // Fallback: try window.__HR_DATA__ (set by controller via <script> injection)
    if (window.__HR_DATA__) DEFAULT_DATA = window.__HR_DATA__;
  } catch(e) {}

  /* ── Utility ─────────────────────────────────────────── */
  function fmt(n) {
    if (n == null) return '—';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function toast(msg, type) {
    type = type || 'success';
    var t = $('<div class="toast ' + type + '">' +
      '<span class="toast-ico">' + (type === 'success' ? '✓' : '✕') + '</span>' +
      '<span>' + msg + '</span></div>');
    $('#toastContainer').append(t);
    t.on('click', function() { t.remove(); });
    setTimeout(function() { t.fadeOut(300, function() { t.remove(); }); }, 3000);
  }

  /* ── Date & Greeting ─────────────────────────────────── */
  function initDate() {
    var d = new Date();
    var days  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months= ['January','February','March','April','May','June','July',
                 'August','September','October','November','December'];
    $('#dateLbl').text(days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear());
    var h = d.getHours();
    $('#greetingTime').text(h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening');
  }

  /* ── User info ───────────────────────────────────────── */
  function initUser() {
    // Try Odoo session globals first
    var name = '';
    try {
      if (window.odoo && odoo.session_info) name = odoo.session_info.name || '';
    } catch(e) {}
    // Fallback to injected __HR_DATA__
    if (!name && DEFAULT_DATA.user_name) name = DEFAULT_DATA.user_name;
    if (!name) name = 'User';

    var first = name.split(' ')[0];
    var initials = name.split(' ').map(function(w){ return w[0]; }).join('').slice(0,2).toUpperCase();
    $('#greetingName').text(first);
    $('#userName').text(name);
    $('#userAva').text(initials);
  }

  /* ── JSON-RPC helper ────────────────────────────────── */
  function rpc(route, params) {
    return $.ajax({
      url: route,
      type: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: Date.now(), params: params || {} })
    }).then(function(d) {
      if (d.error) throw new Error(d.error.data && d.error.data.message || d.error.message || 'RPC error');
      return d.result;
    });
  }

  /* ── DEMO DATA (used when RPC fails) ─────────────────── */
  function demoMetrics() {
    return { total_employees:23, total_employees_change:5.2,
      active_employees:23, on_leave_today:3, pending_requests:38,
      disciplinary_cases:7, expiring_contracts:15, pending_approvals:94,
      hmo_enrollments:17, assets_overdue:18 };
  }
  function demoHeadcount(months) {
    var all = { categories:['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'],
                data:[98,102,105,106,110,113,115,118,120,122,124,128] };
    var n = parseInt(months) || 6;
    return { categories: all.categories.slice(-n), data: all.data.slice(-n) };
  }
  function demoDepts() {
    return [{name:'Engineering',y:385},{name:'Sales',y:248},{name:'Marketing',y:156},
            {name:'Operations',y:195},{name:'Finance',y:124},{name:'HR',y:60},{name:'Others',y:32}];
  }
  function demoLeave() {
    return [{department:'Engineering',utilized:68},{department:'Sales',utilized:82},
            {department:'Marketing',utilized:75},{department:'Operations',utilized:71},
            {department:'Finance',utilized:88},{department:'HR',utilized:65}];
  }

  function demoGrade() {
    return [{department:'Engineering', utilized:1},{department:'Sales',utilized:3},
            {department:'Marketing', utilized:2},{department:'Operations',utilized:20},
            {department:'Finance',utilized:1},{department:'HR',utilized:43}];
  }
  function demoAttention() {
    return [
      {priority:'high',  title:'Leave Requests Pending Approval', description:'12 urgent requests require immediate attention', module:'Leave Management',    count:38, route:'/odoo/time-off'},
      {priority:'high',  title:'Contracts Expiring in 30 Days',   description:'5 contracts expire within the next 7 days',     module:'Workforce Lifecycle', count:15, route:'/odoo/employees'},
      {priority:'medium',title:'Disciplinary Cases Pending',       description:'3 cases require immediate review',              module:'Disciplinary Mgmt',   count:7,  route:'/odoo/employees'},
      {priority:'low',   title:'Assets Overdue for Return',        description:'8 laptops overdue by more than 7 days',         module:'Asset Management',    count:18, route:'/odoo/maintenance'},
      {priority:'medium',title:'HMO Enrollment Approvals',         description:'Pending enrollment approvals',                  module:'Health Insurance',    count:25, route:'/odoo/time-off'},
      {priority:'low',   title:'Performance Reviews Pending',       description:'Q1 2026 performance reviews',                   module:'Workforce Lifecycle', count:45, route:'/odoo/employees'}
    ];
  }
  function demoEvents() {
    return [
      {name:'Q2 Performance Review Kickoff', day:'15', month:'MAY', type:'calendar', color: C.cobalt},
      {name:'Contract Expiry: John Adeyemi', day:'20', month:'MAY', type:'contract', color: C.amber},
      {name:'HMO Renewal Deadline',          day:'25', month:'MAY', type:'calendar', color: C.cobalt},
      {name:'New Employee Onboarding',       day:'01', month:'JUN', type:'calendar', color: C.emerald}
    ];
  }

  /* ── RENDER: Metrics ─────────────────────────────────── */
  var METRIC_DEFS = [
    {key:'total_employees',   label:'Total Employees',   sub:'vs last month',     icon:'👥', color:C.cobalt,   changeKey:'total_employees_change', route:'/odoo/employees'},
    {key:'active_employees',  label:'Active Employees',  sub:'vs last month',     icon:'✅', color:C.emerald,  route:'/odoo/employees'},
    {key:'on_leave_today',    label:'On Leave Today',    sub:'employees',         icon:'🌴', color:C.amber,    route:'/odoo/time-off'},
    {key:'pending_requests',  label:'Pending Requests',  sub:'awaiting approval', icon:'📋', color:C.rose,     route:'/odoo/time-off'},
    {key:'disciplinary_cases',label:'Disciplinary Cases',sub:'open cases',        icon:'⚠️', color:C.slate,    route:'/odoo/employees'},
    {key:'expiring_contracts',label:'Expiring Contracts',sub:'in 30 days',        icon:'📄', color:'#FF8F00',  route:'/odoo/employees'},
    {key:'pending_approvals', label:'Pending Approvals', sub:'across modules',    icon:'🔔', color:C.lavender, route:'/odoo/time-off'},
    {key:'hmo_enrollments',   label:'HMO Enrollments',  sub:'active plans',      icon:'🏥', color:C.teal,     route:'/odoo/employees'},
    {key:'assets_overdue',    label:'Assets Overdue',    sub:'unreturned',        icon:'💻', color:'#FF8C42',  route:'/odoo/maintenance'}
  ];

  function renderMetrics(data) {
    var grid = $('#metricsGrid').empty();
    $.each(METRIC_DEFS, function(i, def) {
      var val = data[def.key] != null ? data[def.key] : 0;
      var ch  = def.changeKey ? data[def.changeKey] : null;
      var changeHtml = '';
      if (ch != null) {
        var dir = ch >= 0 ? 'up' : 'down', arrow = ch >= 0 ? '↑' : '↓';
        changeHtml = '<span class="metric-change ' + dir + '">' + arrow + ' ' + Math.abs(ch) + '%</span>';
      }
      var card = $('<a class="metric-card"></a>').attr({href: def.route || '#', style: '--accent:' + def.color}).html(
        changeHtml +
        '<div class="metric-ico" style="background:' + def.color + '22;color:' + def.color + '">' + def.icon + '</div>' +
        '<div class="metric-val">' + fmt(val) + '</div>' +
        '<div class="metric-lbl">' + def.label + '</div>' +
        '<div class="metric-sub">' + def.sub + '</div>'
      );
      grid.append(card);
    });
    // Update sidebar badges
    if (data.total_employees) $('#navEmpCount').text(data.total_employees);
    if (data.pending_requests) $('#navLeaveCount').text(data.pending_requests);
  }

  /* ── RENDER: Headcount Chart ─────────────────────────── */
  var headcountChartInst = null;

  function renderHeadcount(data) {
    if (!window.Highcharts) return;
    var el = document.getElementById('headcountChart');
    if (!el || el.offsetWidth === 0) {
      setTimeout(function(){ renderHeadcount(data); }, 150);
      return;
    }
    if (headcountChartInst) { try { headcountChartInst.destroy(); } catch(e){} }
    var max = Math.max.apply(null, data.data);
    headcountChartInst = Highcharts.chart('headcountChart', {
      chart: { type:'areaspline', backgroundColor:'transparent', margin:[10,10,30,40], style:{fontFamily:"'Outfit',sans-serif"}, animation:{duration:700} },
      title: { text: null }, credits: { enabled: false }, legend: { enabled: false },
      tooltip: { backgroundColor:'#fff', borderColor:C.border, borderRadius:10, shadow:true,
        style:{fontSize:'12px',color:C.ink},
        formatter: function(){ return '<b>' + this.x + '</b><br/>Headcount: <b>' + this.y + '</b>'; } },
      xAxis: { categories:data.categories, lineColor:'transparent', tickColor:'transparent',
        labels:{style:{color:C.ink4,fontSize:'11px'}} },
      yAxis: { title:{text:null}, min: Math.max(0, max - Math.ceil(max * 0.5)),
        gridLineColor:C.border, gridLineDashStyle:'Dash',
        labels:{style:{color:C.ink4,fontSize:'11px'}},
        plotLines:[{value:max,color:C.ink4,dashStyle:'Dash',width:1,label:{text:'Target',style:{color:C.ink4,fontSize:'10px'}}}] },
      plotOptions: { areaspline: { color:C.rose,
        fillColor:{linearGradient:{x1:0,y1:0,x2:0,y2:1},stops:[[0,'rgba(255,45,120,.18)'],[1,'rgba(255,45,120,0)']]},
        lineWidth:2.5, marker:{symbol:'circle',radius:4,fillColor:'#fff',lineColor:C.rose,lineWidth:2} } },
      series: [{ data: data.data, name: 'Headcount' }]
    });
  }

  /* ── RENDER: Department Donut ────────────────────────── */
  var deptChartInst = null;

  function renderDept(data) {
    if (!window.Highcharts || !data.length) return;
    var el = document.getElementById('deptChart');
    if (!el || el.offsetWidth === 0) {
      setTimeout(function(){ renderDept(data); }, 150);
      return;
    }
    if (deptChartInst) { try { deptChartInst.destroy(); } catch(e){} }
    var total   = 0;
    var colored = $.map(data, function(d, i) {
      total += d.y;
      return $.extend({}, d, { color: DEPT_COLORS[i % DEPT_COLORS.length] });
    });
    deptChartInst = Highcharts.chart('deptChart', {
      chart: { type:'pie', backgroundColor:'transparent', margin:[0,0,0,0], style:{fontFamily:"'Outfit',sans-serif"}, animation:{duration:700} },
      title: { text: null }, credits: { enabled: false },
      tooltip: { backgroundColor:'#fff', borderColor:C.border, borderRadius:10,
        style:{fontSize:'12px',color:C.ink},
        pointFormat:'<b>{point.name}</b>: {point.y} ({point.percentage:.0f}%)' },
      plotOptions: { pie: { innerSize:'66%', dataLabels:{enabled:false}, borderWidth:3, borderColor:'#fff',
        states:{hover:{halo:{size:6}}} } },
      series: [{ name:'Employees', data: colored }]
    });
    // Center label
    setTimeout(function() {
      var $c = $('#deptChart');
      if (!$c.find('.donut-lbl').length) {
        $c.append('<div class="donut-lbl" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);text-align:center;pointer-events:none">' +
          '<div style="font-size:22px;font-weight:800;color:' + C.ink + ';letter-spacing:-1px">' + fmt(total) + '</div>' +
          '<div style="font-size:11px;color:' + C.ink4 + '">total</div></div>');
      }
    }, 120);
    // Legend
    var leg = $('#deptLegend').empty();
    $.each(colored, function(i, d) {
      leg.append('<div class="dept-legend-item">' +
        '<div class="dept-dot" style="background:' + d.color + '"></div>' +
        '<span>' + d.name + ' (' + d.y + ')</span></div>');
    });
  }

  /* ── RENDER: Leave Bars ──────────────────────────────── */
  function renderLeave(data) {
    var container = $('#leaveBars').empty();
    if (!data.length) {
      container.html('<div class="empty-state">No leave data available</div>');
      return;
    }
    $.each(data, function(i, item) {
      var row = $('<div class="leave-row"></div>').html(
        '<div class="leave-dept">' + item.department + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:0" data-target="' + item.utilized + '"></div></div>' +
        '<div class="leave-pct">' + item.utilized + '%</div>'
      );
      container.append(row);
    });
    // Animate after paint
    requestAnimationFrame(function() {
      container.find('.bar-fill').each(function() {
        var $b = $(this), target = $b.data('target');
        setTimeout(function(){ $b.css('width', target + '%'); }, 80);
      });
    });
  }

  /* ── RENDER: Leave Bars ──────────────────────────────── */
  function renderGradeDistribution(data) {
    var container = $('#gradeBars').empty();
    if (!data.length) {
      container.html('<div class="empty-state">No data available</div>');
      return;
    }
    $.each(data, function(i, item) {
      var row = $('<div class="leave-row"></div>').html(
        '<div class="leave-dept">' + item.department + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:0" data-target="' + item.utilized + '"></div></div>' +
        '<div class="leave-pct">' + item.utilized + '%</div>'
      );
      container.append(row);
    });
    // Animate after paint
    requestAnimationFrame(function() {
      container.find('.bar-fill').each(function() {
        var $b = $(this), target = $b.data('target');
        setTimeout(function(){ $b.css('width', target + '%'); }, 80);
      });
    });
  }

  /* ── RENDER: Attention Items ─────────────────────────── */
  function renderAttention(items) {
    var list = $('#attnList').empty();
    if (!items.length) {
      list.html('<div class="empty-state">✓ All clear — no urgent items</div>');
      return;
    }
    var highCount = 0;
    $.each(items, function(i, item) {
      if (item.priority === 'high') highCount++;
      var card = $('<a class="attn-item"></a>').attr('href', item.route || '#').html(
        '<span class="pri-badge ' + item.priority + '">' + item.priority + '</span>' +
        '<div class="attn-body">' +
          '<div class="attn-title">' + item.title + '</div>' +
          '<div class="attn-desc">' + item.description + '</div>' +
          '<div class="attn-mod"><span>⬤</span>' + item.module + '</div>' +
        '</div>' +
        '<div class="attn-count">' + item.count + '</div>'
      );
      list.append(card);
    });
    $('#notifBadge').text(highCount || '');
  }

  /* ── RENDER: Events ──────────────────────────────────── */
  function renderEvents(events) {
    var container = $('#eventsList').empty();
    if (!events.length) {
      container.html('<div class="empty-state">No upcoming events</div>');
      return;
    }
    $.each(events, function(i, ev) {
      var color = ev.color || C.cobalt;
      var typeLabel = ev.type === 'contract' ? 'Contract Expiry' : 'Calendar Event';
      // Parse day/month if not precomputed
      var day = ev.day, month = ev.month;
      if (!day && ev.date) {
        var d = new Date(ev.date);
        var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        day   = d.getDate();
        month = MONTHS[d.getMonth()];
      }
      var item = $('<div class="event-item"></div>').html(
        '<div class="event-badge" style="background:' + color + '">' +
          '<span>' + day + '</span>' +
          '<span class="mo">' + month + '</span>' +
        '</div>' +
        '<div>' +
          '<div class="event-name">' + ev.name + '</div>' +
          '<div class="event-type">' + typeLabel + '</div>' +
        '</div>'
      );
      container.append(item);
    });
  }

  /* ── LOAD ALL DATA ───────────────────────────────────── */
  function loadAll() {
    // Metrics
    rpc('/hr_administration/api/metrics')
      .then(renderMetrics)
      .catch(function() { renderMetrics(demoMetrics()); });

    // Headcount
    var months = parseInt($('#periodSel').val()) || 6;
    rpc('/hr_administration/api/headcount_trend', { months: months })
      .then(renderHeadcount)
      .catch(function() { renderHeadcount(demoHeadcount(months)); });

    // Department
    rpc('/hr_administration/api/department_distribution')
      .then(renderDept)
      .catch(function() { renderDept(demoDepts()); });

    // Leave
    rpc('/hr_administration/api/leave_utilization')
      .then(renderLeave)
      .catch(function() { renderLeave(demoLeave()); });
    // Grade Utilization
    rpc('/hr_administration/api/leave_utilization')
      .then(renderGradeDistribution(demoGrade()))
      .catch(function() {renderGradeDistribution(demoGrade()); });

    // Attention
    rpc('/hr_administration/api/attention_items')
      .then(renderAttention)
      .catch(function() { renderAttention(demoAttention()); });

    // Events
    rpc('/hr_administration/api/upcoming_events')
      .then(renderEvents)
      .catch(function() { renderEvents(demoEvents()); });
  }

  /* ── EVENT BINDINGS ──────────────────────────────────── */
  // Mobile sidebar
  $('#menuToggle').on('click', function() {
    $('#sidebar').toggleClass('open');
    $('#sidebarOverlay').toggleClass('show');
  });
  $('#sidebarOverlay').on('click', function() {
    $('#sidebar').removeClass('open');
    $(this).removeClass('show');
  });

  // Refresh
  $('#refreshBtn').on('click', function() {
    var $icon = $('#refreshIcon');
    $icon.addClass('spin');
    loadAll();
    setTimeout(function() { $icon.removeClass('spin'); }, 800);
    toast('Dashboard refreshed', 'success');
  });

  // Period change — reload headcount
  $('#periodSel').on('change', function() {
    var months = parseInt($(this).val()) || 6;
    rpc('/hr_administration/api/headcount_trend', { months: months })
      .then(renderHeadcount)
      .catch(function() { renderHeadcount(demoHeadcount(months)); });
  });

  // Export (stub)
  $('#exportBtn').on('click', function() {
    toast('Export started — check your downloads', 'success');
  });

  /* ── INIT ────────────────────────────────────────────── */
  initDate();
  initUser();
  loadAll();

});