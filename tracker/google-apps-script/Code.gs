const TRACKER_STATUS_KEY = 'mailblast-open-2026-very-secret-48291';
const TRACKER_SHEET_NAME = 'MailBlast Opens';
const TRACKER_OPEN_DEDUPE_WINDOW_MS = 8 * 1000;
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
  'subject',
  'deliveryState',
  'lastDeliveryUpdateAt'
];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'open').toLowerCase();
  if (action === 'register') return respond_(e, registerSend_(e));
  if (action === 'status') return respond_(e, getCampaignStatus_(e));
  if (action === 'history') return respond_(e, getSenderHistory_(e));
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
  const deliveryState = normalizeDeliveryState_(param_(e, 'deliveryState'));
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
    param_(e, 'subject'),
    deliveryState,
    now
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
    existing[18] = deliveryState || normalizeDeliveryState_(existing[18]);
    existing[19] = now;
    sheet.getRange(rowNumber, 1, 1, TRACKER_HEADERS.length).setValues([existing]);
  } else {
    sheet.appendRow(record);
  }

  return { ok: true, id: id, deliveryState: deliveryState };
}

function getCampaignStatus_(e) {
  if (!hasValidStatusKey_(e)) return { ok: false, error: 'Invalid status key.' };

  const campaign = param_(e, 'campaign');
  if (!campaign) return { ok: false, error: 'Missing campaign.' };

  const sheet = getTrackerSheet_();
  const rowNumbers = getMatchingRowNumbersByColumnValue_(sheet, 2, campaign);
  if (!rowNumbers.length) return { ok: true, records: [] };

  const records = getTrackerRowsByNumber_(sheet, rowNumbers)
    .map(function(row) {
      return buildTrackerStatusRecord_(row);
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
  const rowNumbers = getMatchingRowNumbersByColumnValue_(sheet, 15, viewer.email);
  if (!rowNumbers.length) return { ok: true, email: viewer.email, campaigns: [] };

  const rows = getTrackerRowsByNumber_(sheet, rowNumbers);
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

    campaignsById[campaignId].records.push(buildTrackerStatusRecord_(row));

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
    if (normalizeDeliveryState_(row[18]) === 'failed') return transparentPixel_();
    const now = new Date().toISOString();
    const lastOpenMs = Date.parse(String(row[6] || row[5] || ''));
    const nowMs = Date.parse(now);
    const withinDedupeWindow = Number.isFinite(lastOpenMs) && Number.isFinite(nowMs) && (nowMs - lastOpenMs) <= TRACKER_OPEN_DEDUPE_WINDOW_MS;
    if (!withinDedupeWindow) {
      if (!row[5]) row[5] = now;
      row[6] = now;
      row[7] = Number(row[7] || 0) + 1;
      row[13] = now;
      range.setValues([row]);
    }
  }

  return transparentPixel_();
}

function transparentPixel_() {
  const svg = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="transparent"/></svg>';
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

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDeliveryState_(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'failed') return 'failed';
  if (normalized === 'queued') return 'queued';
  return 'sent';
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
  } else if (trackerHeadersNeedRefresh_(sheet)) {
    sheet.getRange(1, 1, 1, TRACKER_HEADERS.length).setValues([TRACKER_HEADERS]);
  }
  return sheet;
}

function findRowNumberById_(sheet, id) {
  const matches = getMatchingRowNumbersByColumnValue_(sheet, 1, id);
  return matches.length ? matches[0] : -1;
}

function trackerHeadersNeedRefresh_(sheet) {
  const currentHeaders = sheet.getRange(1, 1, 1, TRACKER_HEADERS.length).getValues()[0] || [];
  for (var i = 0; i < TRACKER_HEADERS.length; i++) {
    if (String(currentHeaders[i] || '') !== TRACKER_HEADERS[i]) return true;
  }
  return false;
}

function getMatchingRowNumbersByColumnValue_(sheet, columnIndex, value) {
  const normalizedValue = String(value || '').trim();
  const lastRow = sheet.getLastRow();
  if (!normalizedValue || lastRow < 2) return [];

  const range = sheet.getRange(2, columnIndex, lastRow - 1, 1);
  const finder = range.createTextFinder(normalizedValue)
    .matchEntireCell(true)
    .matchCase(false);
  const matches = finder.findAll() || [];
  if (matches.length) {
    return matches
      .map(function(match) { return match.getRow(); })
      .sort(function(a, b) { return a - b; });
  }

  const values = range.getValues();
  const rowNumbers = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === normalizedValue.toLowerCase()) {
      rowNumbers.push(i + 2);
    }
  }
  return rowNumbers;
}

function getTrackerRowsByNumber_(sheet, rowNumbers) {
  const sortedRows = (rowNumbers || [])
    .filter(function(rowNumber) { return Number(rowNumber) >= 2; })
    .sort(function(a, b) { return a - b; });
  if (!sortedRows.length) return [];

  const rows = [];
  var startRow = sortedRows[0];
  var endRow = sortedRows[0];

  function flushChunk_() {
    const chunkValues = sheet.getRange(startRow, 1, endRow - startRow + 1, TRACKER_HEADERS.length).getValues();
    chunkValues.forEach(function(rawRow) {
      rows.push(normalizeTrackerRow_(rawRow));
    });
  }

  for (var i = 1; i < sortedRows.length; i++) {
    if (sortedRows[i] === endRow + 1) {
      endRow = sortedRows[i];
      continue;
    }
    flushChunk_();
    startRow = sortedRows[i];
    endRow = sortedRows[i];
  }
  flushChunk_();

  return rows;
}

function buildTrackerStatusRecord_(row) {
  return {
    id: String(row[0] || ''),
    campaign: String(row[1] || ''),
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
    lastClickedUrl: String(row[11] || ''),
    deliveryState: normalizeDeliveryState_(row[18])
  };
}

function normalizeTrackerRow_(row) {
  const normalized = new Array(TRACKER_HEADERS.length).fill('');
  if (!row || !row.length) return normalized;

  if (row.length >= TRACKER_HEADERS.length) {
    for (var i = 0; i < TRACKER_HEADERS.length; i++) normalized[i] = row[i];
    normalized[7] = Number(normalized[7] || 0);
    normalized[10] = Number(normalized[10] || 0);
    normalized[18] = normalizeDeliveryState_(normalized[18]);
    return normalized;
  }

  if (row.length >= 18) {
    for (var legacyIndex = 0; legacyIndex < row.length; legacyIndex++) normalized[legacyIndex] = row[legacyIndex];
    normalized[7] = Number(normalized[7] || 0);
    normalized[10] = Number(normalized[10] || 0);
    normalized[18] = normalizeDeliveryState_(normalized[18]);
    normalized[19] = normalized[19] || normalized[13] || '';
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
    normalized[18] = normalizeDeliveryState_(normalized[18]);
    normalized[19] = normalized[13] || '';
    return normalized;
  }

  if (row.length === 10) {
    for (var j = 0; j < row.length; j++) normalized[j] = row[j];
    normalized[7] = Number(normalized[7] || 0);
    normalized[10] = Number(normalized[10] || 0);
    normalized[18] = normalizeDeliveryState_(normalized[18]);
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
  normalized[18] = normalizeDeliveryState_(normalized[18]);
  normalized[19] = normalized[13] || '';
  return normalized;
}
