# Admin modules action inventory

## Registrations

| ID | Action | Tag | Endpoint or blocker | Roles | Territory | Audit | UI |
|---|---|---|---|---|---|---|---|
| R1 | Approve registration | EXISTS | PATCH /auth/approve-user/:id (src/auth/auth.controller.ts:383) | Registration-admin roles (auth.controller.ts:385) | yes (auth.service.ts:1246) | yes, COMPANY_REGISTRATION_APPROVED (auth.service.ts:1934) | review dialog |
| R2 | Reject registration | EXISTS | PATCH /auth/reject-user/:id (auth.controller.ts:404) | Registration-admin (auth.controller.ts:406) | yes (auth.controller.ts:409) | yes (auth.service.ts:1318) | review dialog |
| R3 | Request complements | EXISTS | PATCH /auth/request-complements/:id (auth.controller.ts:419) | Registration-admin (auth.controller.ts:421) | yes (auth.controller.ts:424) | yes (auth.service.ts:1361) | review dialog |
| R4 | Open registration file | PARTIAL | list only (auth.controller.ts:434); no separate detail route | Registration-admin + CENTRAL_AGENT (auth.controller.ts:436) | yes (auth.controller.ts:454) | no read audit | row opens dialog |
| R5 | Assisted registration | EXISTS | POST /auth/admin/register-company (auth.controller.ts:302) | SUPER_ADMIN, ADMIN_ONEFOP, ADMIN_ONEFOP_REGISTRATIONS, REGIONAL_ADMIN, DIVISIONAL_ADMIN (auth.controller.ts:304) | yes (auth.controller.ts:306, :360) | yes (auth.service.ts:995) | nouvelle/page.tsx:91 |
| R6 | Search queue | PARTIAL | list accepts `search`; UI sends `organisation` only | Registration-admin + CENTRAL_AGENT (auth.controller.ts:436) | yes (auth.service.ts:1605) | no read audit | UI at inscriptions/page.tsx:250, :343 |
| R7 | Filter queue | EXISTS | GET /auth/company-registrations filters (auth.controller.ts:439) | Registration-admin + CENTRAL_AGENT | yes (auth.service.ts:1605) | no read audit | queue filters |
| R8 | Status counts | EXISTS | companyRegistrationCounts (auth.service.ts:1773, :2006) | same as list | yes (auth.service.ts:2011) | no read audit | status panel :654 |
| R9 | Overdue banner | EXISTS | list overdue param (auth.controller.ts:449); derived (auth.service.ts:1688) | same as list | yes (auth.service.ts:1605) | no | banner :638 |
| R10 | Registration coverage | EXISTS | CoveragePanel.tsx:1 | UNCLEAR controller guard | UNCLEAR coverage scope | no read audit | vue=couverture :577 |
| R11 | Deactivate organisation | PARTIAL | PATCH /auth/users/:id/suspend (auth.controller.ts:564) is user-level, NO territory check | SUPER_ADMIN, ADMIN_ONEFOP (auth.controller.ts:566) | NO territory check | yes (auth.service.ts:2348) | user directory only |
| R12 | Reactivate organisation | PARTIAL | PATCH /auth/users/:id/activate (auth.controller.ts:571), NO territory check | SUPER_ADMIN, ADMIN_ONEFOP (auth.controller.ts:573) | NO territory check | yes (auth.service.ts:2348) | user directory only |
| R13 | Flag/unflag duplicate | NEW | no flag endpoint; hints computed (auth.service.ts:2056) | - | - | no | hints shown :934 |
| R14 | Merge duplicates | NEW | no endpoint, no model | - | - | no | not surfaced |
| R15 | Edit organisation details | PARTIAL | no edit endpoint; verification recorded at approval | registration-admin at approval | approval target only | in approval audit | radio controls :1045 |
| R16 | Reset credentials | PARTIAL | POST /auth/admin/reset-password (auth.controller.ts:594) SUPER_ADMIN only | SUPER_ADMIN (auth.controller.ts:596) | no territory scope | audit write UNVERIFIED | not surfaced in registrations |
| R17 | Transfer org territory | NEW | PATCH /auth/users/:id/territory is USER territory, not org | SUPER_ADMIN, ADMIN_ONEFOP (auth.controller.ts:546) | user territory only | yes (auth.service.ts:2383) | user directory |
| R18 | Message outside request-info | NEW | only request-complements path | - | - | - | message field :1141 |
| R19 | Bulk reminder | NEW | none | - | - | no | not surfaced |
| R20 | Communication history | NEW | none | - | - | no | not surfaced |
| R21 | Decision history per registration | MODIFY | GET /audit/reports?resourceId= (audit.controller.ts:31) exists | SUPER_ADMIN, ADMIN_ONEFOP, AUDITOR (audit.controller.ts:32) | audit has NO territory predicate (audit.controller.ts:43) | reads audit | no per-record link yet |
| R22 | Resubmission history | EXISTS (limited) | latest diff only (auth.service.ts:1785) | list roles | yes (auth.service.ts:1753) | from audit (auth.service.ts:1792) | dialog diff :1016 |
| R23 | Export registrations | NEW | no endpoint (auth.controller.ts:434) | - | - | no | no control :560 |
| R24 | Record verification check | EXISTS | approve payload (auth.controller.ts:392) | registration-admin | yes (auth.controller.ts:394) | yes (auth.service.ts:1940) | radio controls :1045 |
| R25 | Override failed check | NEW | none; approval blocks | - | - | - | approval disabled :428 |
| R26 | Attach document/note | NEW | no endpoint | - | - | - | not surfaced |
| R27 | "Has this org submitted?" on row | NEW | no join in registration list (auth.service.ts:1724-1744) | - | - | no | not surfaced |
| R28 | Bulk approve/reject registrations | NEW (intentionally absent) | no bulk endpoints | - | - | - | no controls |

