# J. Notifications

## P1

### J1. Notification Model
- **Schema**:
  ```
  Notification {
    id        UUID
    userId    UUID     // recipient
    type      NotificationType  // NEW_ASSIGNMENT, SUBMISSION_RECEIVED, GRADING_COMPLETE, ANNOUNCEMENT
    title     String
    body      String
    link      String?  // deep link path e.g. "/dashboard/assignments"
    read      Boolean @default(false)
    createdAt DateTime
  }
  ```

### J2. In-App Notifications
- **API**:
  - GET /notifications?unreadOnly=true&limit=20 → paginated list
  - PATCH /notifications/:id/read → mark as read
  - POST /notifications/read-all → mark all as read
  - GET /notifications/count → `{unread: N}`
- **UI**: Bell icon in header with unread badge, dropdown list
- **Triggers**:
  - Teacher creates assignment → notify all classroom students
  - Student submits attempt → notify exam owner
  - Teacher releases results → notify all students with attempts

### J3. Edge Cases
- High-volume classroom (100 students) → batch insert notifications
- Deleted user → cascade delete their notifications
- Notification for deleted entity (deleted assignment) → link shows 404, notification remains readable

---

## P2

### J4. Email Notifications
- Deferred until email service configured
- Use same triggers as in-app, send email in addition
- User preference: `emailNotifications Boolean @default(true)` on User

### J5. Deadline Reminders
- Trigger: 24h and 1h before assignment deadline
- Requires background scheduler (cron or bull queue)
- P2 because it needs infrastructure beyond the current lazy-evaluation pattern
