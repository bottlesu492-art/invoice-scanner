const CONFIG = {
  sheetName: '發票記帳',
  vendorSheetName: '商家資料庫',
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

const VENDOR_HEADERS = [
  '建立時間',
  '更新時間',
  '賣方名稱',
  '賣方統編',
  '店名關鍵字',
  '預設費用類別',
  '啟用',
  '備註',
];

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || '');

    if (action === 'vendors') {
      verifyApiToken_(params.token);
      return jsonpOrJsonResponse_({
        ok: true,
        vendors: getVendors_(),
      }, params.callback);
    }

    ensureSheet_();
    ensureVendorSheet_();
    return jsonpOrJsonResponse_({
      ok: true,
      service: 'invoice-scanner-backend',
      message: 'GAS backend is running. Use GitHub Pages as frontend.',
      spreadsheetUrl: getSpreadsheet_().getUrl(),
    }, params.callback);
  } catch (error) {
    const params = e && e.parameter ? e.parameter : {};
    return jsonpOrJsonResponse_({
      ok: false,
      error: error.message || String(error),
    }, params.callback);
  }
}

function doPost(e) {
  try {
    const data = parsePostPayload_(e);
    verifyApiToken_(data.token);

    if (data.action === 'addVendor') {
      const vendor = addVendor_(data.vendor || data.payload || {});
      return jsonResponse_({
        ok: true,
        vendor,
      });
    }

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
  const vendorSheet = ensureVendorSheet_();
  const token = ensureInvoiceApiToken_();
  return {
    ok: true,
    spreadsheetUrl: getSpreadsheet_().getUrl(),
    sheetName: sheet.getName(),
    vendorSheetName: vendorSheet.getName(),
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
  const vendorSheet = ensureVendorSheet_();

  let debug = ss.getSheetByName('DEBUG');
  if (!debug) debug = ss.insertSheet('DEBUG');

  debug.clear();
  debug.getRange(1, 1, 9, 2).setValues([
    ['time', Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy/MM/dd HH:mm:ss')],
    ['spreadsheetUrl', ss.getUrl()],
    ['spreadsheetId', ss.getId()],
    ['sheetName', sheet.getName()],
    ['vendorSheetName', vendorSheet.getName()],
    ['lastRow', sheet.getLastRow()],
    ['token', token],
    ['webAppUrl', ScriptApp.getService().getUrl()],
    ['note', '把 token 和 webAppUrl 貼到網頁 ?setup=1'],
  ]);

  return ss.getUrl();
}

function getVendors_() {
  const sheet = ensureVendorSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, VENDOR_HEADERS.length).getDisplayValues();
  return rows
    .filter((row) => String(row[6] || '').trim() !== '否')
    .map((row) => ({
      sellerName: row[2],
      sellerTaxId: cleanTaxId_(row[3]),
      keywords: row[4],
      category: row[5],
      enabled: row[6],
      note: row[7],
    }))
    .filter((vendor) => vendor.sellerName || vendor.sellerTaxId || vendor.keywords);
}

function addVendor_(payload) {
  const vendor = sanitizeVendor_(payload || {});
  if (!vendor.sellerName && !vendor.sellerTaxId) {
    throw new Error('商家資料至少需要賣方名稱或賣方統編。');
  }

  const sheet = ensureVendorSheet_();
  const now = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy/MM/dd HH:mm:ss');
  const existingRow = findVendorRow_(sheet, vendor);

  if (existingRow > 1) {
    sheet.getRange(existingRow, 2, 1, 6).setValues([[
      now,
      vendor.sellerName,
      vendor.sellerTaxId,
      vendor.keywords,
      vendor.category,
      '是',
    ]]);
    sheet.getRange(existingRow, 8).setValue(vendor.note);
  } else {
    sheet.appendRow([
      now,
      now,
      vendor.sellerName,
      vendor.sellerTaxId,
      vendor.keywords,
      vendor.category,
      '是',
      vendor.note,
    ]);
  }

  return vendor;
}

function findVendorRow_(sheet, vendor) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const rows = sheet.getRange(2, 1, lastRow - 1, VENDOR_HEADERS.length).getDisplayValues();
  const sellerTaxId = cleanTaxId_(vendor.sellerTaxId);
  const nameKey = normalizeText_(vendor.sellerName);

  for (let i = 0; i < rows.length; i += 1) {
    const rowTaxId = cleanTaxId_(rows[i][3]);
    const rowName = normalizeText_(rows[i][2]);
    if (sellerTaxId && rowTaxId === sellerTaxId) return i + 2;
    if (nameKey && rowName && rowName === nameKey) return i + 2;
  }

  return 0;
}

function sanitizeVendor_(payload) {
  const sellerName = cleanText_(payload.sellerName, 120);
  const sellerTaxId = cleanTaxId_(payload.sellerTaxId);
  const rawKeywords = cleanText_(payload.keywords, 500);
  return {
    sellerName,
    sellerTaxId,
    keywords: rawKeywords || sellerName,
    category: cleanText_(payload.category, 50),
    note: cleanText_(payload.note, 500),
  };
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

function jsonpOrJsonResponse_(value, callback) {
  const json = JSON.stringify(value);
  const safeCallback = String(callback || '').trim();
  if (/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(safeCallback)) {
    return ContentService
      .createTextOutput(`${safeCallback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse_(value);
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

  ensureHeaders_(sheet, HEADERS);
  return sheet;
}

function ensureVendorSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.vendorSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.vendorSheetName);
  }

  ensureHeaders_(sheet, VENDOR_HEADERS);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getDisplayValues()[0];
  const needsHeaders = headers.some((header, index) => currentHeaders[index] !== header);

  if (needsHeaders) {
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
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

function normalizeText_(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[^\w\u4e00-\u9fff]/g, '')
    .toLowerCase();
}
