/**
 * CleonHR persistent application launcher — Odoo 17 Community.
 *
 * The launcher is deliberately framework-independent because it lives beside
 * every backend client action, including custom OWL screens and standard Odoo
 * views. Applications still come from the original /home_menu/get_apps route.
 */
(function ($) {
    "use strict";

    var LANDING_CSS_PATH = "/cleon_license/static/src/css/landing.css";

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

    function preserveDebugMode(url) {
        if (!url || !window.odoo || !window.odoo.debug) return url;
        try {
            var parsed = new URL(url, window.location.origin);
            if (parsed.origin !== window.location.origin || parsed.pathname !== "/web") {
                return url;
            }
            parsed.searchParams.set("debug", window.odoo.debug);
            return parsed.pathname + parsed.search + parsed.hash;
        } catch (_error) {
            return url;
        }
    }

    function ensureLauncherStyles() {
        if (document.querySelector('link[href*="' + LANDING_CSS_PATH + '"]')) return;
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = LANDING_CSS_PATH;
        document.head.appendChild(link);
    }

    function colorWithAlpha(color, alpha) {
        var match = /^#([0-9a-f]{6})$/i.exec(color || "");
        if (!match) return "rgba(236,72,153," + alpha + ")";
        var value = match[1];
        return "rgba(" + parseInt(value.slice(0, 2), 16) + "," +
            parseInt(value.slice(2, 4), 16) + "," +
            parseInt(value.slice(4, 6), 16) + "," + alpha + ")";
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
        categories: [],
        totalModules: 0,
        totalFeatures: 0,
        developerSettingsEnabled: false,
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
                ensureLauncherStyles();
                $("body").append([
                    '<div id="hmoOverlay" class="hmo-overlay" aria-hidden="true">',
                    '  <div class="hmo-backdrop"></div>',
                    '  <section id="hc-launcher" class="hmo-content" role="dialog" aria-modal="true" aria-labelledby="hmoTitle">',
                    '    <header class="hc-page-header">',
                    '      <button type="button" class="hc-back-btn" id="hmoBackBtn"><i class="fa fa-arrow-left"></i> Back</button>',
                    '      <div class="hc-page-title-row">',
                    '        <span class="hc-page-icon"><i class="fa fa-magic"></i></span>',
                    '        <h1 class="hc-page-title" id="hmoTitle">Explore Modules</h1>',
                    '      </div>',
                    '      <p class="hc-page-subtitle">Discover the modules available in your CleonHR workspace. Select a module to continue.</p>',
                    '      <label class="hc-search-wrap" aria-label="Search modules">',
                    '        <i class="fa fa-search hc-search-icon"></i>',
                    '        <input type="search" class="hc-search-input" id="hmoSearch" placeholder="Search modules…" autocomplete="off"/>',
                    '      </label>',
                    '    </header>',
                    '    <section class="hc-stats-row">',
                    '      <div class="hc-stat-card hc-stat-pink"><span class="hc-stat-number" id="hcStatModules">0</span><span class="hc-stat-label">Total Modules</span></div>',
                    '      <div class="hc-stat-card hc-stat-purple"><span class="hc-stat-number" id="hcStatFeatures">0</span><span class="hc-stat-label">Features</span></div>',
                    '      <div class="hc-stat-card hc-stat-blue"><span class="hc-stat-number">All-in-One</span><span class="hc-stat-label">HR Platform</span></div>',
                    '    </section>',
                    '    <main id="hmoGrid">',
                    '      <div class="hmo-loading"><div class="hmo-spinner"></div><span>Loading applications…</span></div>',
                    '    </main>',
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
                    params: {
                        debug_mode: Boolean(window.odoo && window.odoo.debug),
                    },
                }),
                success: function (response) {
                    var result = response && response.result || {};
                    var categories = result.categories || [];
                    self.categories = categories;
                    self.totalModules = result.total_modules || 0;
                    self.totalFeatures = result.total_features || 0;
                    self.developerSettingsEnabled = Boolean(result.show_developer_settings);
                    document.documentElement.classList.toggle(
                        "cleon-developer-tools-enabled",
                        self.developerSettingsEnabled
                    );
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
                    $("#hmoGrid").html('<div class="hc-no-results"><i class="fa fa-exclamation-circle"></i><p>Applications could not be loaded.</p></div>');
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
                var appUrl = preserveDebugMode(app.url || "#");
                var icon = app.icon
                    ? '<img src="' + escapeAttr(app.icon) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';"/><i class="' + escapeAttr(configuredIcon) + ' cleon-rail-fallback"></i>'
                    : '<i class="' + escapeAttr(configuredIcon) + '"></i>';
                return '<a class="cleon-rail-app ' + (String(app.id) === activeId ? "active" : "") + '" href="' + escapeAttr(appUrl) + '" data-menu-id="' + escapeAttr(app.id) + '" title="' + escapeAttr(app.name) + '">' +
                    '<span class="cleon-rail-icon" style="--app-color:' + escapeAttr(app.icon_color || "#64748B") + '">' + icon + '</span>' +
                    '<span class="cleon-rail-label">' + escapeHtml(app.name) + '</span></a>';
            }).join("");
            $("#cleonAppRail .cleon-rail-loading").remove();
            $("#cleonAppRail .cleon-rail-nav").html(html || '<div class="cleon-rail-empty">No CleonHR apps</div>');
        },

        renderOverlay: function (query) {
            var normalizedQuery = (query || "").trim().toLowerCase();
            var moduleCount = 0;
            var featureCount = 0;
            var sections = this.categories.map(function (category) {
                var apps = (category.app_items || []).filter(function (app) {
                    if (!normalizedQuery) return true;
                    return [app.name, app.description, category.name].some(function (value) {
                        return (value || "").toLowerCase().indexOf(normalizedQuery) !== -1;
                    });
                });
                if (!apps.length) return "";
                moduleCount += apps.length;
                var cards = apps.map(function (app) {
                    var features = app.children && app.children.length ? app.children.length : 1;
                    featureCount += features;
                    var configuredIcon = app.icon_class || ("fa " + iconFor(app.name));
                    var appUrl = preserveDebugMode(app.url || "#");
                    var icon = app.icon
                        ? '<img src="' + escapeAttr(app.icon) + '" alt="" class="hc-app-icon" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"/><span class="hc-app-icon-fallback" style="color:' + escapeAttr(app.icon_color || category.color || "#EC4899") + '"><i class="' + escapeAttr(configuredIcon) + '"></i></span>'
                        : '<span class="hc-app-icon-fallback" style="display:flex;color:' + escapeAttr(app.icon_color || category.color || "#EC4899") + '"><i class="' + escapeAttr(configuredIcon) + '"></i></span>';
                    return '<a class="hc-app-card" href="' + escapeAttr(appUrl) + '" data-menu-id="' + escapeAttr(app.id) + '">' +
                        '<span class="hc-app-icon-wrap" style="background-color:' + colorWithAlpha(app.icon_color || category.color, 0.1) + '">' + icon + '</span>' +
                        '<span class="hc-app-info"><span class="hc-app-name">' + escapeHtml(app.name) + '</span>' +
                        '<span class="hc-app-desc">' + escapeHtml(app.description || "Open this module") + '</span>' +
                        '<span class="hc-app-explore">Explore Module <i class="fa fa-arrow-right"></i></span></span></a>';
                }).join("");
                return '<section class="hc-category-section"><h2 class="hc-category-title">' + escapeHtml(category.name) + '</h2><div class="hc-app-grid">' + cards + '</div></section>';
            }).join("");
            if (!sections) {
                var message = this.loading ?
                    '<div class="hmo-loading"><div class="hmo-spinner"></div><span>Loading applications…</span></div>' :
                    '<div class="hc-no-results"><i class="fa fa-search-minus"></i><p>No modules found</p></div>';
                $("#hmoGrid").html(message);
                $("#hcStatModules,#hcStatFeatures").text("0");
                return;
            }
            $("#hmoGrid").html(sections);
            $("#hcStatModules").text(moduleCount);
            $("#hcStatFeatures").text(featureCount);
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

            $(document).on("click.cleonLauncher", ".hc-app-card", function () {
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
