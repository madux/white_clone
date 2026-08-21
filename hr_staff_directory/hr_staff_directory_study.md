# hr_staff_directory Module Study Notes

## 1. Overview
The hr_staff_directory module is a custom Odoo 17 addon designed to provide a comprehensive **Staff Directory Dashboard** alongside workforce analytics. It acts as an interactive, highly visual frontend for exploring and analyzing employee data within the CleonHR suite.

## 2. Frontend Architecture (OWL / UI Components)
This module relies heavily on Odoo's web framework (OWL) to render a modern dashboard. The assets are modularized in static/src/ and grouped into specific visualization components:

*   **geographic_map**: Renders employee locations on a map (this is where map_bg.svg resides).
*   **org_chart**: Visualizes the reporting structure (managers and direct reports).
*   **heatmap**: Used for cross-sectional data visualization (e.g., skills distribution).
*   **bar_chart**: Displays headcount trends and department distribution.
*   **people_list & profile_panel**: Handles the individual employee cards and detailed views.
*   **staff_directory_dashboard.js**: The main orchestrator that fetches data and mounts these sub-components.

## 3. Backend Architecture (Python Models)
### Extending hr.employee
The module extends the base hr.employee model (models/hr_employee.py). Its most significant addition is the @api.model method _get_staff_directory_data. 

This method acts as the primary data provider for the frontend dashboard. It queries the employee records and constructs a dense dictionary of formatted data for each person, including:
*   **Core Info:** Name, Job Title, Department, Manager, Direct Reports count.
*   **Computed Tenure:** Dynamically calculates how long an employee has been with the company (e.g., 2y 3m or < 1m).
*   **Pinning System:** It checks emp.pinned_by_user_ids to determine if the current user has bookmarked/pinned an employee (is_pinned).
*   **Temporary Mock Data:** Interestingly, the method currently generates **mock data** for certain analytics to ensure the dashboard looks populated:
    *   progress_score: A pseudo-random integer.
    *   skills: Uses a deterministic helper method (_mock_skills_for_employee) to assign skills like "AWS", "B2B Sales", or "Operational Risk" based on the employee's ID and department. This is explicitly marked with a TODO to wire up to real performance/skill fields later.

### Other Models
*   hr_work_location.py: Likely extends the work location model, possibly adding coordinate data (latitude/longitude) required by the geographic_map component.

## 4. Development & Seed Data
The directory contains scripts like dev_seed.sql, dev_gender_update.sql, and dev_generate_seed_all.py. This indicates that the developers built a robust scaffolding system to generate realistic dummy data (names, hierarchies, skills) to test the complex dashboard visualizations during development.

## 5. Relationship Network Graph Physics & Architecture
The **relationship_graph** component uses d3.js (specifically d3-force) to simulate a force-directed network layout. This layout provides an interactive, physical simulation where nodes naturally float and adjust themselves.

### Linkage Strategies
*   **Reporting Lines:** Represented as direct links from an Employee to their Manager (based on manager_id). These act as standard tension lines in the physics simulation.
*   **Peer / Team Lines (Chain Optimization):** Instead of creating a complete graph (a clique) where every team member is connected to every other team member—which creates an (N^2)$ explosion of intersecting lines that crushes browser physics engines—peers are grouped by their shared manager and linked sequentially in a **single continuous chain** (A ➔ B ➔ C). This (N)$ optimization keeps the physics simulation incredibly lightweight while still ensuring the forces pull the entire team into a distinct, cohesive visual cluster on the canvas.
* If you ever want to change this logic (for instance, if you want peers to mean "people in the same Department" instead of "people with the same Manager"), that logic lives right inside the buildGraphData() function in **relationship_graph.js**

## 6. Organization Analysis KPIs
1. Total Teams
The Logic: I count the number of unique managers across the currently filtered list of employees.
The Rationale: In most organizational structures, a "team" is defined by a group of people reporting to a single manager. By counting how many distinct manager_ids exist in the current data, we get a highly accurate proxy for the number of active teams.
2. Avg. Span of Control
The Logic: I divide the Total Headcount by the Total Teams (the unique manager count from above).
The Rationale: "Span of control" is an HR metric that represents the average number of direct reports a manager is responsible for. For example, if you have 100 employees and 20 managers (teams), the average span of control is 100 / 20 = 5.0. This gives leadership a quick pulse on whether managers are stretched too thin or if the organization is too top-heavy.
If your organization has a different specific definition for what constitutes a "Team" (for example, if you have a dedicated team_id field on the employee record that differs from their manager), or if you want "Span of Control" calculated differently, we can easily tweak that logic before we move on to the charts!
