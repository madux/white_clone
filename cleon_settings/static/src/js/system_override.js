/** @odoo-module **/

import { ErrorDialog, NetworkErrorDialog, ClientErrorDialog } from "@web/core/errors/error_dialogs";
import { _t } from "@web/core/l10n/translation";

ErrorDialog.title = _t("System Error");

NetworkErrorDialog.title = _t("System Network Error");
ClientErrorDialog.title = _t("System Client Error");