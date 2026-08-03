const QUEUE_NAMES = Object.freeze({
  EMAIL: "kot-pos.email",
  INVENTORY_ALERTS: "kot-pos.inventory-alerts",
  REPORTS: "kot-pos.reports",
  CLEANUP: "kot-pos.cleanup",
});

const JOB_NAMES = Object.freeze({
  PASSWORD_RESET_EMAIL: "password-reset-email",
  STAFF_INVITATION_EMAIL: "staff-invitation-email",
  LOW_INVENTORY_ALERT: "low-inventory-alert",
  DAILY_SALES_REPORT: "daily-sales-report",
  CLEANUP: "cleanup",
});

module.exports = { QUEUE_NAMES, JOB_NAMES };
