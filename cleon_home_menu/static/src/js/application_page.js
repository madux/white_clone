/**
 * Explore Modules — Application Page
 * Edition
 *
 * Loads CleonHR-tagged menus grouped by category via RPC, renders them
 * as cards (matching the "Explore Modules" screenshot layout), and
 * handles two click behaviours per card:
 *   - installed module  -> navigate straight to its menu/action
 *   - uninstalled module -> install via RPC (with spinner), then navigate
 */
(function ($) {
    'use strict';

    /* ------------------------------------------------------------------ */
    /*  Icon fallback map: partial name match -> FontAwesome class         */
    /* ------------------------------------------------------------------ */
    var ICON_MAP = {
        'expense':      'fa fa-receipt',
        'payroll':      'fa fa-money',
        'leave':        'fa fa-calendar-check-o',
        'attendance':   'fa fa-clock-o',
        'time':         'fa fa-clock-o',
        'recruit':      'fa fa-user-plus',
        'employee':     'fa fa-users',
        'health':       'fa fa-heartbeat',
        'insurance':    'fa fa-heartbeat',
        'hmo':          'fa fa-heartbeat',
        'market':       'fa fa-shopping-basket',
        'document':     'fa fa-file-text',
        'setting':      'fa fa-cog',
        'setup':        'fa fa-cog',
        'directory':    'fa fa-address-book',
        'warning':      'fa fa-exclamation-triangle',
        'disciplin':    'fa fa-exclamation-triangle',
        'calendar':     'fa fa-calendar',
        'learning':     'fa fa-graduation-cap',
        'performance':  'fa fa-line-chart',
        'appraisal':    'fa fa-line-chart',
        'contract':     'fa fa-file-text-o',
        'kyc':          'fa fa-id-card',
        'verification': 'fa fa-id-card',
        'control':      'fa fa-shield',
        'advisory':     'fa fa-comments-o',
    };

    function iconFor(name) {
        var lower = (name || '').toLowerCase();
        for (var key in ICON_MAP) {
            if (lower.indexOf(key) !== -1) return ICON_MAP[key];
        }
        return 'fa fa-th-large';
    }

    function hexToRgba(hex, alpha) {
        if (!hex) return 'rgba(99,102,241,' + alpha + ')';
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(function (c) { return c + c; }).join('');
        }
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function escapeHtml(str) {
        return $('<div>').text(str || '').html();
    }

    /* ------------------------------------------------------------------ */
    /*  Core page object                                                    */
    /* ------------------------------------------------------------------ */
    var AppPage = {
        categories:    [],
        totalModules:  0,
        totalFeatures: 0,

        /* ---------- fallback sample data if RPC fails ---------- */
        _useFallback: function () {
            this.categories = [];
            this.totalModules = 0;
            this.totalFeatures = 0;
        },

        /* ---------- load data from server ---------- */
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
                },
            });
        },

        /* ---------- build one card's HTML ---------- */
        _buildCard: function (app, cat) {
            var iconHtml = app.icon
                ? '<img src="' + app.icon + '" alt="' + escapeHtml(app.name) +
                  '" class="hc-app-icon" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"/>'
                : '';

            var features = (app.children && app.children.length) ? app.children.length : 1;
            var isInstalled = !!app.installed;

            var exploreLabel = isInstalled
                ? 'Explore Module <i class="fa fa-arrow-right"></i>'
                : 'Install Module <i class="fa fa-download"></i>';

            // Uninstalled cards get href="#" so the browser doesn't navigate
            // before the click handler runs the install flow.
            var href = isInstalled ? (app.url || '#') : '#';

            var $card = $(
                '<a href="' + href + '" ' +
                'class="hc-app-card' + (isInstalled ? '' : ' hc-app-uninstalled') + '" ' +
                'data-name="' + escapeHtml(app.name.toLowerCase()) + '" ' +
                'data-desc="' + escapeHtml((app.description || '').toLowerCase()) + '" ' +
                'data-features="' + features + '" ' +
                'data-id="' + app.id + '" ' +
                'data-url="' + escapeHtml(app.url || '') + '" ' +
                'data-installed="' + isInstalled + '" ' +
                'data-technical-name="' + escapeHtml(app.technical_name || '') + '">' +
                '  <div class="hc-app-icon-wrap" style="background-color:' + hexToRgba(cat.color, 0.1) + ';">' +
                     iconHtml +
                '    <div class="hc-app-icon-fallback" style="color:' + cat.color + ';' + (app.icon ? '' : 'display:flex;') + '">' +
                '      <i class="' + iconFor(app.name) + '"></i>' +
                '    </div>' +
                '  </div>' +
                '  <div class="hc-app-info">' +
                '    <span class="hc-app-name">' + escapeHtml(app.name) + '</span>' +
                '    <span class="hc-app-desc">' + escapeHtml(app.description || '') + '</span>' +
                '    <span class="hc-app-explore">' + exploreLabel + '</span>' +
                '  </div>' +
                '</a>'
            );

            return $card;
        },

        /* ---------- render all category sections ---------- */
        _render: function () {
            $('#hmoLoading').remove();

            var self = this;
            var $sections = $('#hc-app-sections');
            $sections.find('.hc-category-section').remove();

            var frag = document.createDocumentFragment();

            this.categories.forEach(function (cat) {
                var $section = $(
                    '<section class="hc-category-section" data-category="' +
                    escapeHtml(cat.name.toLowerCase()) + '">' +
                    '  <h2 class="hc-category-title">' + escapeHtml(cat.name) + '</h2>' +
                    '  <div class="hc-app-grid"></div>' +
                    '</section>'
                );
                var $grid = $section.find('.hc-app-grid');

                cat.app_items.forEach(function (app) {
                    $grid.append(self._buildCard(app, cat));
                });

                frag.appendChild($section[0]);
            });

            $sections.find('#hc-no-results').before(frag);
            this._recomputeStats();
        },

        /* ---------- stat cards ---------- */
        _recomputeStats: function () {
            $('#hc-stat-modules').text(this.totalModules);
            $('#hc-stat-features').text(this.totalFeatures);
        },

        /* ---------- search filter ---------- */
        _applySearch: function (query) {
            var q = (query || '').trim().toLowerCase();
            var visibleCount = 0;

            $('.hc-category-section').each(function () {
                var $section = $(this);
                var visibleInSection = 0;

                $section.find('.hc-app-card').each(function () {
                    var $card = $(this);
                    var matches = !q ||
                        $card.attr('data-name').indexOf(q) !== -1 ||
                        $card.attr('data-desc').indexOf(q) !== -1;
                    $card.toggle(matches);
                    if (matches) {
                        visibleInSection++;
                        visibleCount++;
                    }
                });

                $section.toggle(visibleInSection > 0);
            });

            $('#hc-no-results').toggleClass('d-none', visibleCount > 0);
        },

        /* ---------- card click: navigate or install ---------- */
        _onCardClick: function (e) {
            var $card = $(e.currentTarget);
            var isInstalled = $card.attr('data-installed') === 'true';

            if (isInstalled) {
                return; // let the <a href> do its normal thing
            }

            e.preventDefault();
            this._installFromCard($card);
        },

        _installFromCard: function ($card) {
            var technicalName = $card.attr('data-technical-name');
            var targetUrl      = $card.attr('data-url');
            var appName        = $card.attr('data-name');

            if (!technicalName) {
                return; // nothing to install
            }

            var $explore = $card.find('.hc-app-explore');
            var originalHtml = $explore.html();
            $card.addClass('hc-installing');
            $explore.html('<span class="spinner"></span> Installing… please hold');

            $.ajax({
                url: '/landing/module/install',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: { technical_name: technicalName },
                }),
                success: function (response) {
                    var result = response && response.result;
                    if (!result || !result.success) {
                        $explore.html(originalHtml);
                        $card.removeClass('hc-installing');
                        alert((result && result.error) || 'Failed to install ' + appName);
                        return;
                    }

                    // Mark every card sharing this technical_name as installed
                    $('.hc-app-card[data-technical-name="' + technicalName + '"]').each(function () {
                        $(this)
                            .attr('data-installed', 'true')
                            .removeClass('hc-app-uninstalled')
                            .find('.hc-app-explore')
                            .html('Explore Module <i class="fa fa-arrow-right"></i>');
                    });
                    $card.removeClass('hc-installing');

                    if (targetUrl) {
                        window.location.href = targetUrl;
                    }
                },
                error: function (xhr) {
                    $explore.html(originalHtml);
                    $card.removeClass('hc-installing');
                    var msg = (xhr.responseJSON &&
                        xhr.responseJSON.error &&
                        xhr.responseJSON.error.data &&
                        xhr.responseJSON.error.data.message) ||
                        'Failed to install ' + appName;
                    alert(msg);
                },
            });
        },

        /* ---------- wire up events (called once) ---------- */
        _bindUI: function () {
            var self = this;

            $(document).on('input', '#hc-app-search', function () {
                self._applySearch($(this).val());
            });

            $(document).on('click', '.hc-app-card', function (e) {
                self._onCardClick(e);
            });
        },

        /* ---------- entry point ---------- */
        init: function () {
            this._bindUI();
            this.load();
        },
    };

    $(document).ready(function () {
        AppPage.init();
    });

    /* Expose globally for debugging */
    window.CleonApplicationPage = AppPage;

})(jQuery);