## Declarations

| ID | Action | Tag | Endpoint or blocker | Roles | Territory | Audit | UI |
|---|---|---|---|---|---|---|---|
| D1 | Endorse (individual) | EXISTS | PATCH /admin/questionnaires/:id/approve (admin-questionnaires.controller.ts:334) | survey-admin roles (class guard :120) | yes (:336) | yes (questionnaires.service.ts:3773) | detail page |
| D2 | Reject (individual) | EXISTS | PATCH .../reject (:344) | survey-admin | yes (:355) | yes AUDIT_REJECT (:3800) | detail page |
| D3 | Request correction | EXISTS | PATCH .../request-correction (:364) | survey-admin | yes (:372) | yes AUDIT_CORRECTION (:3829) | detail modal |
| D4 | Bulk endorse/reject | EXISTS | POST /bulk-visa, /bulk-reject (:169, :177) | survey-admin | yes (eligibility-engine.service.ts:682) | yes (:758, :888) | list selection |
| D5 | Bulk request correction | NEW | no bulk correction route | - | - | - | none |
| D6 | Export queue | EXISTS | GET /admin/questionnaires/export (:288) | survey-admin; NOT CENTRAL_AGENT (:120) | yes (:310) | yes (questionnaires.service.ts:4007) | list |
| D7 | Export completed view | MODIFY | same export, accepts one status | survey-admin | yes | yes | no completed view yet |
| D8 | Open dossier detail | EXISTS | GET /admin/questionnaires/:id (:328) | survey-read incl CENTRAL_AGENT (:116) | yes (:330) | no read audit | list link |
| D9 | Filter by status | EXISTS | list status (:222) | survey-read incl CENTRAL_AGENT (:223) | yes (:249) | no | ViewSwitch :575 |
| D10 | Overdue link | EXISTS | list overdue (:237); derived (admin-list-filter.ts:82) | survey-read | yes (:65) | no | banner :590 |
| D11 | Coverage | EXISTS | DossiersCoverage.tsx:16 | UNCLEAR guard | UNCLEAR scope | no | vue=couverture :562 |
| D12 | Reopen completed decision | MODIFY | PATCH .../reopen-for-correction (:387) EXISTS | SUPER_ADMIN, ADMIN_ONEFOP, ADMIN_ONEFOP_SUBMISSIONS (:388) | yes (:396) | yes AUDIT_REOPEN (:383) | detail page only |
| D13 | Assign to reviewer | MODIFY | assigneeId exists (schema.prisma:221); no endpoint | - | - | - | not surfaced |
| D14 | Internal note | NEW | no endpoint | - | - | - | not surfaced |
| D15 | Escalation | PARTIAL | anomaly resolution exists, no escalation endpoint | survey-admin | yes | yes | no explicit control |
| D16 | Resolve/waive anomaly | EXISTS | PATCH /admin/questionnaires/anomalies/:id/resolve (:207) | survey-admin | yes (eligibility-engine.service.ts:596) | yes | UNCLEAR in dossier UI |
| D17 | Anomaly detail inline | PARTIAL | counts in list (questionnaires.service.ts:3586); detail on page | survey-read | yes (:249) | no | list counts only |
| D18 | Filter by anomaly type | NEW | anomaly registry accepts status/blocking, not type (:185) | survey-read | yes (:195) | no | none |
| D19 | Declaration -> org profile | PARTIAL | org info on detail; link not verified | survey-read incl CENTRAL_AGENT (:329) | yes (:3630) | no | UNCLEAR |
| D20 | Org registration status on declaration row | NEW | no join | survey-read | dossier yes, registration-status no | no | not shown |
| D21 | Decision history per declaration | MODIFY | audit endpoint exists (audit.controller.ts:31); detail page links (:905) | SUPER_ADMIN, ADMIN_ONEFOP, AUDITOR | no territory predicate | reads audit | detail link exists |
| D22 | Correction history | MODIFY | instruction history + audit link (:905) | same | same | yes audit | detail only |

