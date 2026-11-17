Requirement status register
===========================

Generated from ``scripts/requirements-register.js``. Every Coursework 1 requirement is listed with its status, code unit and test IDs.

.. list-table::
   :header-rows: 1
   :widths: 8 40 10 42

   * - ID
     - Requirement
     - Status
     - Tests
   * - UR-001
     - Maintain a profile of interests, skills, experience, availability, visibility
     - Implemented
     - TC-API-07, 08; TC-R10
   * - UR-002
     - Create, edit and close a research brief
     - Implemented
     - TC-API-12, 13, 14
   * - UR-003
     - Search projects and profiles with criteria; refine
     - Implemented
     - TC-API-10, 11; TC-R09
   * - UR-004
     - Express interest or invite; see pending/accepted/declined/withdrawn
     - Implemented
     - TC-API-15, 16, 17, 43; TC-R01, R02
   * - UR-005
     - Find a mentor by topic, submit goals; mentors review requests
     - Implemented
     - TC-API-39, 45
   * - UR-006
     - Agree roles, contributions, deadlines, communication, authorship; review revisions
     - Implemented
     - TC-API-18, 41, 42
   * - UR-007
     - Coordinate tasks, milestones, due dates, progress and files privately
     - Implemented
     - TC-API-19..26, 44
   * - UR-008
     - Tasks: 3-20 character title, description <= 250, <= 3 tags
     - Implemented
     - TC-V01..V03; TC-API-20
   * - UR-009
     - Controlled access: nothing exposed to unauthorised people
     - Implemented
     - TC-API-05, 06, 13, 19, 24, 35; TC-E2E-02
   * - UR-010
     - Status notifications; moderator handles reports
     - Implemented
     - TC-API-37, 38, 48, 49, 50; TC-R11
   * - UR-011
     - Optional paid mentoring with transparent terms
     - Deferred
     - -
   * - UR-012
     - Responsive, understandable, accessible, reliable, safe
     - Partial
     - TC-E2E-06, 08, 10; TC-D07, D10
   * - UR-013
     - Subscribe to a tiered plan with a support allowance
     - Simulated
     - TC-API-31, 32, 47; TC-R03
   * - UR-014
     - Admin manages researchers, assignment, eligibility, bonuses, payments
     - Simulated
     - TC-API-33..36; TC-R04..R08
   * - FR-001
     - Register
     - Implemented
     - TC-API-01; TC-E2E-03, 19; TC-V08, V09; TC-VF-01..12
   * - FR-002
     - Login, logout, account recovery
     - Implemented
     - TC-API-03, 05, 54, 55; TC-E2E-09; TC-A02..A04
   * - FR-003
     - Create/edit profile: interests, skills, experience, institution/department
     - Implemented
     - TC-API-08
   * - FR-004
     - Availability, preferred roles, languages, assistance types
     - Implemented
     - TC-API-08
   * - FR-005
     - Profile visibility controls applied when displaying
     - Implemented
     - TC-R10; TC-API-07
   * - FR-006
     - CV/portfolio/publication links subject to privacy
     - Partial
     - TC-API-08
   * - FR-007
     - Create project brief: title, description, question, subject
     - Implemented
     - TC-API-12
   * - FR-008
     - Objectives, stage, methods, skills, roles, time commitment
     - Partial
     - TC-API-12
   * - FR-009
     - Project visibility and what prospective collaborators see
     - Implemented
     - TC-API-13
   * - FR-010
     - Edit, pause or close a listing
     - Implemented
     - TC-API-12, 14
   * - FR-011
     - Basic timeline, milestones, deliverables, resources
     - Partial
     - TC-API-44
   * - FR-012
     - Search or browse projects and profiles
     - Implemented
     - TC-API-10, 11; TC-R09
   * - FR-013
     - Filters: skills, interests, experience, role, language, availability
     - Implemented
     - TC-API-11; TC-R09
   * - FR-014
     - Express interest with a message
     - Implemented
     - TC-API-15
   * - FR-015
     - Owner invites a user
     - Implemented
     - TC-API-43
   * - FR-016
     - Record request status
     - Implemented
     - TC-R01, R02; TC-D04; TC-API-16, 17
   * - FR-017
     - Notify on request status change
     - Implemented
     - TC-API-38, 50
   * - FR-018
     - Browse mentors by subject, topic, expertise
     - Implemented
     - TC-API-45
   * - FR-019
     - Mentor qualifications and verification status
     - Partial
     - TC-API-45
   * - FR-020
     - Submit a mentorship request: goals, stage, guidance
     - Implemented
     - TC-API-39
   * - FR-021
     - Mentors manage request status and availability
     - Implemented
     - TC-API-39, 45
   * - FR-022
     - Session booking (future option)
     - Deferred
     - -
   * - FR-023
     - Team agreement template
     - Implemented
     - TC-API-41
   * - FR-024
     - Authorised members view the current agreement
     - Implemented
     - TC-API-18, 41
   * - FR-025
     - Record acknowledgements or revisions
     - Implemented
     - TC-API-41, 42
   * - FR-026
     - State that an agreement does not replace institutional rules
     - Implemented
     - TC-E2E-07
   * - FR-027
     - Workspace for authorised members only
     - Implemented
     - TC-API-19; TC-E2E-02
   * - FR-028
     - Create/update tasks, milestones, due dates, progress
     - Implemented
     - TC-API-20, 21, 44
   * - FR-029
     - Upload/access files with permissions and limits
     - Implemented
     - TC-API-22..25; TC-V04..V06; TC-D03; TC-A05
   * - FR-030
     - Display task and milestone status clearly
     - Implemented
     - TC-E2E-04
   * - FR-031
     - Timestamps and basic history of important updates
     - Implemented
     - TC-API-21, 48
   * - FR-032
     - Prevent unauthorised access to private workspace content
     - Implemented
     - TC-API-19, 24; TC-E2E-02
   * - FR-033
     - Notifications for invitations, requests, status changes
     - Implemented
     - TC-API-38, 50
   * - FR-034
     - Manage non-essential notification preferences
     - Implemented
     - TC-R11; TC-API-38, 50
   * - FR-035
     - Notifications do not expose confidential detail
     - Implemented
     - TC-API-38
   * - FR-036
     - Admins review reports and apply policy actions
     - Implemented
     - TC-API-37, 49
   * - FR-037
     - Record and display credential-verification status
     - Partial
     - TC-API-48
   * - FR-038
     - Audit record of sensitive administrative actions
     - Implemented
     - TC-API-34, 36, 48
   * - FR-039
     - Paid mentoring terms shown before booking (future)
     - Deferred
     - -
   * - FR-040
     - Approved payment provider; no raw card details
     - Simulated
     - TC-API-32
   * - FR-041
     - Communicate booking/payment status (future)
     - Deferred
     - -
   * - FR-042
     - Task title 3-20 characters
     - Implemented
     - TC-V01; TC-API-20
   * - FR-043
     - Optional task description <= 250 characters
     - Implemented
     - TC-V02; TC-API-20
   * - FR-044
     - At most three tags per task
     - Implemented
     - TC-V03; TC-API-20
   * - FR-045
     - Variable subscription plans with fixed period, rate, allowance
     - Simulated
     - TC-API-31; TC-R03
   * - FR-046
     - Store subscription status and billing events
     - Simulated
     - TC-API-32, 47
   * - FR-047
     - Apply the request restriction of the current plan
     - Implemented
     - TC-API-31; TC-R03
   * - FR-048
     - Researchers pay no fee and take no direct student payments
     - Implemented
     - TC-API-46
   * - FR-049
     - Admins approve researchers, log expertise and availability, set status
     - Implemented
     - TC-API-36, 48
   * - FR-050
     - Forward eligible requests to researchers by expertise, availability and workload
     - Implemented
     - TC-API-40, 46
   * - FR-051
     - Document assignments and transitions; count only eligible completions
     - Implemented
     - TC-API-40; TC-R06
   * - FR-052
     - Record feedback and link to researcher and period
     - Implemented
     - TC-API-40
   * - FR-053
     - Configurable bonus formula: 70% requests, 30% feedback, caps, minimum feedback
     - Implemented
     - TC-R04, R05, R06
   * - FR-054
     - Eligibility and inactivity assessment
     - Implemented
     - TC-R06, R07
   * - FR-055
     - Keep base pay, bonus rules, period and statement
     - Implemented
     - TC-D05; TC-API-33
   * - FR-056
     - Payment approvals, payout status, failed payouts, audit trail
     - Simulated
     - TC-API-33, 34; TC-R08
   * - NFR-001
     - Role and membership permissions
     - Implemented
     - TC-API-05, 06, 13, 19, 24, 25, 35; TC-E2E-02
   * - NFR-002
     - Salted password hashing; no raw passwords in logs
     - Implemented
     - TC-A01, A02; TC-API-02, 04
   * - NFR-003
     - HTTPS/TLS in deployed environments
     - Implemented
     - TC-API-57, 58
   * - NFR-004
     - Input validation; injection, XSS, access control
     - Implemented
     - TC-V07; TC-API-03, 10, 30, 59; TC-PG03; TC-E2E-05
   * - NFR-005
     - Privacy notice; data minimisation
     - Implemented
     - TC-API-07
   * - NFR-006
     - Document deletion and retention; review/update profile
     - Implemented
     - TC-API-08, 09
   * - NFR-007
     - Validate input; understandable errors
     - Implemented
     - TC-V01..V09; TC-API-01, 20; TC-E2E-03
   * - NFR-008
     - Backups; RPO 24 h, RTO 4 h; restore evidence
     - Implemented
     - TC-D10
   * - NFR-009
     - Only legitimate transitions; concurrent loser rejected
     - Implemented
     - TC-R01; TC-D04, D11; TC-API-16, 17
   * - NFR-010
     - Report saves; communicate issues
     - Implemented
     - TC-D07, D08; TC-API-26, 27, 53
   * - NFR-011
     - Responsive layouts
     - Implemented
     - TC-E2E-06
   * - NFR-012
     - Consistent language and status wording
     - Partial
     - TC-CS-01, 02, 03
   * - NFR-013
     - Keyboard, focus, labels, contrast
     - Partial
     - TC-E2E-08, 10
   * - NFR-014
     - Test core workflows with representative users
     - Partial
     - -
   * - NFR-015
     - Pagination
     - Implemented
     - TC-API-10, 56; TC-R09
   * - NFR-016
     - Logs contain no passwords, tokens or file contents
     - Implemented
     - TC-API-04
   * - NFR-017
     - Separable modules with independent tests
     - Implemented
     - see Traceability in docs/TEST_PLAN.md
   * - NFR-018
     - 50 users: 95 % within 2 s; uploads <= 10 MB; availability, RPO/RTO
     - Partial
     - TC-API-22; load test
