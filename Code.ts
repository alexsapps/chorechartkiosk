// Preconditions:
// There is a sheet named "Weekly chores" in the spreadsheet.
//
// Row 1 is a header row. Starting at A3, it contains consecutive increasing dates spaced one week apart.
// The day of the week is arbitrary but it must be the same.
//
// Column A is hyperlinks of residents. Link text = name, link URL = mailto email.

const NAMES_AND_EMAILS_RANGE = "A2:A";
const CHORE_TITLES_RANGE = "B2:B";
const DATE_COLUMN_HEADERS_RANGE = "C1:1";
// How many rows of chores there should be available on the sheet (not necessarily populated).
const MIN_ROWS = 30;
// How many status columns should be available on the sheet (past, present and future).
const MIN_STATUS_COLUMNS = 10;
// How many old weeks can be kept around for historical purposes.
const MAX_OLD_COLUMNS = 2;
// Width of the longest valid value in a date/status column.
const STATUS_COLUMN_WIDTH = 185;

const VIEW_CHORE_CHART_FOOTER = "View the chore chart here: " +
    "https://docs.google.com/spreadsheets/d/1WMIcfodqfqXMQ8dhwvIFiTVN_dcZV0qOGUydxRp9hSU/edit#gid=0";

const SHEET_ID = "1WMIcfodqfqXMQ8dhwvIFiTVN_dcZV0qOGUydxRp9hSU";  // https://docs.google.com/spreadsheets/d/1WMIcfodqfqXMQ8dhwvIFiTVN_dcZV0qOGUydxRp9hSU/edit#gid=0

const TEST_SHEET_ID = "1HLcJK_IHJ0OUfVlzLNJCJrgKW9A4thmhblTpp0avLaw";  // https://docs.google.com/spreadsheets/d/1HLcJK_IHJ0OUfVlzLNJCJrgKW9A4thmhblTpp0avLaw/edit#gid=0
// Audit date used for tests.
const TEST_DATE = new Date(2020, 5 - 1 /* js sucks */, 10);

// Setup code for the web app associated with this project.
// https://developers.google.com/apps-script/guides/html#code.gs_1
function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate();
}
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

// Performs the weekly audit and prepares for next week.
//
// The audit must be run two days following the due date specified in the column header.
// (This gives housemates at least one extra day to mark chores off on the chart.)
function weeklyAudit(e, sheetId = SHEET_ID, auditDate = addDays(today(), -2)) { 
  fillEmptyCells(sheetId, auditDate);
  if (!isDisabled(sheetId)) {
    sendEmailReport(getReport(sheetId, auditDate));
  }
  prepareNextWeek(sheetId, addWeeks(auditDate, 1));
}

function TEST_weeklyAudit() {
  const auditDate = TEST_DATE;
  // Pass 0 instead of null: https://issuetracker.google.com/issues/149636786
  weeklyAudit(0, TEST_SHEET_ID, auditDate);
}

// Sends individual reminder emails only to people
// who haven't finished this week's chores yet.
// Indicates when they missed the previous week's chores.
//
// Email reminders must be sent on the of the due date. When it is run, it looks for a column
// with today's date.
function sendChoreReminders(e, sheetId = SHEET_ID, auditDate = today()) {
  if (isDisabled(sheetId)) return;

  const report = getReport(sheetId, auditDate);
  const SUBJECT = "You have chores due. Dingo needs you!";

  for (let chore of report.chores) {
    if (chore.auditWeekStatus !== '') continue;
    if (chore.person.email === '') continue;

    let body = '';
    body += `Please remember to do you chores (${chore.description}) and update the online chore chart.`;
    body += '\n\n' + VIEW_CHORE_CHART_FOOTER;
    MailApp.sendEmail(chore.person.email, SUBJECT, body);
  }
}

function TEST_sendChoreReminders() {
  const auditDate = TEST_DATE;
  sendChoreReminders(null, TEST_SHEET_ID, auditDate);
}

// Sends everyone with any chores a reminder to update the chore chart,
// if any cells are blank.
// The message may imply that chores are already due and the chart should
// merely be updated before the report goes out.
function sendUpdateChartReminders(_: any, sheetId = SHEET_ID, auditDate = addDays(today(), -1)) {
  if (isDisabled(sheetId)) return;

  const report = getReport(sheetId, auditDate);
  const chores = report.chores;

  const emptyStatusChores = chores.filter(c => c.auditWeekStatus === '');
  
  // No email is sent if every chore's status is already set.
  if (emptyStatusChores.length === 0) return;
  
  // Email is sent to everyone who has chores.
  const recipients = chores.map(chore => chore.person.email).filter(email => email !== '').join(',');
  
  const emptyStatusPeople = emptyStatusChores.map(c => c.person.name).join(', ');
  
  const SUBJECT = "Please update the chore chart";
  
  let body = `Did ${emptyStatusPeople} do their chores?\n\n`;
  body += 'Forget not to update the chart! The final report will be sent out soon.';
  body += "\n\n" + VIEW_CHORE_CHART_FOOTER;
  
  Logger.log({recipients, SUBJECT, body});
  MailApp.sendEmail(recipients, SUBJECT, body);
}