## Shared

| ID | Action | Tag | Endpoint or blocker | Roles | Territory | Audit | UI |
|---|---|---|---|---|---|---|---|
| S1 | Assign/claim | MODIFY | assigneeId exists (schema.prisma:221); no claim endpoint | - | - | - | not surfaced |
| S2 | Named views | NEW | no endpoint | - | - | - | not surfaced |
| S3 | "My work" | PARTIAL | createdBy filter only (auth.controller.ts:448), not assignee | registration list roles | yes | no | createdBy link only |
| S4 | Bulk mark-as-seen | PARTIAL | individual mark-read only (notifications.controller.ts:23, :49) | any authenticated | user-owned | no audit | inbox :48 |
| S5 | Subscribe to overdue alerts | NEW | none | - | - | - | none |
| S6 | Configure overdue threshold | EXISTS | settings endpoint (parametres/page.tsx:131) | UNCLEAR guard | global, no territory | audit UNVERIFIED | settings :287 |
| S7 | Notification inbox | EXISTS | GET /auth/me/notifications (notifications.controller.ts:32) | any authenticated (:13) | user-owned | no | notifications page |
| S8 | Audit trail per record | PARTIAL | GET /audit/reports?resourceId= exists | SUPER_ADMIN, ADMIN_ONEFOP, AUDITOR | no territory | reads audit | dossier links; registration does not |
| S9 | Export audit trail | NEW | no export endpoint | audit roles | no | no | none |
| S10 | See who viewed a record | NEW | none | - | - | - | none |
| S11 | Pin favourite filter | NEW | none | - | - | - | none |
| S12 | Default landing view | NEW | none | - | - | - | none |
| S13 | Column show/hide | NEW | none | - | - | - | none |

## Archive

| ID | Action | Tag | Endpoint or blocker | Roles | Territory | Audit | UI |
|---|---|---|---|---|---|---|---|
| A1 | Archive registration | NEW (Phase 4) | no endpoint, no field (auth.controller.ts:434; schema.prisma:196) | - | - | - | none |
| A2 | Restore registration | NEW (Phase 4) | same | - | - | - | none |
| A3 | Archive declaration | NEW (Phase 4) | no endpoint, no field (admin-questionnaires.controller.ts:328; schema.prisma:871) | - | - | - | none |
| A4 | Restore declaration | NEW (Phase 4) | same | - | - | - | none |
