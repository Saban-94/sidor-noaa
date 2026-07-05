/**
 * SBN Logistics ERP - Google Sheets Custom REST API
 * 
 * Target Sheet ID: 1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8
 * 
 * This Apps Script acts as the serverless backend proxy for the React ERP,
 * providing real-time read, write, and edit capabilities for order logs,
 * dictionary SKUs, and dynamic customer credit cards.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet (ID: 1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8)
 * 2. Click Extensions > Apps Script
 * 3. Delete any code in Code.gs and paste this entire script
 * 4. Click 'Deploy' > 'New deployment'
 * 5. Select type: 'Web app'
 * 6. Set Description: "SBN ERP API Gateway"
 * 7. Set Execute as: "Me (your email)"
 * 8. Set Who has access: "Anyone"
 * 9. Click Deploy, authorize permissions, and copy the Web App URL
 */

const TARGET_SHEET_ID = "1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8";
const SYSTEM_SHEETS = ["לוג_הזמנות_מערכת", "מילון_לוגיסטי", "הגדרות_מערכת"];

/**
 * Accesses the active spreadsheet safely by ID or falls back to active container
 */
function getSpreadsheet() {
  try {
    if (TARGET_SHEET_ID) {
      return SpreadsheetApp.openById(TARGET_SHEET_ID);
    }
  } catch (e) {
    console.warn("Unable to open sheet by target ID, falling back to active spreadsheet: " + e.message);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * GET Router
 */
function doGet(e) {
  const result = { success: false, data: null, error: null };
  
  try {
    const params = e || { parameter: {} };
    const action = params.parameter.action || "getLiveOrders";
    const ss = getSpreadsheet();
    
    if (action === "getLiveOrders") {
      const sheet = getOrCreateSheet(ss, "לוג_הזמנות_מערכת", [
        "Order ID", "Timestamp", "Customer Name", "Warehouse", "Items", "Deposit Status", "Pallet Status", "Status", "Rejection Reason", "Total Amount"
      ]);
      result.data = readSheetAsJSON(sheet);
      result.success = true;
    } 
    else if (action === "getCustomerList") {
      const sheets = ss.getSheets();
      const customerTabs = [];
      sheets.forEach(s => {
        const name = s.getName();
        if (!SYSTEM_SHEETS.includes(name)) {
          customerTabs.push({
            name: name,
            rowCount: s.getLastRow() > 1 ? s.getLastRow() - 1 : 0
          });
        }
      });
      result.data = customerTabs;
      result.success = true;
    } 
    else if (action === "getCustomerData") {
      const tabName = params.parameter.name;
      if (!tabName) {
        throw new Error("Missing customer 'name' parameter");
      }
      const sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        throw new Error("Customer tab '" + tabName + "' not found");
      }
      result.data = readSheetAsJSON(sheet);
      result.success = true;
    } 
    else if (action === "getDictionary") {
      const sheet = getOrCreateSheet(ss, "מילון_לוגיסטי", [
        "SKU", "Name", "Qty Per Pallet", "Requires Bag", "Requires Pallet"
      ]);
      result.data = readSheetAsJSON(sheet);
      result.success = true;
    }
    else {
      throw new Error("Unknown GET action: '" + action + "'");
    }
    
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }
  
  return corsJSON(result);
}

/**
 * POST Router
 */
function doPost(e) {
  const result = { success: false, data: null, error: null };
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Empty request body payload");
    }
    
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const ss = getSpreadsheet();
    
    if (action === "updateOrder") {
      const orderId = payload.orderId;
      const status = payload.status;
      const rejectionReason = payload.rejectionReason || "";
      const customerName = payload.customerName;
      
      if (!orderId) {
        throw new Error("Missing 'orderId' for updateOrder action");
      }
      
      // 1. Update in master log ('לוג_הזמנות_מערכת')
      const masterSheet = getOrCreateSheet(ss, "לוג_הזמנות_מערכת");
      const masterUpdated = updateRowInSheet(masterSheet, "Order ID", orderId, {
        "Status": status,
        "Rejection Reason": rejectionReason
      });
      
      // 2. Update in customer card tab
      let customerUpdated = false;
      if (customerName) {
        const customerSheet = ss.getSheetByName(customerName);
        if (customerSheet) {
          customerUpdated = updateRowInSheet(customerSheet, "Order ID", orderId, {
            "Status": status,
            "Rejection Reason": rejectionReason
          });
        }
      }
      
      result.success = true;
      result.data = {
        orderId: orderId,
        masterUpdated: masterUpdated,
        customerUpdated: customerUpdated
      };
    } 
    else if (action === "updateDictionary") {
      const sku = payload.sku;
      const name = payload.name;
      const qtyPerPallet = Number(payload.qtyPerPallet || 40);
      const requiresBag = payload.requiresBag || "לא";
      const requiresPallet = payload.requiresPallet || "כן";
      
      if (!sku) {
        throw new Error("Missing 'sku' for updateDictionary action");
      }
      
      const dictSheet = getOrCreateSheet(ss, "מילון_לוגיסטי", [
        "SKU", "Name", "Qty Per Pallet", "Requires Bag", "Requires Pallet"
      ]);
      
      const updated = updateRowInSheet(dictSheet, "SKU", sku, {
        "Name": name,
        "Qty Per Pallet": qtyPerPallet,
        "Requires Bag": requiresBag,
        "Requires Pallet": requiresPallet
      }, true); // upsert = true
      
      result.success = true;
      result.data = { sku: sku, upserted: updated };
    } 
    else if (action === "syncAllFromFirebase") {
      // Direct bulk writing/syncing capability for robust backups
      if (payload.orders && Array.isArray(payload.orders)) {
        const masterSheet = getOrCreateSheet(ss, "לוג_הזמנות_מערכת", [
          "Order ID", "Timestamp", "Customer Name", "Warehouse", "Items", "Deposit Status", "Pallet Status", "Status", "Rejection Reason", "Total Amount"
        ]);
        masterSheet.clearContents();
        masterSheet.appendRow([
          "Order ID", "Timestamp", "Customer Name", "Warehouse", "Items", "Deposit Status", "Pallet Status", "Status", "Rejection Reason", "Total Amount"
        ]);
        payload.orders.forEach(o => {
          masterSheet.appendRow([
            o.order_number, o.timestamp, o.customer_name, o.warehouse, o.items_string, o.deposit_status, o.pallet_status, o.status, o.rejection_reason, o.total_amount
          ]);
          
          // Also dynamically ensure customer tabs and append rows
          if (o.customer_name) {
            const custSheet = getOrCreateSheet(ss, o.customer_name, [
              "Order ID", "Timestamp", "Warehouse", "Items", "Status", "Total Amount"
            ]);
            // check duplicate before append
            if (!findRowIndexByValue(custSheet, "Order ID", o.order_number)) {
              custSheet.appendRow([
                o.order_number, o.timestamp, o.warehouse, o.items_string, o.status, o.total_amount
              ]);
            }
          }
        });
      }
      
      if (payload.dictionary && Array.isArray(payload.dictionary)) {
        const dictSheet = getOrCreateSheet(ss, "מילון_לוגיסטי", [
          "SKU", "Name", "Qty Per Pallet", "Requires Bag", "Requires Pallet"
        ]);
        dictSheet.clearContents();
        dictSheet.appendRow(["SKU", "Name", "Qty Per Pallet", "Requires Bag", "Requires Pallet"]);
        payload.dictionary.forEach(d => {
          dictSheet.appendRow([d.sku, d.name, d.qty_per_pallet, d.requires_bag, d.requires_pallet]);
        });
      }
      
      result.success = true;
      result.data = "Database fully backed up and sheets synchronized.";
    }
    else {
      throw new Error("Unknown POST action: '" + action + "'");
    }
    
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }
  
  return corsJSON(result);
}

