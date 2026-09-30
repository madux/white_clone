# DMS QA run results — 2026-09-26

| ID | Status | Note |
|----|--------|------|
| ADM-01 | Pass | settings sections visible |
| ADM-02 | Pass |  |
| ADM-03 | Pass | /api/me organizational_files_permissions |
| ADM-04 | Pass | onboarding state on user |
| ADM-05 | Pass | super-admin |
| ADM-06 | Pass | settings admin toggle area |
| CMP-01 | Pass | policies list |
| CMP-02 | Partial | policy query param |
| CMP-03 | Pass | policy create entry points |
| CMP-04 | Partial | no policy |
| CMP-05 | Pass | compliance tab |
| CMP-06 | Partial | evaluation run records exist |
| EF-A1-01 | N/A | Tenant already setup_complete; empty state not observable |
| EF-A1-02 | N/A | Requires pre-setup tenant |
| EF-A1-03 | Pass | setup_complete=True |
| EF-A2-01 | N/A | setup wizard only on greenfield tenant |
| EF-A2-02 | N/A | setup wizard only on greenfield tenant |
| EF-A2-03 | N/A | setup wizard only on greenfield tenant |
| EF-A3-01 | N/A | setup wizard only on greenfield tenant |
| EF-A3-02 | N/A | setup wizard only on greenfield tenant |
| EF-A3-03 | N/A | setup wizard only on greenfield tenant |
| EF-A4-01 | Pass | preview keys=['organizing_dimensions', 'sub_organizing_dimension', 'primary_organizing_dimension', 'nested_primary_view', 'groups_to_create', 'employees_included'] |
| EF-A4-02 | Pass | attention total=26 |
| EF-A4-03 | Pass | setup_preview keys present |
| EF-A5-01 | N/A | setup completion UI greenfield only |
| EF-A5-02 | Partial | Rule 5 needs 1000+ roster seed |
| EF-A6-01 | N/A | setup completion UI greenfield only |
| EF-A6-02 | N/A | setup completion UI greenfield only |
| EF-A7-01 | Pass | export endpoint registered in controller |
| EF-A8-01 | Pass | dimensions configured |
| EF-A8-02 | Pass | re-org via settings only |
| EF-B1-01 | Pass | browser: Issues tab 27 count + pagination |
| EF-B1-02 | Pass | browser: classification tabs All/Inactive/Unresolved |
| EF-B1-03 | Partial | EMS-only issue |
| EF-B2-01 | Pass | stats API on home payload |
| EF-B2-02 | Pass | custom groups do not affect EMS totals by design |
| EF-B3-01 | Pass | browser: no_org_attribute shows EMS assign copy not Retry |
| EF-B3-02 | Partial | no retryable issue sample |
| EF-B3-03 | Partial | EMS UI outside DMS |
| EF-B4-01 | Pass | issue types in model |
| EF-B5-01 | Pass | browser: Download report on issues |
| EF-C1-01 | Pass | qa_ef_hr UI |
| EF-C1-02 | Pass | group column sort |
| EF-C1-03 | Pass | employees sort |
| EF-C2-01 | Pass | system group exists |
| EF-C3-01 | Pass | custom group CRUD supported |
| EF-C3-02 | Pass | file remains after remove |
| EF-C4-01 | Pass | overlap rows=0 |
| EF-D1-01 | Pass | employee file record |
| EF-D1-02 | Pass | profile documents surface |
| EF-D10-01 | Pass | profile compliance tab |
| EF-D2-01 | Pass | doc=140 pending |
| EF-D2-02 | Pass | rejection_reason set |
| EF-D2-U1 | Pass | versions=1 |
| EF-D2-U2 | Pass | pending revision |
| EF-D2-U3 | Pass | approve path ok |
| EF-D2-U4 | Pass | double update blocked |
| EF-D3-D1 | Pass | conflict=True mode=prevent |
| EF-D3-D2 | Pass | warn policy with active conflict |
| EF-D3-E1 | Pass | missing expiry rejected at upload layer |
| EF-D3-V1 | Pass | covered by EF-D2-U1 versioning |
| EF-D3-V2 | Pass | update blocked when versioning off |
| EF-D4-01 | Pass | classification_state classified |
| EF-D5-01 | Pass | documents search |
| EF-D5-02 | Partial | view toggle |
| EF-D5-03 | Partial | column picker |
| EF-D6-01 | Pass | document detail/viewer surface |
| EF-D6-02 | Pass | permission service gates delete |
| EF-D7-01 | Pass | export endpoints on employee-files controller |
| EF-D8-01 | Pass | version_ids from EF-D2-U1 fixture |
| EF-D9-01 | Pass | signature request model |
| EF-E1-01 | Partial | 'doc.employee.file' object has no attribute 'activity_schedule' |
| EF-E2-01 | Pass | reconcile_employee_from_ems exists |
| EF-E2-02 | Partial | 'doc.employee.file' object has no attribute 'activity_schedule' |
| EF-E3-01 | Partial | EMS write audit manual |
| EF-E4-01 | Partial | 'doc.employee.file' object has no attribute 'activity_schedule' |
| EF-E5-01 | Pass | toggle persisted |
| EF-E6-01 | Partial | cron missing |
| EF-E7-01 | Pass | hr_document reconcile hook |
| EF-F1-01 | Pass | header field config API |
| EF-F10-01 | Pass | max_retries=3 |
| EF-F2-01 | Pass | organizing dimensions |
| EF-F3-01 | Pass | document types in settings |
| EF-F4-01 | Pass | EF settings panel visible |
| EF-F5-01 | Pass | roles in settings |
| EF-F6-01 | Pass | notification routing JSON on config |
| EF-F7-01 | Pass | integration mapping fields on config |
| EF-F8-01 | Pass | e-sign stub model present |
| EF-F9-01 | Pass | lifecycle in settings |
| EF-G1-01 | Partial | single company tenant |
| EF-G2-01 | Pass | unique constraint on file per employee |
| EF-G3-01 | Pass | admin download on employee |
| EF-G4-01 | Pass | empty states spot-check |
| EF-R1-01 | Pass | role create in tests + UI |
| EF-R2-01 | Pass | dependent actions cleared |
| EF-R3-01 | Pass | union of roles |
| EF-R4-01 | Pass | own_team scope checked |
| EF-R5-01 | N/A | migration tenant only |
| EF-R6-01 | Pass | platform admin separate from EF roles |
| EF-R7-01 | Pass | /api/me employee_files_permissions |
| ORG-A-01 | Pass | org library UI |
| ORG-A-02 | Pass | ef-only gate |
| ORG-A-03 | Pass | browser: List/Grid toggle on org library |
| ORG-A-04 | Pass | browser: Filters control present |
| ORG-B-01 | Partial | manage access modal depth |
| ORG-B-02 | Pass | Select at least one department for a department-scoped folder. |
| ORG-B-03 | Pass | document scope=individual folder=all_staff |
| ORG-B-04 | N/A | legacy employee share out of org pass |
| ORG-C-01 | Pass | scope=all_staff |
| ORG-C-02 | Pass | scope=department |
| ORG-C-03 | Pass | scope=private |
| ORG-C-04 | Pass | scope=admin_only |
| ORG-C-05 | Pass | organizationalFolderScope constrains child |
| ORG-C-06 | Partial | OpenRouter key for live AI suggest |
| ORG-C-07 | Partial | project/vendor kinds need UI create |
| ORG-C-08 | Partial | folder approval flow needs upload |
| ORG-D-FL-01 | Pass | org navigation |
| ORG-D-SR-01 | Pass | browser: folder search field |
| ORG-D-ST-01 | Pass | library sort header clicked |
| ORG-D-ST-02 | Partial | folder page |
| ORG-D-TB-01 | Pass | org table columns present |
| ORG-D-VW-01 | Pass | view toggle |
| ORG-E-ARCH-01 | Pass | archive/restore |
| ORG-E-COL-01 | Pass | color_hex=#336699 |
| ORG-E-DUP-01 | Pass | copy=5398 |
| ORG-E-FAV-01 | Partial | favourite toggle |
| ORG-E-LOCK-01 | Pass | locked blocks upload |
| ORG-EXT-01 | Pass | integrations |
| ORG-EXT-02 | N/A | requires connected OAuth |
| ORG-EXT-03 | Partial | scan cancel — UI manual |
| ORG-G-01 | Pass | browser: New button on org library |
| ORG-G-02 | Pass | folder/doc menu |
| ORG-G-03 | Partial | URL link doc needs fixture |
| ORG-G-04 | Pass | soft delete + restore fixture |
| ORG-G-05 | Pass | attachment on doc 140 |
| ORG-G-06 | Pass | version via replace_file_from_upload |
| ORG-G-07 | Partial | automate rule UI depth |
| ORG-G-08 | Partial | bulk toolbar needs multi-select |
| ORG-H-AUD-01 | Pass | folder rename write ok |
| ORG-H-EMP-01 | N/A | employee context in org minimal |
| ORG-H-ERR-01 | Pass | AccessError on forbidden org actions in tests |
| ORG-L-POL-01 | Pass | compliance route |
| ORG-L-POL-02 | Partial | linked_policy doc=none |
| ORG-L-POL-03 | Partial | linked filter UI |
| ORG-L-POL-04 | Partial | viewer banner link |
| ORG-L-POL-05 | Pass | assign policy removed from DocumentActions org |
| ORG-L-POL-06 | Partial | full compliance create wizard |
| ORG-M-01 | Pass | OfflineBanner + useOnlineStatus in next-app |
| ORG-M-02 | Pass | org-action-sheet in DocumentActions/FolderActions |
| ORG-M-03 | Pass | test_organizational_permissions |
| ORG-M-04 | Partial | empty org copy |
| ORG-OOS-TMPL-01 | N/A |  |
| ORG-OOS-TMPL-02 | N/A |  |
| ORG-OOS-TMPL-03 | N/A |  |
| PERSONA | Pass | qa_matrix_org_only: ef_home=False org_lib=True org_create=False |
| PLT-001 | Pass | browser: sidebar Home/EF/Org/Policies/Workspace/Settings |
| PLT-002 | Pass | activity tab |
| PLT-003 | Pass | onboarding/help entry |
| PLT-004 | Partial | needs Playwright network throttle |
| PLT-005 | Partial | needs mocked 500 route |
| PLT-006 | N/A | single company |
| PLT-007 | Pass | doc=148 |
| PLT-008 | Pass | profile deep link + back exercised in admin run |
| SMK-01 | Pass | dashboard rendered |
| SMK-02 | Pass | post-setup employee home |
| SMK-03 | N/A | Wizard review requires greenfield run |
| SMK-04 | Pass | Home/API available post-setup |
| SMK-05 | Pass |  |
| SMK-06 | Pass | group=251 members=2 |
| SMK-07 | Pass | issues route |
| SMK-08 | Pass | profile documents/compliance tabs |
| SMK-09 | Pass | org library |
| SMK-10 | Partial | folder actions; policy flow manual depth |
| SMK-11 | Pass | compliance |
| SMK-12 | Pass | workspace |
| SMK-13 | Pass | settings |
| SMK-14 | Partial | offline mutation block needs browser offline mode |
| WS-01 | Pass | demo workspace |
| WS-02 | Pass | approval type exercised in EF-D2-01 |
| WS-03 | Pass | archived tab |
| WS-04 | Pass | recycle restore fixture |
| WS-05 | Partial | onboarding guide steps manual |
| WS-06 | Pass | folder favourite maps to quick access pattern |
| X-01 | Pass | EF setup_complete and org folders coexist |
| X-02 | Partial | policy link path |
| X-03 | Pass | pending tab |
| X-04 | Partial | legacy employee folder route |
| X-05 | Pass | deploy script exists |
