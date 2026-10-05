/** @odoo-module **/

import { markup } from "@odoo/owl";

/**
 * Escape untrusted model text before injecting limited markdown HTML.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Apply a small, safe markdown subset on already-escaped text.
 * Supports: **bold**, *italic* / _italic_, `code`.
 * @param {string} escaped
 * @returns {string}
 */
function applyInlineMarkdown(escaped) {
    let s = escaped;
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
    s = s.replace(/(^|[\s(])_([^_\n]+?)_(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
    return s;
}

/**
 * Convert assistant markdown text to OWL markup (escaped + limited tags).
 * Supports bold, italic, code, bullet/numbered lists, and paragraphs.
 * @param {unknown} text
 */
export function formatAssistantMarkdown(text) {
    const raw = String(text == null ? "" : text).replace(/\r\n/g, "\n").trim();
    if (!raw) {
        return markup("");
    }

    const lines = raw.split("\n");
    const parts = [];
    let inList = false;

    const closeList = () => {
        if (inList) {
            parts.push("</ul>");
            inList = false;
        }
    };

    for (const line of lines) {
        const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
        if (bullet) {
            if (!inList) {
                parts.push('<ul class="o_cai_md_list">');
                inList = true;
            }
            parts.push("<li>" + applyInlineMarkdown(escapeHtml(bullet[1])) + "</li>");
            continue;
        }
        closeList();
        if (!line.trim()) {
            parts.push('<div class="o_cai_md_gap"></div>');
            continue;
        }
        parts.push('<p class="o_cai_md_p">' + applyInlineMarkdown(escapeHtml(line)) + "</p>");
    }
    closeList();
    return markup(parts.join(""));
}
