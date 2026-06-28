// odoo.define('cleon_license.landing', [], function () {
//     'use strict';
$(function () {
    console.log("Opening landf")
    /* ── Live search / filter ─────────────────────────────────────────────── */
    var $searchInput = $('#hc-app-search');
    var $cards       = $('#hc-app-grid .hc-app-card');
    var $noResults   = $('#hc-no-results');
    var statModules = document.getElementById('hc-stat-modules');
    var statFeatures = document.getElementById('hc-stat-features');
    $searchInput.on('input', function () {
        var query = $(this).val().trim().toLowerCase();
        console.log("Serchhhhinh", $cards)
        var visible = 0;
        $cards.each(function () {
            var name = ($(this).data('name') || '').toLowerCase();
            var desc = ($(this).find('.hc-app-desc').text() || '').toLowerCase();
            var match = !query || name.indexOf(query) !== -1 || desc.indexOf(query) !== -1;
            $(this).toggle(match);
            console.log("My dream ", match)
            if (match) { visible++; }
        });

        if (visible === 0) {
            $noResults.removeClass('d-none');
        } else {
            $noResults.addClass('d-none');
            statModules.textContent = visible;
            statFeatures.textContent = visible * 30;

        }
    });

    /* ── Keyboard shortcut: focus search on "/" key ───────────────────────── */
    $(document).on('keydown', function (e) {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            $searchInput.focus();
        }
        if (e.key === 'Escape') {
            $searchInput.val('').trigger('input').blur();
        }
    });

    /* ── App card entrance animation ─────────────────────────────────────── */
    $cards.each(function (i) {
        var $card = $(this);
        $card.css({ opacity: 0, transform: 'translateY(16px)' });
        setTimeout(function () {
            $card.css({
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                opacity: 1,
                transform: 'translateY(0)'
            });
        }, 60 + i * 40);
    });

});
// function init() {
//         console.log("murderfucker")
//         var searchInput = document.getElementById('hc-app-search');
//         var sectionsWrap = document.getElementById('hc-app-sections');
//         var noResults = document.getElementById('hc-no-results');
//         var statModules = document.getElementById('hc-stat-modules');
//         var statFeatures = document.getElementById('hc-stat-features');
 
//         if (!searchInput || !sectionsWrap) {
//             return;
//         }
 
//         var debounceTimer = null;
//         var currentRequestId = 0;
 
//         function recomputeStats() {
//         console.log("murderfucker2")

//             var visibleCards = sectionsWrap.querySelectorAll(
//                 '.hc-app-card:not(.d-none)'
//             );
//             var moduleCount = visibleCards.length;
//             var featureCount = 0;
 
//             visibleCards.forEach(function (card) {
//                 var n = parseInt(card.getAttribute('data-features'), 10);
//                 featureCount += isNaN(n) ? 1 : n;
//             });
 
//             if (statModules) {
//                 statModules.textContent = moduleCount;
//             }
//             if (statFeatures) {
//                 statFeatures.textContent = featureCount;
//             }
//         }
 
//         function toggleNoResults() {
//             var anyVisible = sectionsWrap.querySelector(
//                 '.hc-category-section:not(.d-none)'
//             );
//             if (noResults) {
//                 noResults.classList.toggle('d-none', !!anyVisible);
//             }
//         }
 
//         // Fetches matching modules from the server and toggles cards
//         // in place, so the page never re-flashes/re-renders wholesale.
//         function fetchAndFilter(term) {
//             var requestId = ++currentRequestId;
 
//             fetch('/maacherp/landing/search?term=' + encodeURIComponent(term), {
//                 method: 'GET',
//                 headers: { 'Accept': 'application/json' },
//             })
//                 .then(function (response) {
//                     if (!response.ok) {
//                         throw new Error('Search request failed');
//                     }
//                     return response.json();
//                 })
//                 .then(function (data) {
//                     // Ignore stale responses if the user kept typing.
//                     if (requestId !== currentRequestId) {
//                         return;
//                     }
//                     applyMatchIds(data.matched_ids || []);
//                 })
//                 .catch(function () {
//                     // Fail safe: fall back to local filtering so search
//                     // still works if the endpoint is unreachable.
//                     applyLocalFilter(term);
//                 });
//         }
 
//         function applyMatchIds(matchedIds) {
//             var idSet = new Set(matchedIds.map(String));
//             var sections = sectionsWrap.querySelectorAll('.hc-category-section');
 
//             sections.forEach(function (section) {
//                 var cards = section.querySelectorAll('.hc-app-card');
//                 var sectionHasMatch = false;
 
//                 cards.forEach(function (card) {
//                     var matches = idSet.has(String(card.getAttribute('data-id')));
//                     card.classList.toggle('d-none', !matches);
//                     if (matches) {
//                         sectionHasMatch = true;
//                     }
//                 });
 
//                 section.classList.toggle('d-none', !sectionHasMatch);
//             });
 
//             toggleNoResults();
//             recomputeStats();
//         }
 
//         // Used only if the fetch call fails, so search degrades gracefully.
//         function applyLocalFilter(term) {
//             term = term.toLowerCase();
//             var sections = sectionsWrap.querySelectorAll('.hc-category-section');
 
//             sections.forEach(function (section) {
//                 var cards = section.querySelectorAll('.hc-app-card');
//                 var sectionHasMatch = false;
                
//                 cards.forEach(function (card) {
//                     var name = card.getAttribute('data-name') || '';
//                     var desc = card.getAttribute('data-desc') || '';
//                     var matches = !term || name.indexOf(term) !== -1 || desc.indexOf(term) !== -1;
 
//                     card.classList.toggle('d-none', !matches);
//                     if (matches) {
//                         sectionHasMatch = true;
//                     }
//                 });
 
//                 section.classList.toggle('d-none', !sectionHasMatch);
//             });
 
//             toggleNoResults();
//             recomputeStats();
//         }
 
//         searchInput.addEventListener('input', function () {
//             var term = searchInput.value.trim();
 
//             clearTimeout(debounceTimer);
//             debounceTimer = setTimeout(function () {
//                 if (!term) {
//                     // Empty search: show everything again, no fetch needed.
//                     sectionsWrap.querySelectorAll('.hc-app-card').forEach(function (card) {
//                         card.classList.remove('d-none');
//                     });
//                     sectionsWrap.querySelectorAll('.hc-category-section').forEach(function (section) {
//                         section.classList.remove('d-none');
//                     });
//                     toggleNoResults();
//                     recomputeStats();
//                     return;
//                 }
//                 fetchAndFilter(term);
//             }, 250); // debounce so we don't fire a request per keystroke
//         });
 
//         recomputeStats();
//     }
 
//     if (document.readyState === 'loading') {
//         document.addEventListener('DOMContentLoaded', init);
//     } else {
//         init();
//     }

// /* ═══════════════════════════════════════════════════════════════════════════
//    Hope Children Portal – Custom Landing Page JS
//    ═══════════════════════════════════════════════════════════════════════════ */

/* global $ */