function TEST_sendChartUpdateReminders() {
  const auditDate = TEST_DATE;
  sendUpdateChartReminders(null, TEST_SHEET_ID, auditDate);
}

// Sends a chore audit report to everyone for the given due date for a week of chores.
// Includes who did their chores and who didn't.
// Also, indicates who missed two weeks in a row.
function sendEmailReport(report) {
  const chores = report.chores;
  const recipients = chores.map(chore => chore.person.email).filter(email => email !== '').join(',');
  if (recipients.length === 0) return;  // Can happen if no one has chores.
  
  const maxLate = Math.max(...chores.map(c => c.late));
  
  let subject = "Dingo chores report for " + report.auditDate.toLocaleDateString("en-US");
  if (maxLate === 0) {
    subject += ": no one late";
  } else if (maxLate === 1) {
    subject += ": some people are late";
  } else if (maxLate === 2) {
    subject += ": some people were late twice!";
  }
  
  let body = "";
  for (const chore of chores) {
    const status = chore.auditWeekStatus + (chore.late === 2 ? " - Late twice in a row!" : "");
    body += `${chore.person.name} - ${chore.description} - ${status}`;
    body += "\n";
  }

  body += "\n" + "These chores were due in the most wee hours of the night of " + report.auditDate.toLocaleDateString("en-US") + ".\n";
  body += "\n" + VIEW_CHORE_CHART_FOOTER;
  
  Logger.log({recipients, subject, body});
  MailApp.sendEmail(recipients, subject, body);
}

function dateOnly(date: Date) {
  const newDate = new Date(date);
  newDate.setHours(0,0,0,0);  // Remove time from current date.
  return newDate;
}

function today() {
  return dateOnly(new Date());
}
              
function addDays(date: Date, numDays: number) {
  const newDate = dateOnly(date);
  // Subtract 1 calendar day.
  newDate.setDate(newDate.getDate() + numDays);
  return newDate;
}
              
function isDisabled(sheetId) {
  const sheet = getConfigSheet(sheetId);

  return sheet.getRange("B1").getValue() === true;
}

// Reports on chores for the week specified by auditDate - who was on time,
// who was late, and who was late twice in a row.
// Returns an array of { person: { name: string, email: string }, late: number }
// where `late` is 0 if not late, 1 if late this week only, and 2 if late twice
// in a row.
function getReport(sheetId, auditDate) {
  const sheet = getChoresSheet(sheetId);
  
  // Get the list of dates in the column headers.
  const dates = sheet.getRange(DATE_COLUMN_HEADERS_RANGE)
      .getValues()[0] /* 2D array has only one row; just get the row */;
  
  // Find the column for the audit date.
  const dateColumn = dates.findIndex(v => v.getTime() === auditDate.getTime());
  if (dateColumn === -1) throw new Error(`Could not find column for audit date of ${auditDate}.`);
  const previousDateColumn = dateColumn - 1;
  if (previousDateColumn < 0) throw new Error('Previous week column must be to the left of the audit date, but the audit date is already on the left edge of the sheet.');
  const previousWeek = addWeeks(auditDate, -1);
  if (dates[previousDateColumn].getTime() !== previousWeek.getTime()) throw new Error(`Column on left of audit date column should be previous week, but it is not. Expected ${previousWeek}, got ${dates[previousDateColumn]}`);
  
  // Get all names and emails.
  const personCells = sheet.getRange(NAMES_AND_EMAILS_RANGE).getRichTextValues()
      // Flatten 2D array with 1 column into a 1D array.
      .map(a => a[0]);

  // Get the names of the chores. Parallel array with `personCells`.
  const choreDescriptions = sheet.getRange(CHORE_TITLES_RANGE).getValues()
      // Flatten 2D array with 1 column into a 1D array.
      .map(a => a[0]);
  
  // Get two full columns of statuses for the audit week and the previous week.
  const statuses = sheet.getSheetValues(2, 3 + previousDateColumn, personCells.length, 2);

  const chores = [];

  // Iterate through people in column A.
  for (let i = 0; i < personCells.length; i++) {
    const personCell = personCells[i];
    if (personCell.getText() === '') continue;
    
    // First, extract email and name for each row.
    const name = personCell.getText();
    const linkUrl = personCell.getLinkUrl();
    let email = '';
    if (linkUrl != null && linkUrl.startsWith("mailto:")) {
      email = linkUrl.substring(7);
    }
              
    // Get chore from parallel array.
    const description = choreDescriptions[i];
    if (description === '') continue;  // Skip if no chore assigned.
    
    const lastWeekStatus = statuses[i][0];
    const auditWeekStatus = statuses[i][1];
    
    let late = 0;
    if (isLate(auditWeekStatus)) {
      late = 1; 
      if (isLate(lastWeekStatus)) {
        late = 2;
      }
    }
    
    chores.push({
      person: {
        name,
        email,
      },
      description,
      late,
      auditWeekStatus,
    });
  }
  
  return {auditDate, chores};
}

