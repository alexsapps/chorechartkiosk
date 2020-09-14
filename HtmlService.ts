// Setup code for the web app associated with this project.
// https://developers.google.com/apps-script/guides/html#code.gs_1
function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate();
}
function include(filename: string) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

const DEV_WEB_TEST = false;
const WEB_SHEET_ID = DEV_WEB_TEST ? TEST_SHEET_ID : SHEET_ID;

// NOTE for below functions: GAS HtmlService does not accept Date objects
// in inputs and outputs of these functions.

// Note that "Audit Dates"

/**
 * Gets the chore statuses for the given week.
 * @param auditDate The week to get data for, expressed as the due date (such that chores are due the next day at 5AM) in milliseconds since epoch.
 */
function webappGetWeek(auditDate: number) {
  const report = getReport(WEB_SHEET_ID, new Date(auditDate));

  return {
    chores: report.chores
      .map((chore) => ({
          title: chore.description,
          assignee: chore.person.name,
          status: chore.auditWeekStatus,
      })
    )};
}

/**
 * Sets the status for the given chore.
 * @param auditDate The week that chores are due, expressed as the due date (such that chores are due the next day at 5AM) in milliseconds since epoch.
 * @param person The name of the person whose chore should be updated.
 * @param status The status to set for this chore on this week.
 */
function webappUpdateStatus(auditDate: number, person: string, status: string) {
  const tracker = new TrackerModel(getChoresSheet(WEB_SHEET_ID));

  const choresWeek = tracker.getWeek(new Date(auditDate));

  const chore = choresWeek.find(c => c.name === person);
  
  if (chore == null) throw new Error("Could not find " + person);

  chore.statusCell.setValue(status);
}