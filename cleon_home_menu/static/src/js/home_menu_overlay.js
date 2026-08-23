/**
 * CleonHR persistent application launcher — Odoo 17 Community.
 *
 * The launcher is deliberately framework-independent because it lives beside
 * every backend client action, including custom OWL screens and standard Odoo
 * views. Applications still come from the original /home_menu/get_apps route.
 */
(function ($) {
    "use strict";

    var ICONS = {
        home: "fa-home", employee: "fa-briefcase", workforce: "fa-user-circle-o",
        staff: "fa-users", leave: "fa-calendar", calendar: "fa-calendar-o",
        report: "fa-file-text-o", config: "fa-cog", setting: "fa-cog",
        workflow: "fa-sitemap", recruitment: "fa-user-plus", time: "fa-clock-o",
        insurance: "fa-heartbeat", document: "fa-file-text", asset: "fa-cubes",
        payroll: "fa-money", compensation: "fa-money", gallery: "fa-picture-o"
    };

    function iconFor(name) {
        var value = (name || "").toLowerCase();
        for (var key in ICONS) if (value.indexOf(key) !== -1) return ICONS[key];
        return "fa-th-large";
    }

    function escapeHtml(value) { return $("<span>").text(value || "").html(); }
    function escapeAttr(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;")
            .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
    }

    function isNavbarAppsButton(target) {
        if (!target || !target.closest) return false;
        return Boolean(
            target.closest(".o_navbar_apps_menu .dropdown-toggle") ||
            target.closest('button[title="Home Menu"],a[title="Home Menu"]') ||
            target.closest(".o_navbar_apps_menu .oi-apps")
        );
    }

    var Launcher = {
        apps: [],
        loading: false,
        visible: false,

        build: function () {
            if (!document.getElementById("cleonAppRail")) {
                $("body").append([
                    '<aside id="cleonAppRail" class="cleon-app-rail" aria-label="CleonHR applications">',
                    '  <div class="cleon-rail-loading"><i class="fa fa-spinner fa-spin"></i></div>',
                    '  <nav class="cleon-rail-nav"></nav>',
                    '</aside>'
                ].join(""));
            }
            if (!document.getElementById("hmoOverlay")) {
                $("body").append([
                    '<div id="hmoOverlay" class="hmo-overlay" aria-hidden="true">',
                    '  <div class="hmo-backdrop"></div>',
                    '  <section class="hmo-content" role="dialog" aria-modal="true" aria-labelledby="hmoTitle">',
                    '    <header class="hmo-header">',
                    '      <button type="button" class="hmo-back-btn" id="hmoBackBtn"><i class="fa fa-arrow-left"></i> Back</button>',
                    '      <h2 class="hmo-title" id="hmoTitle">Explore CleonHR Apps</h2>',
                    '      <label class="hmo-search-wrap" aria-label="Search applications">',
                    '        <i class="fa fa-search"></i>',
                    '        <input type="search" class="hmo-search" id="hmoSearch" placeholder="Search applications…" autocomplete="off"/>',
                    '      </label>',
                    '    </header>',
                    '    <div class="hmo-grid-wrap"><div class="hmo-grid" id="hmoGrid">',
                    '      <div class="hmo-loading"><div class="hmo-spinner"></div><span>Loading applications…</span></div>',
                    '    </div></div>',
                    '  </section>',
                    '</div>'
                ].join(""));
            }
            document.documentElement.classList.add("has-cleon-app-rail");
        },

        load: function () {
            if (this.loading) return;
            var self = this;
            this.loading = true;
            $.ajax({
                url: "/home_menu/get_apps", type: "POST", contentType: "application/json",
                data: JSON.stringify({
                    jsonrpc: "2.0", method: "call",
                    params: {employee_mode: localStorage.getItem("cleonhr_interface_mode") === "employee"},
                }),
                success: function (response) {
                    var categories = response && response.result && response.result.categories || [];
                    self.apps = [];
                    categories.forEach(function (category) {
                        (category.app_items || []).forEach(function (app) {
                            app.category = category.name;
                            app.color = category.color;
                            self.apps.push(app);
                        });
                    });
                    self.render();
                    self.renderOverlay();
                },
                error: function () {
                    $("#cleonAppRail .cleon-rail-loading").html('<i class="fa fa-exclamation-circle"></i><small>Apps unavailable</small>');
                },
                complete: function () {
                    self.loading = false;
                    if (self.visible) self.renderOverlay($("#hmoSearch").val());
                }
            });
        },

        render: function () {
            var activeId = localStorage.getItem("cleonhr_active_app") || "";
            var html = this.apps.map(function (app) {
                var configuredIcon = app.icon_class || ("fa " + iconFor(app.name));
                var icon = app.icon
                    ? '<img src="' + escapeAttr(app.icon) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';"/><i class="' + escapeAttr(configuredIcon) + ' cleon-rail-fallback"></i>'
                    : '<i class="' + escapeAttr(configuredIcon) + '"></i>';
                return '<a class="cleon-rail-app ' + (String(app.id) === activeId ? "active" : "") + '" href="' + escapeAttr(app.url || "#") + '" data-menu-id="' + escapeAttr(app.id) + '" title="' + escapeAttr(app.name) + '">' +
                    '<span class="cleon-rail-icon" style="--app-color:' + escapeAttr(app.icon_color || "#64748B") + '">' + icon + '</span>' +
                    '<span class="cleon-rail-label">' + escapeHtml(app.name) + '</span></a>';
            }).join("");
            $("#cleonAppRail .cleon-rail-loading").remove();
            $("#cleonAppRail .cleon-rail-nav").html(html || '<div class="cleon-rail-empty">No CleonHR apps</div>');
        },

        renderOverlay: function (query) {
            var normalizedQuery = (query || "").trim().toLowerCase();
            var apps = this.apps.filter(function (app) {
                if (!normalizedQuery) return true;
                return [app.name, app.description, app.category].some(function (value) {
                    return (value || "").toLowerCase().indexOf(normalizedQuery) !== -1;
                });
            });
            if (!apps.length) {
                var message = this.loading ?
                    '<div class="hmo-loading"><div class="hmo-spinner"></div><span>Loading applications…</span></div>' :
                    '<div class="hmo-empty"><i class="fa fa-search"></i><h3>No applications found</h3><p>Try a different search term.</p></div>';
                $("#hmoGrid").html(message);
                return;
            }
            var html = apps.map(function (app) {
                var configuredIcon = app.icon_class || ("fa " + iconFor(app.name));
                var icon = app.icon
                    ? '<img src="' + escapeAttr(app.icon) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';"/><i class="' + escapeAttr(configuredIcon) + ' cleon-hmo-fallback"></i>'
                    : '<i class="' + escapeAttr(configuredIcon) + '"></i>';
                return '<a class="hmo-card" href="' + escapeAttr(app.url || "#") + '" data-menu-id="' + escapeAttr(app.id) + '">' +
                    '<span class="hmo-icon" style="background:' + escapeAttr(app.icon_color || app.color || "#64748B") + '">' + icon + '</span>' +
                    '<span class="hmo-info"><span class="hmo-category">' + escapeHtml(app.category || "CleonHR") + '</span>' +
                    '<span class="hmo-app-name">' + escapeHtml(app.name) + '</span>' +
                    '<span class="hmo-app-desc">' + escapeHtml(app.description || "Open this application") + '</span></span>' +
                    '<i class="fa fa-arrow-right hmo-card-arrow"></i></a>';
            }).join("");
            $("#hmoGrid").html(html);
        },

        open: function () {
            this.build();
            this.visible = true;
            $("#hmoOverlay").addClass("hmo-active").attr("aria-hidden", "false");
            $("body").addClass("hmo-open");
            $("#hmoSearch").val("");
            this.renderOverlay();
            if (!this.apps.length) this.load();
            window.setTimeout(function () { $("#hmoSearch").trigger("focus"); }, 100);
        },

        close: function () {
            this.visible = false;
            $("#hmoOverlay").removeClass("hmo-active").attr("aria-hidden", "true");
            $("body").removeClass("hmo-open");
            document.querySelector('.o_navbar_apps_menu [title="Home Menu"], .o_navbar_apps_menu .dropdown-toggle')?.focus();
        },

        bind: function () {
            var self = this;
            $(document).on("click.cleonRail", ".cleon-rail-app", function () {
                localStorage.setItem("cleonhr_active_app", String($(this).data("menu-id")));
                $(".cleon-rail-app").removeClass("active"); $(this).addClass("active");
            });

            $(document).on("click.cleonLauncher", ".hmo-card", function () {
                localStorage.setItem("cleonhr_active_app", String($(this).data("menu-id")));
                self.close();
            });
            $(document).on("click.cleonLauncher", "#hmoBackBtn,.hmo-backdrop", function () { self.close(); });
            $(document).on("input.cleonLauncher", "#hmoSearch", function () { self.renderOverlay(this.value); });

            /* Keep the application launcher inside the authenticated backend. */
            document.addEventListener("click", function (event) {
                if (!isNavbarAppsButton(event.target)) return;
                event.preventDefault(); event.stopImmediatePropagation();
                self.open();
            }, true);

            document.addEventListener("keydown", function (event) {
                if (event.key === "Escape" && self.visible) {
                    event.preventDefault();
                    self.close();
                    return;
                }
                if (event.key.toLowerCase() !== "h" || event.ctrlKey || event.altKey || event.metaKey) return;
                if (["INPUT", "TEXTAREA", "SELECT"].includes((document.activeElement || {}).tagName)) return;
                event.preventDefault();
                self.open();
            }, true);

            window.CleonAppLauncher = self;
        }
    };

    $(document).ready(function () { Launcher.build(); Launcher.bind(); Launcher.load(); });
})(jQuery);
