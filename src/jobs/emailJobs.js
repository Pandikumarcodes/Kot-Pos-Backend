const { JOB_NAMES } = require("../infrastructure/queue");

const emailJobHandlers = ({ emailProvider }) => ({
  [JOB_NAMES.PASSWORD_RESET_EMAIL]: (data) =>
    emailProvider.send({ ...data, template: "password-reset" }),
  [JOB_NAMES.STAFF_INVITATION_EMAIL]: (data) =>
    emailProvider.send({ ...data, template: "staff-invitation" }),
});

module.exports = { emailJobHandlers };
