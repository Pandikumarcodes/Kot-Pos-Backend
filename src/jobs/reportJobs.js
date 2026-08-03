const { JOB_NAMES } = require("../infrastructure/queue");

const reportJobHandlers = ({
  reportService,
  reportRenderer,
  emailProvider,
}) => ({
  [JOB_NAMES.DAILY_SALES_REPORT]: async (data) => {
    const summary = await reportService.getSummary({
      range: "today",
      branchFilter: data.branchFilter,
      branchMemberFilter: data.branchMemberFilter,
    });
    const attachment = await reportRenderer(summary, data);
    return emailProvider.send({
      ...data,
      template: "daily-sales-report",
      summary,
      attachment,
    });
  },
});

module.exports = { reportJobHandlers };
