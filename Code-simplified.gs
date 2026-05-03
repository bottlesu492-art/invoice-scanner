const CONFIG = {
  sheetName: '發票記帳',
  timezone: 'Asia/Taipei',
  tokenPropertyName: 'INVOICE_API_TOKEN',
};

const HEADERS = [
  '建立時間',
  '來源',
  '日期',
  '費用類別',
  '發票號碼',
  '賣方統編',
  '未稅金額',
  '稅額',
  '含稅金額',
  '付款人',
  '買方統編',
  '備註',
];

function doGet() {
  ensureSheet_();
  return jsonResponse_({
    ok: true,
    service: 'invoice-scanner-backend',
    message: 'GAS backend is running. Use GitHub Pages as frontend.',
    spreadsheetUrl: getSpreadsheet_().getUrl(),
  });
}

function doPost(e) {
  try {
    const data = parsePostPayload_(e);
    verifyApiToken_(data.token);
    const result = saveInvoice(data.payload || data);
    return jsonResponse_({
      ok: true,
      row: result.row,
      spreadsheetUrl: result.spreadsheetUrl,
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message || String(error),
    });
  }
}

function saveInvoice(payload) {
  const data = sanitizePayload_(payload || {});
  const sheet = ensureSheet_();
  const createdAt = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy/MM/dd HH:mm:ss');

  sheet.appendRow([
    createdAt,
    data.sourceType || '手動',
    data.invoiceDate,
    data.category,
    data.invoiceNo,
    data.sellerTaxId,
    data.untaxedAmount,
    data.taxAmount,
    data.totalAmount,
    data.payer,
    data.buyerTaxId,
    data.note,
  ]);

  return {
    ok: true,
    row: sheet.getLastRow(),
    spreadsheetUrl: getSpreadsheet_().getUrl(),
  };
}

function getRecentInvoices(limit) {
  const sheet = ensureSheet_();
  const lastRow = sheet.getLastRow();
  const count = Math.max(0, Math.min(Number(limit) || 10, lastRow - 1));
  if (!count) return [];

  const startRow = lastRow - count + 1;
  const rows = sheet.getRange(startRow, 1, count, HEADERS.length).getDisplayValues();
  return rows.reverse().map((row) => ({
    createdAt: row[0],
    sourceType: row[1],
    invoiceDate: row[2],
    category: row[3],
    invoiceNo: row[4],
    sellerTaxId: row[5],
    totalAmount: row[8],
    payer: row[9],
  }));
}

function setupInvoiceSheet() {
  const sheet = ensureSheet_();
  const token = ensureInvoiceApiToken_();
  return {
    ok: true,
    spreadsheetUrl: getSpreadsheet_().getUrl(),
    sheetName: sheet.getName(),
    token,
  };
}

function setupInvoiceBackend() {
  return setupInvoiceSheet();
}

function resetInvoiceApiToken() {
  const props = PropertiesService.getScriptProperties();
  const token = createToken_();
  props.setProperty(CONFIG.tokenPropertyName, token);
  return {
    ok: true,
    token,
  };
}

function debugWriteInvoiceBackend() {
  const token = ensureInvoiceApiToken_();
  const ss = getSpreadsheet_();
  const sheet = ensureSheet_();

  let debug = ss.getSheetByName('DEBUG');
  if (!debug) debug = ss.insertSheet('DEBUG');

  debug.clear();
  debug.getRange(1, 1, 8, 2).setValues([
    ['time', Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy/MM/dd HH:mm:ss')],
    ['spreadsheetUrl', ss.getUrl()],
    ['spreadsheetId', ss.getId()],
    ['sheetName', sheet.getName()],
    ['lastRow', sheet.getLastRow()],
    ['token', token],
    ['webAppUrl', ScriptApp.getService().getUrl()],
    ['note', '把 token 和 webAppUrl 貼回 v10 ?setup=1'],
  ]);

  return ss.getUrl();
}

function parsePostPayload_(e) {
  const contents = e && e.postData && e.postData.contents;
  if (contents) {
    try {
      return JSON.parse(contents);
    } catch (error) {
      return e.parameter || {};
    }
  }
  return e && e.parameter ? e.parameter : {};
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifyApiToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty(CONFIG.tokenPropertyName);
  if (!expected) {
    throw new Error('尚未設定 API token，請先在 Apps Script 執行 setupInvoiceBackend。');
  }
  if (String(token || '') !== expected) {
    throw new Error('API token 不正確，已拒絕寫入。');
  }
}

function ensureInvoiceApiToken_() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty(CONFIG.tokenPropertyName);
  if (!token) {
    token = createToken_();
    props.setProperty(CONFIG.tokenPropertyName, token);
  }
  return token;
}

function createToken_() {
  return `${Utilities.getUuid()}-${Utilities.getUuid()}`;
}

function sanitizePayload_(payload) {
  return {
    sourceType: cleanText_(payload.sourceType),
    invoiceDate: cleanText_(payload.invoiceDate),
    category: cleanText_(payload.category),
    invoiceNo: cleanInvoiceNo_(payload.invoiceNo),
    sellerTaxId: cleanTaxId_(payload.sellerTaxId),
    untaxedAmount: cleanMoney_(payload.untaxedAmount),
    taxAmount: cleanMoney_(payload.taxAmount),
    totalAmount: cleanMoney_(payload.totalAmount),
    payer: cleanText_(payload.payer),
    buyerTaxId: cleanTaxId_(payload.buyerTaxId),
    note: cleanText_(payload.note, 1000),
  };
}

function ensureSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheetName);
  }

  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const currentHeaders = headerRange.getDisplayValues()[0];
  const needsHeaders = HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (needsHeaders) {
    sheet.clear();
    headerRange.setValues([HEADERS]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }

  return sheet;
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('SPREADSHEET_ID');
  if (savedId) {
    return SpreadsheetApp.openById(savedId);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }

  const created = SpreadsheetApp.create('發票記帳資料庫');
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}

function cleanText_(value, maxLength) {
  const limit = maxLength || 300;
  return String(value || '').trim().slice(0, limit);
}

function cleanInvoiceNo_(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

function cleanTaxId_(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8);
}

function cleanMoney_(value) {
  const cleaned = String(value || '').replace(/[^\d.-]/g, '');
  if (!cleaned) return '';
  return Number(cleaned);
}
