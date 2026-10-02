# -*- coding: utf-8 -*-
{
    "name": "CleonHR Calendar Component",
    "summary": "Reusable OWL calendar (month / week / day / year) shared by every CleonHR app",
    "description": """
        Provides the data-agnostic ``CleonCalendar`` OWL component and date helpers.
        Consumers pass plain event objects and react to navigation / selection
        callbacks; all domain logic (leave, shifts, attendance...) stays in the
        consuming module.

        import { CleonCalendar } from "@cleon_calendar/calendar/calendar";
        import { getViewRange } from "@cleon_calendar/calendar/calendar_utils";
    """,
    "version": "17.0.1.0.0",
    "category": "Human Resources",
    "author": "CleonHR Team",
    "license": "LGPL-3",
    "depends": ["web"],
    "assets": {
        "web.assets_backend": [
            "cleon_calendar/static/src/calendar/calendar_utils.js",
            "cleon_calendar/static/src/calendar/calendar.js",
            "cleon_calendar/static/src/calendar/calendar.xml",
            "cleon_calendar/static/src/calendar/calendar.css",
        ],
    },
    "installable": True,
    "application": False,
}
