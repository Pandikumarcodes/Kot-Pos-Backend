const { JOB_NAMES } = require("../infrastructure/queue");
const { requireJobScope } = require("../infrastructure/queue/jobScope");

const reportJobHandlers = ({
  reportService,
  reportRenderer,
  emailProvider,
}) => ({
  [JOB_NAMES.DAILY_SALES_REPORT]: async (data) => {
    const scope = requireJobScope(data);
    const summary = await reportService.getSummary({
      range: "today",
      scope,
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
