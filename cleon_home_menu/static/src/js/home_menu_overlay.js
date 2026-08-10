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

    var Launcher = {
        apps: [],

        build: function () {
            if (document.getElementById("cleonAppRail")) return;
            $("body").append([
                '<aside id="cleonAppRail" class="cleon-app-rail" aria-label="CleonHR applications">',
                '  <div class="cleon-rail-loading"><i class="fa fa-spinner fa-spin"></i></div>',
                '  <nav class="cleon-rail-nav"></nav>',
                '</aside>'
            ].join(""));
            document.documentElement.classList.add("has-cleon-app-rail");
        },

        load: function () {
            var self = this;
            $.ajax({
                url: "/home_menu/get_apps", type: "POST", contentType: "application/json",
                data: JSON.stringify({ jsonrpc: "2.0", method: "call", params: {} }),
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
                },
                error: function () {
                    $("#cleonAppRail .cleon-rail-loading").html('<i class="fa fa-exclamation-circle"></i><small>Apps unavailable</small>');
                }
            });
        },

        render: function () {
            var activeId = localStorage.getItem("cleonhr_active_app") || "";
            var html = this.apps.map(function (app) {
                var configuredIcon = app.icon_class || ("fa " + iconFor(app.name));
                var icon = app.icon
                    ? '<img src="' + app.icon + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';"/><i class="' + configuredIcon + ' cleon-rail-fallback"></i>'
                    : '<i class="' + configuredIcon + '"></i>';
                return '<a class="cleon-rail-app ' + (String(app.id) === activeId ? "active" : "") + '" href="' + (app.url || "#") + '" data-menu-id="' + app.id + '" title="' + escapeHtml(app.name) + '">' +
                    '<span class="cleon-rail-icon" style="--app-color:' + (app.icon_color || "#64748B") + '">' + icon + '</span>' +
                    '<span class="cleon-rail-label">' + escapeHtml(app.name) + '</span></a>';
            }).join("");
            $("#cleonAppRail .cleon-rail-loading").remove();
            $("#cleonAppRail .cleon-rail-nav").html(html || '<div class="cleon-rail-empty">No CleonHR apps</div>');
        },

        bind: function () {
            var self = this;
            $(document).on("click.cleonRail", ".cleon-rail-app", function () {
                localStorage.setItem("cleonhr_active_app", String($(this).data("menu-id")));
                $(".cleon-rail-app").removeClass("active"); $(this).addClass("active");
            });

            /* Keep Odoo's familiar grid button useful without opening a second launcher. */
            document.addEventListener("click", function (event) {
                var button = event.target.closest('button[title="Home Menu"],a[title="Home Menu"]');
                if (!button) return;
                event.preventDefault(); event.stopImmediatePropagation();
                document.getElementById("cleonAppRail")?.scrollTo({ top: 0, behavior: "smooth" });
                document.querySelector(".cleon-rail-app")?.focus();
            }, true);

            document.addEventListener("keydown", function (event) {
                if (event.key.toLowerCase() !== "h" || event.ctrlKey || event.altKey || event.metaKey) return;
                if (["INPUT", "TEXTAREA", "SELECT"].includes((document.activeElement || {}).tagName)) return;
                event.preventDefault(); document.querySelector(".cleon-rail-app")?.focus();
            }, true);

            window.CleonAppLauncher = self;
        }
    };

    $(document).ready(function () { Launcher.build(); Launcher.bind(); Launcher.load(); });
})(jQuery);
