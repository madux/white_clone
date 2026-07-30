/**
 * Home Menu Overlay - v6.0
 * Odoo 17 Community Edition
 *
 * Consumes the grouped payload from /home_menu/get_apps:
 *   { categories: [ { name, color, app_items: [...] }, ... ],
 *     total_modules, total_features }
 * — the exact same shape /maacherp/landing renders.
 *
 * Also self-injects the landing stylesheet, since this overlay can be
 * opened from arbitrary Odoo backend pages that never load it.
 */
(function ($) {
    'use strict';

    var LANDING_CSS_PATH = '/cleon_license/static/src/css/landing.css';

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                             */
    /* ------------------------------------------------------------------ */

    /* Icon map: partial name match → FA class (fallback when no web_icon) */
    var ICON_MAP = {
        'discuss':      'fa fa-comments',
        'sale':         'fa fa-shopping-cart',
        'dashboard':    'fa fa-chart-bar',
        'inventory':    'fa fa-cubes',
        'purchase':     'fa fa-shopping-basket',
        'account':      'fa fa-calculator',
        'crm':          'fa fa-handshake-o',
        'project':      'fa fa-tasks',
        'manufactur':   'fa fa-industry',
        'website':      'fa fa-globe',
        'employee':     'fa fa-users',
        'leave':        'fa fa-calendar-check-o',
        'payroll':      'fa fa-money',
        'vehicle':      'fa fa-car',
        'fleet':        'fa fa-car',
        'setting':      'fa fa-cog',
        'email':        'fa fa-envelope',
        'helpdesk':     'fa fa-life-ring',
        'event':        'fa fa-calendar',
        'survey':       'fa fa-wpforms',
        'timeshee':     'fa fa-clock-o',
        'expense':      'fa fa-receipt',
        'lunch':        'fa fa-cutlery',
        'sign':         'fa fa-pen-nib',
        'emr':          'fa fa-heartbeat',
        'health':       'fa fa-heartbeat',
        'pharmacy':     'fa fa-medkit',
        'hospital':     'fa fa-hospital-o',
        'patient':      'fa fa-user-md',
        'appointment':  'fa fa-calendar-plus-o',
        'lab':          'fa fa-flask',
        'procure':      'fa fa-truck',
        'stock':        'fa fa-archive',
        'mrp':          'fa fa-cogs',
        'quality':      'fa fa-check-circle',
        'maintenance':  'fa fa-wrench',
    };

    function iconFor(name) {
        var lower = (name || '').toLowerCase();
        for (var key in ICON_MAP) {
            if (lower.indexOf(key) !== -1) return ICON_MAP[key];
        }
        return 'fa fa-th-large';
    }

    function hexToRgba(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function ensureStylesheet() {
        var already = document.querySelector(
            'link[href*="' + LANDING_CSS_PATH + '"]'
        );
        if (!already) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = LANDING_CSS_PATH;
            document.head.appendChild(link);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Core overlay object                                                 */
    /* ------------------------------------------------------------------ */
    var HMO = {
        ready:         false,
        visible:       false,
        categories:    [],   // raw payload from the server, as-is
        totalModules:  0,
        totalFeatures: 0,

        /* ---------- build DOM (matches hc-* template structure) ---------- */
        build: function () {
            if ($('#hc-launcher').length) return;

            ensureStylesheet();

            var html = [
                '<div id="hmoOverlay" class="hmo-overlay">',
                '  <div class="hmo-backdrop"></div>',
                '  <div id="hc-launcher" class="hmo-content">',

                /* Page header */
                '    <header class="hc-page-header">',
                '      <a href="#" class="hc-back-btn" id="hc-back-btn">',
                '        <i class="fa fa-arrow-left"></i> Back',
                '      </a>',
                '      <div class="hc-page-title-row">',
                '        <span class="hc-page-icon"><i class="fa fa-magic"></i></span>',
                '        <h1 class="hc-page-title">Explore Modules</h1>',
                '      </div>',
                '      <p class="hc-page-subtitle">',
                '        Discover and explore all the powerful modules in your CleonHR platform.',
                '        Click on any module to dive deep with a guided tour.',
                '      </p>',
                '      <div class="hc-search-wrap">',
                '        <i class="fa fa-search hc-search-icon"></i>',
                '        <input type="search" id="hc-app-search" class="hc-search-input"',
                '               placeholder="Search modules…" autocomplete="off"/>',
                '      </div>',
                '    </header>',

                /* Stat cards */
                '    <section class="hc-stats-row">',
                '      <div class="hc-stat-card hc-stat-pink">',
                '        <span class="hc-stat-number" id="hc-stat-modules">0</span>',
                '        <span class="hc-stat-label">Total Modules</span>',
                '      </div>',
                '      <div class="hc-stat-card hc-stat-purple">',
                '        <span class="hc-stat-number" id="hc-stat-features">0</span>',
                '        <span class="hc-stat-label">Features</span>',
                '      </div>',
                '      <div class="hc-stat-card hc-stat-blue">',
                '        <span class="hc-stat-number">All-in-One</span>',
                '        <span class="hc-stat-label">HR Platform</span>',
                '      </div>',
                '    </section>',

                /* App sections (filled in by _render) */
                '    <main id="hc-app-sections">',
                '      <div class="hmo-loading" id="hmoLoading">',
                '        <div class="hmo-spinner"></div>',
                '        <span>Loading applications…</span>',
                '      </div>',
                '      <div class="hc-no-results d-none" id="hc-no-results">',
                '        <i class="fa fa-search-minus"></i>',
                '        <p>No modules found</p>',
                '      </div>',
                '    </main>',

                '  </div>', // /hc-launcher
                '</div>'    // /hmoOverlay
            ].join('');

            $('body').append(html);
            this._bindUI();
        },

        /* ---------- event wiring ---------- */
        _bindUI: function () {
            var self = this;

            $(document).on('click', '.hmo-backdrop', function () { self.close(); });
            $(document).on('click', '#hc-back-btn', function (e) {
                e.preventDefault();
                self.close();
            });

            $(document).on('keydown.hmo', function (e) {
                if (e.key === 'Escape' && self.visible) self.close();
            });

            $(document).on('input.hmo', '#hc-app-search', function () {
                self._applyFilter($(this).val().trim().toLowerCase());
            });

            $(document).on('click.hmo', '.hc-app-card', function (e) {
                e.preventDefault();
                var href = $(this).attr('href');
                if (href && href !== '#') {
                    self.close();
                    setTimeout(function () {
                        window.location.href = href;
                    }, 200);
                }
            });
        },

        /* ---------- load apps via RPC ---------- */
        load: function () {
            var self = this;

            $.ajax({
                url: '/home_menu/get_apps',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} }),
                success: function (response) {
                    var result = response && response.result;
                    if (result && result.categories && result.categories.length) {
                        self.categories    = result.categories;
                        self.totalModules  = result.total_modules || 0;
                        self.totalFeatures = result.total_features || 0;
                    } else {
                        self._useFallback();
                    }
                    self._render();
                },
                error: function () {
                    self._useFallback();
                    self._render();
                }
            });
        },

        /* Fallback sample data if RPC fails or returns nothing */
        _useFallback: function () {
            var sample = [
                { id: 0, name: 'Discuss',    description: 'Team Communication' },
                { id: 0, name: 'Sales',      description: 'Sales Management' },
                { id: 0, name: 'Inventory',  description: 'Warehouse Management' },
                { id: 0, name: 'Accounting', description: 'Financial Management' },
                { id: 0, name: 'Employees',  description: 'HR Management' },
                { id: 0, name: 'Settings',   description: 'System Settings' },
            ].map(function (a) {
                return { id: a.id, name: a.name, description: a.description, icon: false, url: '#', children: [] };
            });

            this.categories = [{ name: 'Apps', color: '#8B5CF6', app_items: sample }];
            this.totalModules = sample.length;
            this.totalFeatures = sample.length;
        },

        /* ---------- render category sections + stat cards ---------- */
        _render: function () {
            $('#hmoLoading').remove();
            var $sections = $('#hc-app-sections');
            $sections.find('.hc-category-section').remove();

            var frag = document.createDocumentFragment();

            this.categories.forEach(function (cat) {
                var $section = $(
                    '<section class="hc-category-section" data-category="' +
                    cat.name.toLowerCase() + '">' +
                    '  <h2 class="hc-category-title">' + $('<span>').text(cat.name).html() + '</h2>' +
                    '  <div class="hc-app-grid"></div>' +
                    '</section>'
                );
                var $grid = $section.find('.hc-app-grid');

                cat.app_items.forEach(function (app) {
                    var iconHtml = app.icon
                        ? '<img src="' + app.icon + '" alt="' + app.name + '" class="hc-app-icon" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"/>'
                        : '';
                    var features = (app.children && app.children.length) ? app.children.length : 1;

                    var $card = $(
                        '<a href="' + (app.url || '#') + '" class="hc-app-card" ' +
                        'data-name="' + app.name.toLowerCase() + '" ' +
                        'data-desc="' + (app.description || '').toLowerCase() + '" ' +
                        'data-features="' + features + '" ' +
                        'data-id="' + app.id + '">' +
                        '  <div class="hc-app-icon-wrap" style="background-color:' + hexToRgba(cat.color, 0.1) + ';">' +
                             iconHtml +
                        '    <div class="hc-app-icon-fallback" style="color:' + cat.color + ';' +
                             (app.icon ? '' : 'display:flex;') + '">' +
                        '      <i class="' + iconFor(app.name) + '"></i>' +
                        '    </div>' +
                        '  </div>' +
                        '  <div class="hc-app-info">' +
                        '    <span class="hc-app-name">' + $('<span>').text(app.name).html() + '</span>' +
                        '    <span class="hc-app-desc">' + $('<span>').text(app.description || '').html() + '</span>' +
                        '    <span class="hc-app-explore">Explore Module <i class="fa fa-arrow-right"></i></span>' +
                        '  </div>' +
                        '</a>'
                    );

                    $grid.append($card);
                });

                frag.appendChild($section[0]);
            });

            $sections.find('#hc-no-results').before(frag);
            this._recomputeStats();
        },

        /* ---------- search filter ---------- */
        _applyFilter: function (term) {
            var anyVisible = false;
            var $sections = $('#hc-app-sections .hc-category-section');

            $sections.each(function () {
                var $section = $(this);
                var sectionHasMatch = false;

                $section.find('.hc-app-card').each(function () {
                    var $card = $(this);
                    var name = $card.data('name') || '';
                    var desc = $card.data('desc') || '';
                    var matches = !term || name.indexOf(term) !== -1 || desc.indexOf(term) !== -1;

                    $card.toggleClass('d-none', !matches);
                    if (matches) {
                        sectionHasMatch = true;
                        anyVisible = true;
                    }
                });

                $section.toggleClass('d-none', !sectionHasMatch);
            });

            $('#hc-no-results').toggleClass('d-none', anyVisible);
            this._recomputeStats();
        },

        /* ---------- recompute stat cards from visible cards ---------- */
        _recomputeStats: function () {
            var $visible = $('#hc-app-sections .hc-app-card:not(.d-none)');
            var moduleCount = $visible.length;
            var featureCount = 0;

            $visible.each(function () {
                var n = parseInt($(this).data('features'), 10);
                featureCount += isNaN(n) ? 1 : n;
            });

            $('#hc-stat-modules').text(moduleCount);
            $('#hc-stat-features').text(featureCount);
        },

        /* ---------- open / close ---------- */
        open: function () {
            var self = this;
            this.visible = true;

            this.build();
            $('#hmoOverlay').addClass('hmo-active');
            $('body').css('overflow', 'hidden');
            $('#hc-app-search').val('');

            if (this.categories.length === 0) {
                this.load();
            } else {
                this._render();
            }

            setTimeout(function () { $('#hc-app-search').focus(); }, 350);
        },

        close: function () {
            this.visible = false;
            $('#hmoOverlay').removeClass('hmo-active');
            $('body').css('overflow', '');
        },

        /* ---------------------------------------------------------------- */
        /*  Intercept the Odoo Home Menu button                              */
        /* ---------------------------------------------------------------- */
        hijack: function () {
            var self = this;

            document.addEventListener('click', function (e) {
                var btn = e.target.closest('button[title="Home Menu"], a[title="Home Menu"]');
                if (!btn) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                self.open();
            }, true /* capture */);

            document.addEventListener('keydown', function (e) {
                if (e.key === 'h' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    var tag = (document.activeElement || {}).tagName;
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                    e.stopImmediatePropagation();
                    self.open();
                }
            }, true);
        }
    };

    /* ------------------------------------------------------------------ */
    /*  Bootstrap                                                           */
    /* ------------------------------------------------------------------ */
    $(document).ready(function () {
        HMO.build();
        HMO.hijack();

        if (localStorage.getItem('erp-open-home-menu') === '1') {
            localStorage.removeItem('erp-open-home-menu');
            setTimeout(function () { HMO.open(); }, 800);
        }

        setTimeout(function () { HMO.load(); }, 1500);
    });

    window.HomeMenuOverlay = HMO;

})(jQuery);