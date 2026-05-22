/* ═══════════════════════════════════════════════════════════════════
       ORGANISATION CHART — Main Script
    ═══════════════════════════════════════════════════════════════════ */

    // ── Injected server data ──────────────────────────────────────────
    const ORG_DEFAULT = {};
    (function(){
  // Try meta tag first (injected by Odoo controller)
  try {
    const m = document.querySelector('meta[name="__DEFAULT_DATA__"]');
    if (m && m.getAttribute('content')) {
      const d = JSON.parse(m.getAttribute('content'));
      ORG_DEFAULT = d
    //   App.user.name        = d.user_name    || '';
    //   App.user.employee_id = d.employee_id  || null;
    console.log("What is my ORG DEFAULT", ORG_DEFAULT.user_name)
    }
  } catch(e) { console.warn('PMS: Could not parse pms-user-data meta tag', e); }
})();

    // ── State ─────────────────────────────────────────────────────────
    let orgAllEmployees = [];
    let orgFilteredEmps = [];
    let orgSearchTerm = '';
    let orgCurrentView = 'tree'; // 'tree' | 'list'

    // ── Avatar colour palette ─────────────────────────────────────────
    const ORG_PALETTE = [
      '#e91e8c', '#c2185b', '#7c3aed', '#2563eb',
      '#0891b2', '#16a34a', '#d97706', '#dc2626',
    ];
    function orgAvatarColor(name) {
      let h = 0;
      for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
      return ORG_PALETTE[Math.abs(h) % ORG_PALETTE.length];
    }
    function orgInitials(name) {
      return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    }

    // ── Odoo JSON-RPC helper ──────────────────────────────────────────
    function orgRpc(url, params) {
      return $.ajax({
        url: url,
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params: params }),
      }).then(function (res) {
        if (res.error) throw res.error;
        return res.result;
      });
    }

    // ── Toast helper ──────────────────────────────────────────────────
    function orgToast(msg) {
      $('#orgToastMsg').text(msg);
      $('#orgToast').addClass('org-toast-show');
      setTimeout(function () { $('#orgToast').removeClass('org-toast-show'); }, 3000);
    }

    // ── Build avatar HTML ─────────────────────────────────────────────
    function orgAvatarHtml(emp, size) {
      var cls = size === 'sm' ? 'org-list-avatar' : 'org-emp-avatar';
      if (emp.avatar) {
        return '<div class="' + cls + '"><img src="' + emp.avatar + '" alt="" /></div>';
      }
      var bg = orgAvatarColor(emp.name);
      var initials = orgInitials(emp.name);
      var iCls = size === 'sm' ? '' : 'org-emp-avatar-initials';
      return '<div class="' + cls + '"><div class="' + iCls + '" style="background:' + bg + ';width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:' + (size === 'sm' ? '12' : '16') + 'px;font-weight:700;color:#fff;">' + initials + '</div></div>';
    }

    // ── Build tree ────────────────────────────────────────────────────
    function orgBuildTree(employees) {
      // Index employees by id
      var byId = {};
      var roots = [];
      employees.forEach(function (e) { byId[e.id] = e; e._children = []; });

      // Build parent→children relationships
      employees.forEach(function (e) {
        if (e.manager_id && byId[e.manager_id]) {
          byId[e.manager_id]._children.push(e);
        } else {
          roots.push(e);
        }
      });

      // Handle potential circular refs or orphans — attach to virtual root if multiple roots
      if (roots.length === 0 && employees.length > 0) roots = [employees[0]];
      return roots;
    }

    function orgRenderNode(emp, isRoot) {
      var hasCh = emp._children && emp._children.length > 0;
      var avatarHtml = orgAvatarHtml(emp, 'lg');
      var cardCls = isRoot ? 'org-emp-card org-card-top' : 'org-emp-card';
      var toggleBtn = hasCh
        ? '<div class="org-emp-toggle" data-id="' + emp.id + '" title="Toggle children"><i class="fa fa-chevron-down"></i></div>'
        : '';

      var cardHtml = '<div class="' + cardCls + '" data-id="' + emp.id + '">'
        + avatarHtml
        + '<div class="org-emp-name" title="' + orgEsc(emp.name) + '">' + orgEsc(emp.name) + '</div>'
        + '<div class="org-emp-job">' + orgEsc(emp.job_name || emp.job_title || '—') + '</div>'
        + '<div class="org-emp-dept">' + orgEsc(emp.department_name || '—') + '</div>'
        + toggleBtn
        + '</div>';

      var nodeHtml = '<div class="org-node">' + cardHtml + '</div>';

      if (hasCh) {
        var childrenHtml = '<ul class="org-children-list">';
        emp._children.forEach(function (ch) {
          childrenHtml += '<li>' + orgRenderNode(ch, false) + '</li>';
        });
        childrenHtml += '</ul>';
        nodeHtml += childrenHtml;
      }

      return nodeHtml;
    }

    function orgEsc(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function orgRenderChart(employees) {
      var roots = orgBuildTree(employees);
      var html = '<ul class="org-tree">';
      roots.forEach(function (r) {
        html += '<li>' + orgRenderNode(r, true) + '</li>';
      });
      html += '</ul>';
      $('#orgChartWrap').html(html);
      orgBindCardEvents();
    }

    function orgBindCardEvents() {
      // Toggle children
      $(document).off('click.orgtoggle').on('click.orgtoggle', '.org-emp-toggle', function (e) {
        e.stopPropagation();
        var $btn = $(this);
        var $ul = $btn.closest('.org-node').siblings('.org-children-list');
        $ul.toggle(200);
        $btn.toggleClass('org-collapsed');
      });
    }

    // ── Render list view ──────────────────────────────────────────────
    function orgRenderList(employees) {
      var html = '';
      employees.forEach(function (emp) {
        var avatarHtml = '';
        if (emp.avatar) {
          avatarHtml = '<div class="org-list-avatar"><img src="' + emp.avatar + '" alt="" /></div>';
        } else {
          var bg = orgAvatarColor(emp.name);
          avatarHtml = '<div class="org-list-avatar" style="background:' + bg + ';">' + orgInitials(emp.name) + '</div>';
        }
        html += '<tr>'
          + '<td><div class="org-list-emp-cell">' + avatarHtml
          + '<div><div class="org-list-emp-name">' + orgEsc(emp.name) + '</div>'
          + '<div class="org-list-emp-num">' + orgEsc(emp.employee_number || '—') + '</div></div></div></td>'
          + '<td>' + orgEsc(emp.employee_number || '—') + '</td>'
          + '<td><span class="org-badge">' + orgEsc(emp.job_name || emp.job_title || '—') + '</span></td>'
          + '<td>' + orgEsc(emp.department_name || '—') + '</td>'
          + '<td>' + orgEsc(emp.work_email || '—') + '</td>'
          + '<td>' + orgEsc(emp.work_phone || emp.mobile_phone || '—') + '</td>'
          + '</tr>';
      });
      $('#orgListBody').html(html);
    }

    // ── Stats bar ─────────────────────────────────────────────────────
    function orgUpdateStats(employees) {
      var depts = new Set(employees.map(function (e) { return e.department_name; }).filter(Boolean));
      var jobs = new Set(employees.map(function (e) { return e.job_name; }).filter(Boolean));
      var managers = employees.filter(function (e) { return e.child_ids && e.child_ids.length > 0; });
      $('#orgStatTotal').text(employees.length);
      $('#orgStatDepts').text(depts.size);
      $('#orgStatJobs').text(jobs.size);
      $('#orgStatManagers').text(managers.length);
      $('#orgStatsBar').show();
    }

    // ── Populate filter dropdowns ─────────────────────────────────────
    function orgPopulateFilters(data) {
      data.departments.forEach(function (d) {
        $('#orgFilterDept').append($('<option>').val(d.id).text(d.name));
      });
      data.companies.forEach(function (c) {
        $('#orgFilterCompany').append($('<option>').val(c.id).text(c.name));
      });
      data.jobs.forEach(function (j) {
        $('#orgFilterJob').append($('<option>').val(j.id).text(j.name));
      });
    }

    // ── Apply client-side search filter ──────────────────────────────
    function orgApplySearch(employees, term) {
      if (!term) return employees;
      term = term.toLowerCase();
      return employees.filter(function (e) {
        return (e.name || '').toLowerCase().includes(term)
          || (e.job_name || '').toLowerCase().includes(term)
          || (e.work_email || '').toLowerCase().includes(term)
          || (e.employee_number || '').toLowerCase().includes(term)
          || (e.department_name || '').toLowerCase().includes(term);
      });
    }

    // ── Re-render based on current view ──────────────────────────────
    function orgRerender() {
      var emps = orgApplySearch(orgFilteredEmps, orgSearchTerm);
      if (orgCurrentView === 'tree') {
        orgRenderChart(emps);
      } else {
        orgRenderList(emps);
      }
      orgUpdateStats(emps);
    }

    // ── Load employees from server ────────────────────────────────────
    function orgLoadEmployees(params) {
      $('#orgLoading').show();
      orgRpc('/organisation-chart/employees', params || {})
        .then(function (emps) {
          orgAllEmployees = emps;
          orgFilteredEmps = emps;
          orgRerender();
          $('#orgLoading').hide();
        })
        .fail(function () {
          $('#orgLoading').hide();
          orgToast('Failed to load employees. Check server logs.');
        });
    }

    // ── Tooltip ───────────────────────────────────────────────────────
    function orgFindEmpById(id) {
      return orgAllEmployees.find(function (e) { return e.id === id; });
    }

    function orgShowTooltip(emp, x, y) {
      // Avatar
      var $av = $('#orgTipAvatar');
      if (emp.avatar) {
        $av.html('<img src="' + emp.avatar + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />');
      } else {
        var bg = orgAvatarColor(emp.name);
        $av.html('<div class="org-tooltip-avatar-initials" style="background:' + bg + ';width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;">' + orgInitials(emp.name) + '</div>');
      }
      $('#orgTipName').text(emp.name);
      $('#orgTipJob').text(emp.job_name || emp.job_title || '—');
      $('#orgTipNum').text(emp.employee_number || 'N/A');
      $('#orgTipEmail').text(emp.work_email || 'N/A');
      $('#orgTipPhone').text(emp.work_phone || emp.mobile_phone || 'N/A');
      $('#orgTipDept').text(emp.department_name || 'N/A');

      var $tip = $('#orgTooltip');
      var tw = 240, th = $tip.outerHeight() || 180;
      var wx = $(window).width(), wy = $(window).height();
      var left = x + 14, top = y - th / 2;
      if (left + tw > wx - 10) left = x - tw - 14;
      if (top < 10) top = 10;
      if (top + th > wy - 10) top = wy - th - 10;
      $tip.css({ left: left, top: top }).addClass('org-tooltip-visible');
    }

    function orgHideTooltip() {
      $('#orgTooltip').removeClass('org-tooltip-visible');
    }

    // ── PDF Export ────────────────────────────────────────────────────
    function orgExportPdf() {
      var emps = orgApplySearch(orgFilteredEmps, orgSearchTerm);
      if (!emps.length) { orgToast('No employees to export.'); return; }

      var { jsPDF } = window.jspdf;
      var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(233, 30, 140);
      doc.text('Organisation Chart Report', 14, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 100, 120);
      doc.text('Generated: ' + new Date().toLocaleString(), 14, 25);

      var rows = emps.map(function (e) {
        return [
          e.name || '—',
          e.employee_number || '—',
          e.job_name || e.job_title || '—',
          e.work_email || '—',
          e.work_phone || e.mobile_phone || '—',
          e.department_name || '—',
          e.company_name || '—',
        ];
      });

      doc.autoTable({
        startY: 30,
        head: [['Name', 'Staff Number', 'Position', 'Work Email', 'Phone', 'Department', 'Company']],
        body: rows,
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3 },
        headStyles: {
          fillColor: [233, 30, 140], textColor: 255,
          fontStyle: 'bold', fontSize: 9,
        },
        alternateRowStyles: { fillColor: [252, 228, 243] },
        margin: { left: 14, right: 14 },
      });

      doc.save('organisation-chart.pdf');
      orgToast('PDF exported successfully!');
    }

    // ═══════════════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════════════
    $(function () {

      // Set user info in sidebar
      $('#orgSidebarName').text(ORG_DEFAULT.user_name || 'User');
      $('#orgSidebarEmail').text(ORG_DEFAULT.user_email || '');
      $('#orgSidebarAvatar').text((ORG_DEFAULT.user_name || 'U').slice(0, 1).toUpperCase());

      // Load filter options
      orgRpc('/organisation-chart/filters', {}).then(orgPopulateFilters);

      // Initial load
      orgLoadEmployees({});

      // ── Filter changes ────────────────────────────────────────────
      function orgServerFilter() {
        var params = {
          department_id: $('#orgFilterDept').val() || null,
          company_id: $('#orgFilterCompany').val() || null,
          job_id: $('#orgFilterJob').val() || null,
        };
        orgRpc('/organisation-chart/employees', params)
          .then(function (emps) {
            orgAllEmployees = emps;
            orgFilteredEmps = emps;
            orgRerender();
            $('#orgLoading').hide();
          });
        $('#orgLoading').show();
      }

      $('#orgFilterDept,#orgFilterCompany,#orgFilterJob').on('change', orgServerFilter);

      // ── Search ────────────────────────────────────────────────────
      var orgSearchTimer;
      $('#orgSearchInput').on('input', function () {
        clearTimeout(orgSearchTimer);
        var term = $(this).val().trim();
        orgSearchTimer = setTimeout(function () {
          orgSearchTerm = term;
          orgRerender();
        }, 250);
      });

      // ── View toggle ───────────────────────────────────────────────
      $('#orgBtnTree').on('click', function () {
        orgCurrentView = 'tree';
        $(this).addClass('org-view-active');
        $('#orgBtnList').removeClass('org-view-active');
        $('#orgTreeView').addClass('org-view-show');
        $('#orgListView').removeClass('org-view-show');
        orgRerender();
      });

      $('#orgBtnList').on('click', function () {
        orgCurrentView = 'list';
        $(this).addClass('org-view-active');
        $('#orgBtnTree').removeClass('org-view-active');
        $('#orgListView').addClass('org-view-show');
        $('#orgTreeView').removeClass('org-view-show');
        orgRerender();
      });

      // ── Export ────────────────────────────────────────────────────
      $('#orgExportBtn').on('click', orgExportPdf);

      // ── Tooltip – delegate on card hover ─────────────────────────
      $(document).on('mouseenter', '.org-emp-card', function (e) {
        var id = parseInt($(this).data('id'), 10);
        var emp = orgFindEmpById(id);
        if (emp) orgShowTooltip(emp, e.clientX, e.clientY);
      });
      $(document).on('mousemove', '.org-emp-card', function (e) {
        var $tip = $('#orgTooltip');
        if ($tip.hasClass('org-tooltip-visible')) {
          var tw = 240, th = $tip.outerHeight() || 180;
          var wx = $(window).width(), wy = $(window).height();
          var left = e.clientX + 14, top = e.clientY - th / 2;
          if (left + tw > wx - 10) left = e.clientX - tw - 14;
          if (top < 10) top = 10;
          if (top + th > wy - 10) top = wy - th - 10;
          $tip.css({ left: left, top: top });
        }
      });
      $(document).on('mouseleave', '.org-emp-card', function () {
        orgHideTooltip();
      });
});