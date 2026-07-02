document.addEventListener("DOMContentLoaded", () => {

    // ── Tab switching ──
    const tabBtns = document.querySelectorAll(".thm-tab-btn");
    const panes   = document.querySelectorAll(".thm-pane");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const target = btn.dataset.pane;
            panes.forEach(p => {
                p.classList.toggle("active", p.id === `pane-${target}`);
            });
        });
    });

    // ── Helpers ──
    function makeSelectable(containerSel, itemSel) {
        const container = document.querySelector(containerSel);
        if (!container) return;
        const items = container.querySelectorAll(itemSel);
        items.forEach(item => {
            item.addEventListener("click", () => {
                items.forEach(i => i.classList.remove("active"));
                item.classList.add("active");
                syncPreview();
            });
        });
    }

    // ── Color preset swatches ──
    const presetSwatches = document.querySelectorAll("#presets-grid .thm-preset-swatch");
    presetSwatches.forEach(swatch => {
        swatch.addEventListener("click", () => {
            presetSwatches.forEach(s => s.classList.remove("active"));
            swatch.classList.add("active");

            const p = swatch.dataset.p;
            const s = swatch.dataset.s;
            const a = swatch.dataset.a;

            setColor("primary",   p);
            setColor("secondary", s);
            setColor("accent",    a);
            syncPreview();
        });
    });

    // ── Brand color pickers ──
    function setColor(name, hex) {
        const picker = document.getElementById(`picker-${name}`);
        const hexInput = document.getElementById(`hex-${name}`);
        const swatch   = document.getElementById(`swatch-${name}`);
        if (picker)   picker.value = hex;
        if (hexInput) hexInput.value = hex.toUpperCase();
        if (swatch)   swatch.style.background = hex;
    }

    ["primary", "secondary", "accent"].forEach(name => {
        const picker   = document.getElementById(`picker-${name}`);
        const hexInput = document.getElementById(`hex-${name}`);
        const swatch   = document.getElementById(`swatch-${name}`);

        if (picker) {
            picker.addEventListener("input", () => {
                const hex = picker.value;
                if (hexInput) hexInput.value = hex.toUpperCase();
                if (swatch)   swatch.style.background = hex;
                presetSwatches.forEach(s => s.classList.remove("active"));
                syncPreview();
            });
        }

        if (hexInput) {
            hexInput.addEventListener("input", () => {
                const val = hexInput.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                    if (picker) picker.value = val;
                    if (swatch) swatch.style.background = val;
                    syncPreview();
                }
            });
        }
    });

    // ── Font lists ──
    function bindFontList(listId) {
        const list  = document.getElementById(listId);
        if (!list) return;
        const rows  = list.querySelectorAll(".thm-font-row");
        rows.forEach(row => {
            row.addEventListener("click", () => {
                rows.forEach(r => r.classList.remove("active"));
                row.classList.add("active");
                syncPreview();
            });
        });
    }
    bindFontList("font-heading-list");
    bindFontList("font-body-list");

    // ── Radius cards ──
    makeSelectable("#radius-grid", ".thm-radius-card");

    // ── Button style cards ──
    const btnStyleCards = document.querySelectorAll("#btn-style-grid .thm-btn-style-card");
    btnStyleCards.forEach(card => {
        card.addEventListener("click", () => {
            btnStyleCards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            syncPreview();
        });
    });

    // ── Density cards ──
    makeSelectable("#density-grid", ".thm-density-card");

    // ── Sync live preview ──
    function syncPreview() {
        const primaryColor   = document.getElementById("picker-primary")?.value   || "#EC4899";
        const secondaryColor = document.getElementById("picker-secondary")?.value || "#885CF6";

        // Active heading font
        const activeHeadingRow = document.querySelector("#font-heading-list .thm-font-row.active");
        const headingFont = activeHeadingRow?.dataset.font || "'Inter', sans-serif";

        // Active body font
        const activeBodyRow = document.querySelector("#font-body-list .thm-font-row.active");
        const bodyFont = activeBodyRow?.dataset.font || "'Inter', sans-serif";

        // Active radius
        const activeRadius = document.querySelector("#radius-grid .thm-radius-card.active");
        const radius = activeRadius?.dataset.val || "4px";

        // Active button style radius
        const activeBtnStyle = document.querySelector("#btn-style-grid .thm-btn-style-card.active");
        const btnRadius = activeBtnStyle?.dataset.radius || "8px";

        // Apply to live preview nav + buttons
        const lpNavPrimary = document.getElementById("lp-nav-primary");
        if (lpNavPrimary) lpNavPrimary.style.background = primaryColor;

        const lpBtnPrimary = document.getElementById("lp-btn-primary");
        if (lpBtnPrimary) {
            lpBtnPrimary.style.background    = primaryColor;
            lpBtnPrimary.style.borderRadius  = btnRadius;
        }

        const lpBtnSecondary = document.getElementById("lp-btn-secondary");
        if (lpBtnSecondary) {
            lpBtnSecondary.style.color        = primaryColor;
            lpBtnSecondary.style.borderColor  = primaryColor;
            lpBtnSecondary.style.borderRadius = btnRadius;
        }

        // Typography preview
        const h1 = document.getElementById("preview-h1");
        const h2 = document.getElementById("preview-h2");
        const h3 = document.getElementById("preview-h3");
        if (h1) h1.style.fontFamily = headingFont;
        if (h2) h2.style.fontFamily = headingFont;
        if (h3) h3.style.fontFamily = headingFont;

        const body  = document.getElementById("preview-body");
        const small = document.getElementById("preview-small");
        if (body)  body.style.fontFamily  = bodyFont;
        if (small) small.style.fontFamily = bodyFont;

        // Live preview typography section
        const lpH = document.getElementById("lp-typo-heading");
        const lpB = document.getElementById("lp-typo-body");
        const lpS = document.getElementById("lp-typo-small");
        if (lpH) lpH.style.fontFamily = headingFont;
        if (lpB) { lpB.style.fontFamily = bodyFont; lpB.style.color = primaryColor; }
        if (lpS) lpS.style.fontFamily = bodyFont;
    }

    // ── Save / Reset ──
    document.getElementById("thm-btn-save")?.addEventListener("click", () => {
        const badge = document.getElementById("unsaved-badge");
        if (badge) badge.style.display = "none";
        alert("Theme settings saved successfully.");
    });

    document.getElementById("thm-btn-reset")?.addEventListener("click", () => {
        if (confirm("Reset all theme settings to default?")) {
            window.location.reload();
        }
    });

    // Bootstrap
    syncPreview();
});