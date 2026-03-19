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
  'firstClickedAt',
  'lastClickedAt',
  'clickCount',
  'lastClickedUrl',
  'createdAt',
  'updatedAt',
  'senderEmail',
  'senderName',
  'provider',
  'subject'
];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'open').toLowerCase();
  if (action === 'register') return respond_(e, registerSend_(e));
  if (action === 'status') return respond_(e, getCampaignStatus_(e));
  if (action === 'history') return respond_(e, getSenderHistory_(e));
  if (action === 'click') return logClickRedirect_(e);
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
    '',
    '',
    0,
    '',
    now,
    now,
    normalizeEmail_(param_(e, 'senderEmail')),
    param_(e, 'senderName'),
    param_(e, 'provider'),
    param_(e, 'subject')
  ];

  if (rowNumber > 1) {
    const existing = normalizeTrackerRow_(sheet.getRange(rowNumber, 1, 1, TRACKER_HEADERS.length).getValues()[0]);
    existing[1] = campaign;
    existing[2] = email;
    existing[3] = param_(e, 'name');
    existing[4] = param_(e, 'sentAt') || existing[4] || now;
    existing[13] = now;
    existing[14] = normalizeEmail_(param_(e, 'senderEmail'));
    existing[15] = param_(e, 'senderName');
    existing[16] = param_(e, 'provider');
    existing[17] = param_(e, 'subject');
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
        openCount: Number(row[7] || 0),
        firstClickedAt: String(row[8] || ''),
        lastClickedAt: String(row[9] || ''),
        clickedAt: String(row[9] || row[8] || ''),
        clickCount: Number(row[10] || 0),
        lastClickedUrl: String(row[11] || '')
      };
    });

  return { ok: true, records: records };
}

function getSenderHistory_(e) {
  if (!hasValidStatusKey_(e)) return { ok: false, error: 'Invalid status key.' };

  const senderEmail = normalizeEmail_(param_(e, 'senderEmail'));
  const viewer = senderEmail
    ? { email: senderEmail, name: '' }
    : getViewerFromAccessToken_(param_(e, 'token'));
  if (!viewer || !viewer.email) {
    return { ok: false, error: 'Missing sender email for tracking history.' };
  }

  const sheet = getTrackerSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, email: viewer.email, campaigns: [] };

  const rows = sheet.getRange(2, 1, lastRow - 1, TRACKER_HEADERS.length).getValues();
  const normalizedSenderEmail = normalizeEmail_(viewer.email);
  var campaignsById = {};

  rows.forEach(function(rawRow) {
    const row = normalizeTrackerRow_(rawRow);
    if (normalizeEmail_(row[14]) !== normalizedSenderEmail) return;

    const campaignId = String(row[1] || '');
    if (!campaignId) return;

    if (!campaignsById[campaignId]) {
      campaignsById[campaignId] = {
        id: campaignId,
        createdAt: String(row[12] || ''),
        lastSyncedAt: String(row[13] || ''),
        senderEmail: String(row[14] || ''),
        senderName: String(row[15] || ''),
        provider: String(row[16] || ''),
        records: []
      };
    }

    campaignsById[campaignId].records.push({
      id: String(row[0] || ''),
      email: String(row[2] || ''),
      name: String(row[3] || ''),
      subject: String(row[17] || ''),
      sentAt: String(row[4] || ''),
      firstOpenedAt: String(row[5] || ''),
      lastOpenedAt: String(row[6] || ''),
      openedAt: String(row[6] || row[5] || ''),
      openCount: Number(row[7] || 0),
      firstClickedAt: String(row[8] || ''),
      lastClickedAt: String(row[9] || ''),
      clickedAt: String(row[9] || row[8] || ''),
      clickCount: Number(row[10] || 0),
      lastClickedUrl: String(row[11] || '')
    });

    if (String(row[13] || '') > String(campaignsById[campaignId].lastSyncedAt || '')) {
      campaignsById[campaignId].lastSyncedAt = String(row[13] || '');
    }
  });

  const campaigns = Object.keys(campaignsById)
    .map(function(campaignId) { return campaignsById[campaignId]; })
    .sort(function(a, b) {
      return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
    });

  return { ok: true, email: viewer.email, campaigns: campaigns };
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
    row[13] = now;
    range.setValues([row]);
  }

  return transparentPixel_();
}

