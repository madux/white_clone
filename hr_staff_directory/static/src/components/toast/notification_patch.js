/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { notificationService } from "@web/core/notifications/notification_service";

patch(notificationService, {
    start(env) {
        const result = super.start(env);
        const originalAdd = result.add;
        
        result.add = (message, options = {}) => {
            // Fallback for sticky or actionable toasts since our custom toast is simple auto-closing
            if (options.buttons || options.sticky) {
                return originalAdd(message, options);
            }
            
            // Map Odoo's native types to our custom toast
            let type = "info";
            if (options.type === "danger") type = "error";
            else if (options.type === "warning") type = "warning";
            else if (options.type === "success") type = "success";
            
            const customToast = env.services["hr_staff_directory.toast"];
            if (customToast) {
                customToast.show(type, message);
                return () => {}; // return dummy close function
            }
            
            return originalAdd(message, options);
        };
        
        return result;
    }
});
