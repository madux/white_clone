/* ===========================================================
   Cleon Payroll Dashboard — jQuery + Chart.js controller
   =========================================================== */
(function ($) {
  "use strict";

  var PINK = "#ec4899";
  var PALETTE = ["#ec4899", "#a855f7", "#f43f5e", "#d946ef", "#fb7185",
                 "#c084fc", "#f472b6", "#e879f9", "#fda4af", "#f0abfc"];

  var charts = {};
  var state = {
    location_id: "",
    department_id: "",
    deduction_code: "",
    structure_id: "",
    date_from: "",
    date_to: "",
  };

  var fmtMoney = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  function money(v) { return fmtMoney.format(v || 0); }

  function showLoading(show) {
    $("#cpdLoading").toggleClass("show", !!show);
  }

  function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function chartLibReady() {
    if (typeof Chart === "undefined") {
      console.warn("Cleon Payroll Dashboard: Chart.js is not loaded, skipping chart render.");
      return false;
    }
    return true;
  }

  function makeDoughnut(canvasId, labels, values, colors) {
    if (!chartLibReady()) return;
    destroyChart(canvasId);
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    charts[canvasId] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{ data: values, backgroundColor: colors || PALETTE, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        // resizeDelay: 150,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
        cutout: "62%",
      },
    });
  }

  function makeBar(canvasId, labels, datasets, horizontal) {
    if (!chartLibReady()) return;
    destroyChart(canvasId);
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    charts[canvasId] = new Chart(ctx, {
      type: "bar",
      data: { labels: labels, datasets: datasets },
      options: {
        indexAxis: horizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 150,
        plugins: { legend: { display: datasets.length > 1, position: "bottom" } },
        scales: { y: { beginAtZero: true }, x: { beginAtZero: true } },
      },
    });
  }

  function makeLine(canvasId, labels, datasets) {
    if (!chartLibReady()) return;
    destroyChart(canvasId);
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    charts[canvasId] = new Chart(ctx, {
      type: "line",
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 150,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  function dataset(label, data, color, fill) {
    return {
      label: label,
      data: data,
      backgroundColor: fill ? color + "33" : color,
      borderColor: color,
      borderWidth: 2,
      tension: 0.35,
      fill: !!fill,
      borderRadius: 6,
    };
  }

  /* ---------------- Filters ---------------- */
  function loadFilters() {
    $.get("/payroll-reporting/filters", function (res) {
      var $loc = $("#fLocation"), $dept = $("#fDepartment"),
          $ded = $("#fDeduction"), $struct = $("#fStructure");

      (res.locations || []).forEach(function (l) {
        $loc.append($("<option>").val(l.id).text(l.name));
      });
      (res.departments || []).forEach(function (d) {
        $dept.append($("<option>").val(d.id).text(d.name));
      });
      (res.deduction_types || []).forEach(function (d) {
        $ded.append($("<option>").val(d.code).text(d.name));
      });
      (res.structures || []).forEach(function (s) {
        $struct.append($("<option>").val(s.id).text(s.name));
      });

      if (!res.locations || !res.locations.length) {
        $("#fLocation").closest(".cpd-filter-item").find("label")
          .text("Location (not configured)");
      }
    });
  }

  /* ---------------- Data load ---------------- */
  function loadData() {
    showLoading(true);
    $.get("/payroll-reporting/data", state)
      .done(function (data) { renderAll(data); })
      .fail(function () {
        console.error("Cleon Payroll Dashboard: failed to load data");
      })
      .always(function () { showLoading(false); });
  }

  function renderAll(d) {
    renderKpis(d.kpis || {});
    renderNetGross(d.net_vs_gross || {});
    renderCompliance(d.compliance_status || {});
    renderTrend(d.monthly_trend || {});
    renderDepartment(d.department_distribution || []);
    renderUpcoming(d.upcoming_payments || []);
    renderCompensation(d.compensation_breakdown || []);
    renderBenefits(d.benefits_cost || []);
    renderOvertime(d.overtime_expenses || {});
    renderBands(d.salary_bands || []);
    renderTax(d.tax_deductions || []);
    renderPension(d.pension_contributions || {});
    renderComplianceKpis(d.compliance_status || {});
    renderExceptions(d.exceptions || []);
    renderAudit(d);
    renderApprovals(d.pending_approvals || {});
    renderTracker(d.approval_tracker || []);
    renderProcessing(d.processing_status || []);
    renderTurnover(d.turnover_metrics || {});

    var activePanel = $(".cpd-panel.active").attr("id");
    if (activePanel) resizeChartsIn(activePanel);
  }

  function renderKpis(k) {
    $("#kpiTotalCost").text(money(k.total_payroll_cost));
    $("#kpiEmployeeCount").text(k.employee_count != null ? k.employee_count : "--");
    $("#kpiGross").text(money(k.total_gross));
    $("#kpiAvgNet").text(money(k.avg_net_pay));
  }

  function renderNetGross(ng) {
    makeBar("chartNetGross", ["Gross", "Deductions", "Employer Contrib.", "Net"],
      [dataset("Amount",
        [ng.gross || 0, ng.deductions || 0, ng.employer_contributions || 0, ng.net || 0],
        PINK)]);
  }

  function renderCompliance(c) {
    makeDoughnut("chartCompliance",
      ["Paid", "Confirmed", "Draft / Pending"],
      [c.paid || 0, c.confirmed || 0, c.draft_or_pending || 0],
      ["#db2777", "#f472b6", "#fbcfe8"]);
  }

  function renderTrend(t) {
    makeLine("chartTrend", t.labels || [],
      [dataset("Gross", t.gross || [], "#a855f7", true),
       dataset("Net", t.net || [], "#ec4899", true),
       dataset("Deductions", t.deductions || [], "#f43f5e", false)]);
  }

  function renderDepartment(rows) {
    makeDoughnut("chartDepartment", rows.map(r => r.label), rows.map(r => r.value));
    var $tbody = $("#tblDepartment tbody").empty();
    rows.forEach(function (r) {
      $tbody.append("<tr><td>" + esc(r.label) + "</td><td class='text-end'>" + money(r.value) + "</td></tr>");
    });
  }

  function renderUpcoming(rows) {
    var $tbody = $("#tblUpcoming tbody").empty();
    if (!rows.length) { $tbody.append(emptyRow(4)); return; }
    rows.forEach(function (r) {
      $tbody.append(
        "<tr><td>" + esc(r.employee) + "</td><td>" + esc(r.date_to) + "</td>" +
        "<td>" + badge(r.state) + "</td>" +
        "<td class='text-end'>" + money(r.net_wage) + "</td></tr>");
    });
  }

  function renderCompensation(rows) {
    makeDoughnut("chartCompensation", rows.map(r => r.label), rows.map(r => r.value));
    var $tbody = $("#tblCompensation tbody").empty();
    rows.forEach(function (r) {
      $tbody.append("<tr><td>" + esc(r.label) + "</td><td class='text-end'>" + money(r.value) + "</td></tr>");
    });
  }

  function renderBenefits(rows) {
    makeBar("chartBenefits", rows.map(r => r.label),
      [dataset("Cost", rows.map(r => r.value), "#a855f7")], true);
  }

  function renderOvertime(o) {
    $("#kpiOvertime").text(money(o.total));
    makeBar("chartOvertime", o.labels || [],
      [dataset("Overtime", o.values || [], "#f43f5e")]);
  }

  function renderBands(rows) {
    makeBar("chartBands", rows.map(r => r.label),
      [dataset("Employees", rows.map(r => r.value), "#ec4899")]);
  }

  function renderTax(rows) {
    var $tbody = $("#tblTax tbody").empty();
    if (!rows.length) { $tbody.append(emptyRow(2)); return; }
    rows.forEach(function (r) {
      $tbody.append("<tr><td>" + esc(r.label) + "</td><td class='text-end'>" + money(r.value) + "</td></tr>");
    });
  }

  function renderPension(p) {
    $("#kpiPension").text(money(p.total));
  }

  function renderComplianceKpis(c) {
    $("#kpiCompliancePct").text((c.compliance_pct != null ? c.compliance_pct : 0) + "%");
    $("#kpiCompliancePending").text(c.draft_or_pending != null ? c.draft_or_pending : "--");
    $("#kpiCompliancePaid").text(c.paid != null ? c.paid : "--");
  }

  function renderExceptions(rows) {
    var $tbody = $("#tblExceptions tbody").empty();
    if (!rows.length) {
      $tbody.append("<tr><td colspan='3' class='cpd-muted'>No exceptions found for this period. 🎉</td></tr>");
      return;
    }
    rows.forEach(function (r) {
      $tbody.append("<tr><td>" + esc(r.payslip) + "</td><td>" + esc(r.employee) + "</td><td>" + esc(r.issue) + "</td></tr>");
    });
  }

  function renderAudit(d) {
    var c = d.compliance_status || {};
    var rows = [
      ["Payslips in period", c.total],
      ["Paid on time", c.paid],
      ["Awaiting confirmation", c.confirmed],
      ["Draft / pending computation", c.draft_or_pending],
      ["Exceptions flagged", (d.exceptions || []).length],
    ];
    var $tbody = $("#tblAudit tbody").empty();
    rows.forEach(function (r) {
      $tbody.append("<tr><td>" + esc(r[0]) + "</td><td class='text-end'>" + (r[1] != null ? r[1] : "--") + "</td></tr>");
    });
  }

  function renderApprovals(a) {
    var $tbody = $("#tblApprovals tbody").empty();
    var lines = a.lines || [];
    if (!lines.length) { $tbody.append(emptyRow(3)); return; }
    lines.forEach(function (r) {
      $tbody.append(
        "<tr><td>" + esc(r.employee) + "</td><td>" + esc(r.date_to) + "</td>" +
        "<td class='text-end'>" + money(r.net_wage) + "</td></tr>");
    });
  }

  function renderTracker(stages) {
    var $wrap = $("#approvalStepper").empty();
    stages.forEach(function (s, i) {
      var $step = $("<div class='cpd-step'></div>");
      $step.append(
        "<div class='cpd-step-circle'>" + s.count + "</div>" +
        "<div class='cpd-step-info'><div class='name'>" + esc(s.stage) + "</div>" +
        "<div class='count'>payslips</div></div>");
      $wrap.append($step);
      if (i < stages.length - 1) $wrap.append("<div class='cpd-step-line'></div>");
    });
  }

  function renderProcessing(runs) {
    var $wrap = $("#processingTimeline").empty();
    if (!runs.length) {
      $wrap.append("<div class='cpd-muted'>No payroll runs found yet.</div>");
      return;
    }
    runs.forEach(function (r) {
      $wrap.append(
        "<div class='cpd-timeline-item'>" +
          "<div class='cpd-timeline-dot'></div>" +
          "<div class='cpd-timeline-body'>" +
            "<div class='cpd-timeline-title'>" + esc(r.name) + " " + badge(r.state) + "</div>" +
            "<div class='cpd-timeline-meta'>" + esc(r.date_start) + " → " + esc(r.date_end) +
            " · " + r.slip_count + " payslip(s)</div>" +
          "</div>" +
        "</div>");
    });
  }

  function renderTurnover(t) {
    $("#kpiActiveEmp").text(t.active_employees != null ? t.active_employees : "--");
    $("#kpiDepartedEmp").text(t.departed_employees != null ? t.departed_employees : "--");
    $("#kpiTurnoverRate").text((t.turnover_rate != null ? t.turnover_rate : 0) + "%");
  }

  /* ---------------- Small helpers ---------------- */
  function esc(s) {
    return $("<div>").text(s == null ? "" : s).html();
  }
  function emptyRow(colspan) {
    return "<tr><td colspan='" + colspan + "' class='cpd-muted'>No data for this period.</td></tr>";
  }
  function badge(state) {
    var labels = { draft: "Draft", computed: "Computed", confirm: "Confirmed", paid: "Paid" };
    return "<span class='cpd-badge " + (state || "") + "'>" + (labels[state] || state || "") + "</span>";
  }

  /* ---------------- Navigation ---------------- */
  function initNav() {
    $(".cpd-nav-link").on("click", function (e) {
      e.preventDefault();
      var $this = $(this);
      $(".cpd-nav-link").removeClass("active");
      $this.addClass("active");
      var panel = $this.data("panel");
      $(".cpd-panel").removeClass("active");
      $("#" + panel).addClass("active");
      $("#cpdPanelTitle").text($this.find("span").text());
      closeSidebar();
      resizeChartsIn(panel);
    });
  }

  function resizeChartsIn(panelId) {
    // Charts rendered while their panel was display:none can end up
    // mis-sized (0-width) until Chart.js is explicitly told to
    // recompute its layout now that the panel is visible.
    var $panel = $("#" + panelId);
    $panel.find("canvas").each(function () {
      var chart = charts[this.id];
      if (chart) {
        requestAnimationFrame(function () { chart.resize(); });
      }
    });
  }

  function openSidebar() { $("#cpdSidebar").addClass("open"); $("#cpdBackdrop").addClass("show"); }
  function closeSidebar() { $("#cpdSidebar").removeClass("open"); $("#cpdBackdrop").removeClass("show"); }
  function openUrl(link){
    window.location.href = link
  }

  function openApps() {
      if (!window.HomeMenuOverlay) {
          console.error("HomeMenuOverlay is not loadedxx.");
          return;
      }

      if (typeof window.HomeMenuOverlay.open !== "function") {
          console.error(
              "HomeMenuOverlay exists, but open() is not available.",
              window.HomeMenuOverlay
          );
          return;
      }

      window.HomeMenuOverlay.open();
  }

  $("#cpdApps").on("click", openApps);

  function initOffcanvas() {
    $("#cpdSidebarOpen").on("click", openSidebar);
    // $("#cpdSidebarOpen").on("click", openUrl('/app/payroll'));
    $("#cpdSidebarClose").on("click", closeSidebar);
    $("#cpdBackdrop").on("click", closeSidebar);
  }

  // $("#cpdApps").on("click", openApps());
  

  function initFilterAccordion() {
    $("#cpdFilterToggle").on("click", function () {
      $("#cpdFilters").toggleClass("open");
    });
  }

  function initFilterActions() {
    $("#fApply").on("click", function () {
      state.location_id = $("#fLocation").val();
      state.department_id = $("#fDepartment").val();
      state.deduction_code = $("#fDeduction").val();
      state.structure_id = $("#fStructure").val();
      state.date_from = $("#fDateFrom").val();
      state.date_to = $("#fDateTo").val();
      loadData();
    });
    $("#fReset").on("click", function () {
      $("#fLocation, #fDepartment, #fDeduction, #fStructure").val("");
      $("#fDateFrom, #fDateTo").val("");
      state = { location_id: "", department_id: "", deduction_code: "", structure_id: "", date_from: "", date_to: "" };
      loadData();
    });
    $("#cpdRefreshBtn").on("click", loadData);
  }

  function initUser() {
    var name = "U";
    try {
      // If ever needed, session info could be fetched here via /web/session/get_session_info
      name = (document.title || "U").charAt(0).toUpperCase();
    } catch (e) { /* noop */ }
    $("#cpdUserAvatar").text(name);
  }

  $(function () {
    initNav();
    initOffcanvas();
    initFilterAccordion();
    initFilterActions();
    initUser();
    loadFilters();
    loadData();
  });

})(jQuery);
