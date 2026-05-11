/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { patch } from "@web/core/utils/patch";
import { WebClient } from "@web/webclient/webclient";

patch(WebClient.prototype, {
    setup() {
        super.setup(...arguments);
    },
});

// Override the document title
const APP_NAME = "CleonHR"; // 👈 Change this to your desired tab title

// Change favicon
function setFavicon(url) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }
    link.href = url;
}

// Override title on every title change
const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "title");
Object.defineProperty(document, "title", {
    set(value) {
        // Replace "Odoo" or "WhiteClone" with your app name
        const cleaned = value
            .replace(/Odoo/gi, APP_NAME)
            .replace(/WhiteClone/gi, APP_NAME)
            .replace(/My Company/gi, APP_NAME);
        originalDescriptor.set.call(this, cleaned);
    },
    get() {
        return originalDescriptor.get.call(this);
    },
    configurable: true,
});

// Set custom favicon — put your icon in static/src/img/favicon.ico
setFavicon("/cleon_settings/static/src/img/favicon.png"); // 👈 update module name