/**
 * Helper: Find or create sheet tab and initialize headers
 */
function getOrCreateSheet(spreadsheet, name, defaultHeaders) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold").setBackground("#f1f5f9");
    }
  }
  return sheet;
}

/**
 * Helper: Read any spreadsheet sheet contents and parse into a standard JSON Array of Objects
 */
function readSheetAsJSON(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      // Format date fields nicely
      if (val instanceof Date) {
        val = val.toISOString();
      }
      // Standardize common Hebrew column mappings
      let cleanKey = header;
      if (header === "Order ID" || header === "מספר הזמנה" || header === "הזמנה") cleanKey = "order_number";
      else if (header === "Timestamp" || header === "תאריך") cleanKey = "timestamp";
      else if (header === "Customer Name" || header === "שם לקוח") cleanKey = "customer_name";
      else if (header === "Warehouse" || header === "מחסן") cleanKey = "warehouse";
      else if (header === "Items" || header === "פריטים" || header === "תכולה") cleanKey = "items_string";
      else if (header === "Deposit Status" || header === "פיקדון בלה") cleanKey = "deposit_status";
      else if (header === "Pallet Status" || header === "החזרת משטחים") cleanKey = "pallet_status";
      else if (header === "Status" || header === "סטטוס") cleanKey = "status";
      else if (header === "Rejection Reason" || header === "סיבת דחייה") cleanKey = "rejection_reason";
      else if (header === "Total Amount" || header === "סה\"כ") cleanKey = "total_amount";
      else if (header === "SKU" || header === "מק\"ט") cleanKey = "sku";
      else if (header === "Name" || header === "שם מוצר") cleanKey = "name";
      else if (header === "Qty Per Pallet" || header === "כמות למשטח") cleanKey = "qty_per_pallet";
      else if (header === "Requires Bag" || header === "דרוש בלה") cleanKey = "requires_bag";
      else if (header === "Requires Pallet" || header === "דרוש משטח") cleanKey = "requires_pallet";
      
      obj[cleanKey] = val;
    });
    return obj;
  });
}

