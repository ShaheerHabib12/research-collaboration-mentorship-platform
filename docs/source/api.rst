HTTP API reference
==================

All endpoints are under ``/api``, exchange JSON and need an ``Authorization: Bearer <token>`` header except the public ones. Status codes and examples are in ``docs/API.md``.

.. list-table::
   :header-rows: 1
   :widths: 12 88

   * - Method
     - Path
   * - POST
     - ``/api/auth/register``
   * - POST
     - ``/api/auth/verify``
   * - POST
     - ``/api/auth/resend``
   * - POST
     - ``/api/auth/login``
   * - POST
     - ``/api/auth/forgot``
   * - POST
     - ``/api/auth/reset``
   * - POST
     - ``/api/assistant``
   * - POST
     - ``/api/auth/logout``
   * - GET
     - ``/api/me``
   * - GET
     - ``/api/summary``
   * - GET
     - ``/api/profile``
   * - PUT
     - ``/api/profile``
   * - GET
     - ``/api/profiles/:id``
   * - GET
     - ``/api/me/export``
   * - DELETE
     - ``/api/me``
   * - GET
     - ``/api/dashboard``
   * - GET
     - ``/api/projects/search``
   * - GET
     - ``/api/people/search``
   * - GET
     - ``/api/projects``
   * - POST
     - ``/api/projects``
   * - GET
     - ``/api/projects/:id``
   * - PUT
     - ``/api/projects/:id``
   * - POST
     - ``/api/projects/:id/status``
   * - POST
     - ``/api/projects/:id/interest``
   * - POST
     - ``/api/projects/:id/invitations``
   * - GET
     - ``/api/requests``
   * - POST
     - ``/api/requests/:id/act``
   * - GET
     - ``/api/projects/:id/agreement``
   * - PUT
     - ``/api/projects/:id/agreement``
   * - POST
     - ``/api/projects/:id/agreement/acknowledge``
   * - POST
     - ``/api/projects/:id/agreement/proposals``
   * - POST
     - ``/api/projects/:id/agreement/proposals/:pid``
   * - GET
     - ``/api/projects/:id/workspace``
   * - POST
     - ``/api/projects/:id/tasks``
   * - PUT
     - ``/api/projects/:id/tasks/:tid``
   * - POST
     - ``/api/projects/:id/tasks/:tid/move``
   * - DELETE
     - ``/api/projects/:id/tasks/:tid``
   * - POST
     - ``/api/projects/:id/milestones``
   * - POST
     - ``/api/projects/:id/milestones/:mid/toggle``
   * - GET
     - ``/api/projects/:id/files/:fid``
   * - GET
     - ``/api/projects/:id/files/:fid/content``
   * - DELETE
     - ``/api/projects/:id/files/:fid``
   * - GET
     - ``/api/mentors/search``
   * - PUT
     - ``/api/mentors/accepting``
   * - POST
     - ``/api/mentorship-requests``
   * - GET
     - ``/api/mentorship-requests``
   * - POST
     - ``/api/mentorship-requests/:id/act``
   * - POST
     - ``/api/support``
   * - GET
     - ``/api/support``
   * - POST
     - ``/api/support/:id/act``
   * - POST
     - ``/api/support/:id/feedback``
   * - GET
     - ``/api/subscription``
   * - POST
     - ``/api/subscription``
   * - POST
     - ``/api/subscription/settle``
   * - DELETE
     - ``/api/subscription``
   * - GET
     - ``/api/statements``
   * - POST
     - ``/api/statements/:id/act``
   * - GET
     - ``/api/admin/overview``
   * - GET
     - ``/api/admin/researchers``
   * - PATCH
     - ``/api/admin/researchers/:id``
   * - POST
     - ``/api/reports``
   * - POST
     - ``/api/contact``
   * - GET
     - ``/api/admin/contact``
   * - POST
     - ``/api/admin/contact/:id/status``
   * - GET
     - ``/api/admin/reports``
   * - POST
     - ``/api/admin/reports/:id/act``
   * - GET
     - ``/api/admin/audit``
   * - GET
     - ``/api/notifications``
   * - POST
     - ``/api/notifications/:id/read``
   * - GET
     - ``/api/notification-prefs``
   * - PUT
     - ``/api/notification-prefs``