function logClickRedirect_(e) {
  const id = param_(e, 'id');
  const destination = param_(e, 'url');
  if (!id) return redirectOutput_(destination);

  const sheet = getTrackerSheet_();
  const rowNumber = findRowNumberById_(sheet, id);
  if (rowNumber > 1) {
    const range = sheet.getRange(rowNumber, 1, 1, TRACKER_HEADERS.length);
    const row = normalizeTrackerRow_(range.getValues()[0]);
    const now = new Date().toISOString();
    if (!row[8]) row[8] = now;
    row[9] = now;
    row[10] = Number(row[10] || 0) + 1;
    row[11] = destination;
    row[13] = now;
    range.setValues([row]);
  }

  return redirectOutput_(destination);
}

function transparentPixel_() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
  return ContentService.createTextOutput(svg).setMimeType(ContentService.MimeType.XML);
}

function redirectOutput_(url) {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) {
    return HtmlService.createHtmlOutput('<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:16px">Invalid tracking link.</body></html>');
  }

  const escaped = escapeHtml_(target);
  return HtmlService
    .createHtmlOutput(
      '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=' + escaped + '">' +
      '<script>window.location.replace(' + JSON.stringify(target) + ');</script></head>' +
      '<body style="font-family:Arial,sans-serif;padding:16px">Redirecting... <a href="' + escaped + '">Continue</a></body></html>'
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getViewerFromAccessToken_(token) {
  if (!token) return null;
  try {
    const resp = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return null;
    const payload = JSON.parse(resp.getContentText() || '{}');
    const email = normalizeEmail_(payload.email);
    if (!email) return null;
    return {
      email: email,
      name: String(payload.name || '')
    };
  } catch (err) {
    return null;
  }
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
  const normalized = new Array(TRACKER_HEADERS.length).fill('');
  if (!row || !row.length) return normalized;

  if (row.length >= TRACKER_HEADERS.length) {
    for (var i = 0; i < TRACKER_HEADERS.length; i++) normalized[i] = row[i];
    normalized[7] = Number(normalized[7] || 0);
    normalized[10] = Number(normalized[10] || 0);
    return normalized;
  }

  if (row.length >= 14) {
    normalized[0] = row[0] || '';
    normalized[1] = row[1] || '';
    normalized[2] = row[2] || '';
    normalized[3] = row[3] || '';
    normalized[4] = row[4] || '';
    normalized[5] = row[5] || '';
    normalized[6] = row[6] || '';
    normalized[7] = Number(row[7] || 0);
    normalized[12] = row[8] || new Date().toISOString();
    normalized[13] = row[9] || normalized[12];
    normalized[14] = row[10] || '';
    normalized[15] = row[11] || '';
    normalized[16] = row[12] || '';
    normalized[17] = row[13] || '';
    return normalized;
  }

  if (row.length === 10) {
    for (var j = 0; j < row.length; j++) normalized[j] = row[j];
    normalized[7] = Number(normalized[7] || 0);
    normalized[10] = Number(normalized[10] || 0);
    return normalized;
  }

  normalized[0] = row[0] || '';
  normalized[1] = row[1] || '';
  normalized[2] = row[2] || '';
  normalized[3] = row[3] || '';
  normalized[4] = row[4] || '';

  // Backfill rows created before firstOpenedAt/lastOpenedAt existed.
  normalized[5] = row[5] || '';
  normalized[6] = row[5] || '';
  normalized[7] = Number(row[6] || 0);
  normalized[12] = row[7] || new Date().toISOString();
  normalized[13] = row[8] || normalized[12];
  return normalized;
}