/**
 * Helper: Find row index by matching column key and specific value
 */
function findRowIndexByValue(sheet, columnHeaderName, lookupValue) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return null;
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
  const colIndex = headers.indexOf(columnHeaderName.toLowerCase()) + 1;
  
  if (colIndex <= 0) return null;
  
  const values = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues().map(v => String(v[0]).trim());
  const matchIndex = values.indexOf(String(lookupValue).trim());
  
  return matchIndex !== -1 ? matchIndex + 2 : null; // returns 1-indexed row number
}

/**
 * Helper: Update matching row with key-value data or optionally insert if not found
 */
function updateRowInSheet(sheet, keyHeader, keyValue, dataToUpdate, allowUpsert = false) {
  const rowIndex = findRowIndexByValue(sheet, keyHeader, keyValue);
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  
  if (rowIndex) {
    // Row exists - update specific columns
    Object.keys(dataToUpdate).forEach(fieldKey => {
      const colIdx = headers.findIndex(h => h.toLowerCase() === fieldKey.toLowerCase()) + 1;
      if (colIdx > 0) {
        sheet.getRange(rowIndex, colIdx).setValue(dataToUpdate[fieldKey]);
      }
    });
    return true;
  } else if (allowUpsert) {
    // Create new row
    const newRow = [];
    headers.forEach(h => {
      if (h.toLowerCase() === keyHeader.toLowerCase()) {
        newRow.push(keyValue);
      } else if (dataToUpdate[h] !== undefined) {
        newRow.push(dataToUpdate[h]);
      } else {
        newRow.push("");
      }
    });
    sheet.appendRow(newRow);
    return true;
  }
  return false;
}

/**
 * CORS and text wrap formatter
 */
function corsJSON(result) {
  const output = ContentService.createTextOutput(JSON.stringify(result));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
