{
    "name": "HR Job Dashboard",
    "version": "17.0.1.0.0",
    "summary": "OWL job overview dashboard (health score, timeline, pipeline, hiring team)",
    "category": "Human Resources/Recruitment",
    "depends": ["hr_recruitment", "web", "mail"],
    "data": [
        'views/menu.xml',
    ],
    "assets": {
        "web.assets_backend": [
            # Odoo already ships Chart.js — reuse it instead of loading a
            # second copy. If your version doesn't bundle it, drop the CDN
            # tag into an <script> in job_dashboard_templates.xml's <head>
            # via a QWeb report, or add the vendored file here instead.
            "web/static/lib/Chart/Chart.js",

            "hr_job_dashboard/static/src/scss/job_dashboard.scss",

            "hr_job_dashboard/static/src/js/components/job_health_score.js",
            "hr_job_dashboard/static/src/js/components/job_timeline.js",
            "hr_job_dashboard/static/src/js/components/pipeline_overview.js",
            "hr_job_dashboard/static/src/js/components/cleon_ai_panel.js",
            "hr_job_dashboard/static/src/js/components/hiring_team.js",
            "hr_job_dashboard/static/src/js/components/recent_activity.js",
            "hr_job_dashboard/static/src/js/components/sidebar.js",
            "hr_job_dashboard/static/src/js/job_header.js",
            "hr_job_dashboard/static/src/js/job_dashboard.js",
            "hr_job_dashboard/static/src/xml/job_dashboard_templates.xml",
        ],
    },
    "installable": True,
    "license": "LGPL-3",
}
