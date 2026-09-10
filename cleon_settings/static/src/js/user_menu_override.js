/** @odoo-module **/

import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";
import { _t } from "@web/core/l10n/translation";

function customOdooAccountItem(env) {
    return {
        type: "item",
        id: "account",
        description: "My Account",
        callback: () => {
            console.log("My account not loading ...")
            // env.services
            //     .rpc("/web/session/account")
            //     .then((url) => {
            //         browser.open(url, "_blank");
            //     })
            //     .catch(() => {
            //         browser.open("https://accounts.odoo.com/account", "_blank");
            //     });
        },
        sequence: 60,
    };
}

// export function preferencesItem(env) {
//     return {
//         type: "item",
//         id: "settings",
//         description: _t("Preferences"),
//         callback: async function () {
//             const actionDescription = await env.services.orm.call("res.users", "action_get");
//             actionDescription.res_id = env.services.user.userId;
//             env.services.action.doAction(actionDescription);
//         },
//         sequence: 50,
//     };
// }

function customdocumentationItem(env) {
    const documentationURL = "/landing";
    return {
        type: "item",
        id: "documentation",
        description: _t("Documentation"),
        href: documentationURL,
        callback: () => {
            browser.open(documentationURL, "_blank");
        },
        sequence: 10,
    };
}


// Remove existing item
registry.category("user_menuitems").remove("odoo_account")
registry.category("user_menuitems").remove("documentation")
registry.category("user_menuitems").remove("support")
registry.category("user_menuitems").remove("profile")

// Register yours
registry.category("user_menuitems").add(
    "odoo_account",
    customOdooAccountItem
).add("documentation", customdocumentationItem);
    // .add("support", supportItem)
    // .add("profile", preferencesItem)