const TRACKER_STATUS_KEY = 'mailblast-open-2026-very-secret-48291';
const TRACKER_SHEET_NAME = 'MailBlast Opens';
const TRACKER_HEADERS = [
  'id',
  'campaign',
  'email',
  'name',
  'sentAt',
  'firstOpenedAt',
  'lastOpenedAt',
  'openCount',
  'createdAt',
  'updatedAt'
];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'open').toLowerCase();
  if (action === 'register') return respond_(e, registerSend_(e));
  if (action === 'status') return respond_(e, getCampaignStatus_(e));
  return logOpen_(e);
}

function registerSend_(e) {
  if (!hasValidStatusKey_(e)) return { ok: false, error: 'Invalid status key.' };

  const id = param_(e, 'id');
  const campaign = param_(e, 'campaign');
  const email = param_(e, 'email');
  if (!id || !campaign || !email) {
    return { ok: false, error: 'Missing id, campaign, or email.' };
  }

  const sheet = getTrackerSheet_();
  const rowNumber = findRowNumberById_(sheet, id);
  const now = new Date().toISOString();
  const record = [
    id,
    campaign,
    email,
    param_(e, 'name'),
    param_(e, 'sentAt') || now,
    '',
    '',
    0,
    now,
    now
  ];

  if (rowNumber > 1) {
    const existing = normalizeTrackerRow_(sheet.getRange(rowNumber, 1, 1, TRACKER_HEADERS.length).getValues()[0]);
    existing[1] = campaign;
    existing[2] = email;
    existing[3] = param_(e, 'name');
    existing[4] = param_(e, 'sentAt') || existing[4] || now;
    existing[9] = now;
    sheet.getRange(rowNumber, 1, 1, TRACKER_HEADERS.length).setValues([existing]);
  } else {
    sheet.appendRow(record);
  }

  return { ok: true, id: id };
}

function getCampaignStatus_(e) {
  if (!hasValidStatusKey_(e)) return { ok: false, error: 'Invalid status key.' };

  const campaign = param_(e, 'campaign');
  if (!campaign) return { ok: false, error: 'Missing campaign.' };

  const sheet = getTrackerSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, records: [] };

  const rows = sheet.getRange(2, 1, lastRow - 1, TRACKER_HEADERS.length).getValues();
  const records = rows
    .filter(function(row) { return String(row[1] || '') === campaign; })
    .map(function(row) {
      return {
        id: String(row[0] || ''),
        campaign: String(row[1] || ''),
        email: String(row[2] || ''),
        name: String(row[3] || ''),
        sentAt: String(row[4] || ''),
        firstOpenedAt: String(row[5] || ''),
        lastOpenedAt: String(row[6] || ''),
        openedAt: String(row[6] || row[5] || ''),
        openCount: Number(row[7] || 0)
      };
    });

  return { ok: true, records: records };
}

function logOpen_(e) {
  const id = param_(e, 'id');
  if (!id) return transparentPixel_();

  const sheet = getTrackerSheet_();
  const rowNumber = findRowNumberById_(sheet, id);
  if (rowNumber > 1) {
    const range = sheet.getRange(rowNumber, 1, 1, TRACKER_HEADERS.length);
    const row = normalizeTrackerRow_(range.getValues()[0]);
    const now = new Date().toISOString();
    if (!row[5]) row[5] = now;
    row[6] = now;
    row[7] = Number(row[7] || 0) + 1;
    row[9] = now;
    range.setValues([row]);
  }

  return transparentPixel_();
}

function transparentPixel_() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
  return ContentService.createTextOutput(svg).setMimeType(ContentService.MimeType.XML);
}

function respond_(e, payload) {
  const callback = param_(e, 'callback');
  if (callback) {
    const safeCallback = callback.replace(/[^\w$.]/g, '');
    return ContentService
      .createTextOutput(safeCallback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function hasValidStatusKey_(e) {
  return param_(e, 'key') && param_(e, 'key') === TRACKER_STATUS_KEY;
}

function param_(e, key) {
  return String((e && e.parameter && e.parameter[key]) || '').trim();
}

function getTrackerSheet_() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty('TRACKER_SHEET_ID');
  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.create('MailBlast Tracker');
    spreadsheetId = spreadsheet.getId();
    props.setProperty('TRACKER_SHEET_ID', spreadsheetId);
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(TRACKER_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(TRACKER_SHEET_NAME);
  if (sheet.getMaxColumns() < TRACKER_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), TRACKER_HEADERS.length - sheet.getMaxColumns());
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, TRACKER_HEADERS.length).setValues([TRACKER_HEADERS]);
  } else {
    sheet.getRange(1, 1, 1, TRACKER_HEADERS.length).setValues([TRACKER_HEADERS]);
  }
  return sheet;
}

function findRowNumberById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '') === id) return i + 2;
  }
  return -1;
}

function normalizeTrackerRow_(row) {
  if (row.length >= TRACKER_HEADERS.length) return row.slice(0, TRACKER_HEADERS.length);

  const normalized = new Array(TRACKER_HEADERS.length).fill('');
  normalized[0] = row[0] || '';
  normalized[1] = row[1] || '';
  normalized[2] = row[2] || '';
  normalized[3] = row[3] || '';
  normalized[4] = row[4] || '';

  // Backfill rows created before firstOpenedAt/lastOpenedAt existed.
  normalized[5] = row[5] || '';
  normalized[6] = row[5] || '';
  normalized[7] = Number(row[6] || 0);
  normalized[8] = row[7] || new Date().toISOString();
  normalized[9] = row[8] || normalized[8];
  return normalized;
}
