# ΔXE Kiosk and Chore Chart

This Apps Script project automatically maintains a weekly chore chart in a Google Sheet. The chore chart is for community houses to keep track of who household cleaning and maintenance chores are assigned to and the status of those chores getting done for each week. Every week, housemates check off their chores when they're done so it is easy to see who isn't doing chores on time. This project also hosts a web app that can be displayed on a kiosk that makes it easier for housemates to check off their chores as an alternative to opening a sheet on their phones.

## Development

### Setup

`npm install` to install dependencies listed in `appsscript.json` that are not checked into Git.

### Syncing with Apps Script

Requires [`clasp`](https://developers.google.com/apps-script/guides/clasp).

`clasp push` to upload to Apps Script. Automatically compiles TypeScript files into JavaScript.

`clasp push -w` to upload and watch

`clasp pull` to download changes from Apps Script.

### Apps Script setup

- The chore chart is a Google Sheet linked to from the Apps Script code.
- The Apps Script project is not contained in this sheet because there is also a test sheet.
- The Apps Script code includes a web app served by the Apps Script HTML Service.
- Apps Script triggers are used to automatically maintain and audit the chore chart.
- The sheets and triggers are on Alex's alt Google account.