function addWeeks(date, numWeeks) {
  const previousWeek = new Date(date.getTime());
  previousWeek.setDate(previousWeek.getDate() + (7 * numWeeks));
  return previousWeek;
}

function isLate(status) {
  return status === '' || status === 'Done (unexcused late)' || status === 'Pending (unexcused late)';
}

// Make explicit the status of empty cells. If a person has chores
// and they didn't update the chart, mark them as late. If they
// don't have chores, mark them as pardoned.
function fillEmptyCells(sheetId, auditDate) {
  const sheet = getChoresSheet(sheetId);
  
  // Get the list of dates in the column headers.
  const dates = sheet.getRange(DATE_COLUMN_HEADERS_RANGE)
      .getValues()[0] /* 2D array has only one row; just get the row */;
  
  // Find the column for the audit date.
  const dateColumn = dates.findIndex(v => v.getTime() === auditDate.getTime());
  if (dateColumn === -1) throw new Error(`Could not find column for audit date of ${auditDate}.`);

  // Get all names and emails.
  const personCells = sheet.getRange(NAMES_AND_EMAILS_RANGE).getValues()
      // Flatten 2D array with 1 column into a 1D array.
      .map(a => a[0]);
  // Get the names of the chores. Parallel array with `personCells`.
  const choreDescriptions = sheet.getRange(CHORE_TITLES_RANGE).getValues()
      // Flatten 2D array with 1 column into a 1D array.
      .map(a => a[0]);

  const statusesRange = sheet.getRange(2, 3 + dateColumn, personCells.length, 1);
  const statuses = statusesRange.getValues();
  for (let i = 0; i < statuses.length; i++) {
    // Skip if there is no person / chore on this row.
    if (personCells[i] === '') continue;

    // Person has no chores assigned.
    if (choreDescriptions[i] === '') {
      if (statuses[i][0] === '') {
        statuses[i][0] = 'Pardoned';
      }
      continue;
    }

    if (statuses[i][0] === '') {
      statuses[i][0] = 'Pending (unexcused late)';
    }
  }
  statusesRange.setValues(statuses);
}

// Prepares the spreadsheet for another week of chores.
// - Removes old columns to prevent sheet from becoming too large and prevent needless scrolling. Keeps some weeks' history around.
// - Adds columns for the next audit date with data validation.
// - Also add columns for several future weeks after the next audit date so people can be excused in advance. 
// - Add rows in case any rows were deleted due to move outs. (Users can delete rows in the protected sheet, but not add new ones.)
function prepareNextWeek(sheetId, nextAuditDate) {
  const sheet = getChoresSheet(sheetId);

  // Delete old columns.
  // Keep the next audit date, any future weeks, and two previous weeks around.
  const oldestDate = addWeeks(nextAuditDate, -MAX_OLD_COLUMNS);
  // Work backwards from the end so we don't mess up the indexing.
  for (let i = sheet.getMaxColumns(); i > 2; i--) {
    const dateValue = sheet.getRange(1, i).getValue();
    if (dateValue instanceof Date && dateValue.getTime() < oldestDate.getMilliseconds()) {
      sheet.deleteColumn(i);
    }
  }

  if (sheet.getMaxColumns() < 2 + MIN_STATUS_COLUMNS) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 2 + MIN_STATUS_COLUMNS - sheet.getMaxColumns());
  }
        
  // Add new columns.
  let lastDate = '';
  for (let i = 3; i <= 2 + MIN_STATUS_COLUMNS; i++) {
    let dateValue = sheet.getRange(1, i).getValue();
    if (dateValue === '' && lastDate !== '') {
      dateValue = addWeeks(lastDate, 1);
      sheet.getRange(1,i).setValue(dateValue);
    }
  }
  // Set widths to fit the longest valid values.
  sheet.setColumnWidths(3, sheet.getMaxColumns() - 2, STATUS_COLUMN_WIDTH);

  // Add new rows.
  const rowsToInsert = 1 + MIN_ROWS - sheet.getMaxRows();
  if (rowsToInsert > 0) {
    sheet.insertRows(sheet.getMaxRows(), rowsToInsert);
  }
  
  // Color all columns gray except the next week so people don't edit the wrong column next week on accident.
  sheet.getRange(1,3,sheet.getMaxRows(), sheet.getMaxColumns()-2).setBackground('#bbbbbb');
  for (let i = 3; i <= sheet.getMaxColumns(); i++) {
    const dateValue = sheet.getRange(1, i).getValue();
    if (dateValue instanceof Date && dateValue.getTime() === nextAuditDate.getTime()) {
      sheet.getRange(1,i,sheet.getMaxRows(),1).setBackground(null);
      break;
    }
  }
}
        
function getSheetByName(sheetId, name) {
  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(name);
  if (sheet == null) throw new Error('Could not find the "Chores" sheet.');

  return sheet;
}
        
function getChoresSheet(sheetId) {
  return getSheetByName(sheetId, "Weekly chores");
}

function getConfigSheet(sheetId) {
  return getSheetByName(sheetId, "Configuration");
}