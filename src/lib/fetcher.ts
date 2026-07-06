import { mutate } from 'swr';

export const GOOGLE_SCRIPT_API_URL = 'https://script.google.com/macros/s/AKfycbzZPSpu15sbrfuWVwzYEcSKYhTCXG6jPJlgqvKuBBCQaZTR8gT9n7YX3AXnaLZs_vThOA/exec';

// Track global offline status using a simple custom event
let isOffline = false;

export function getOfflineStatus(): boolean {
  return isOffline;
}

export function setOfflineStatus(status: boolean) {
  if (isOffline !== status) {
    isOffline = status;
    // Dispatch a custom event so App.tsx and other components can listen
    window.dispatchEvent(new CustomEvent('sheets-offline-change', { detail: status }));
  }
}

export async function sheetsFetcher(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      setOfflineStatus(true);
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    let json: any;
    try {
      json = await res.json();
    } catch (e) {
      setOfflineStatus(true);
      throw new Error('Invalid JSON response from Sheets API');
    }

    // Since we parsed JSON successfully, the API server is ONLINE
    setOfflineStatus(false);

    // Helper: Parse raw 2D array of spreadsheet values into list of objects with clean keys
    const parse2DArray = (rows: any[][]): any[] => {
      if (!rows || rows.length === 0) return [];
      const headers = rows[0].map(h => String(h).trim());
      const dataRows = rows.slice(1);
      
      return dataRows.map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          let val = row[index];
          let cleanKey = header;
          
          // Standardize common Hebrew column mappings
          if (header === "Order ID" || header === "מספר הזמנה" || header === "הזמנה") cleanKey = "order_number";
          else if (header === "Timestamp" || header === "תאריך" || header === "תאריך קליטה") cleanKey = "timestamp";
          else if (header === "Customer Name" || header === "שם לקוח") cleanKey = "customer_name";
          else if (header === "Warehouse" || header === "מחסן") cleanKey = "warehouse";
          else if (header === "Items" || header === "פריטים" || header === "תכולה") cleanKey = "items_string";
          else if (header === "Deposit Status" || header === "פיקדון בלה" || header === "אימות פקדון בלות") cleanKey = "deposit_status";
          else if (header === "Pallet Status" || header === "החזרת משטחים" || header === "אימות פקדון משטחים") cleanKey = "pallet_status";
          else if (header === "Status" || header === "סטטוס" || header === "סטטוס ווצאפ") cleanKey = "status";
          else if (header === "Rejection Reason" || header === "סיבת דחייה" || header === "מסקנות נועה AI") cleanKey = "rejection_reason";
          else if (header === "Total Amount" || header === "סה\"כ") cleanKey = "total_amount";
          else if (header === "SKU" || header === "מק\"ט") cleanKey = "sku";
          else if (header === "Name" || header === "שם מוצר") cleanKey = "name";
          else if (header === "Qty Per Pallet" || header === "כמות למשטח") cleanKey = "qty_per_pallet";
          else if (header === "Requires Bag" || header === "דרוש בלה") cleanKey = "requires_bag";
          else if (header === "Requires Pallet" || header === "דרוש משטח") cleanKey = "requires_pallet";
          else if (header === "Delivery Date" || header === "תאריך אספקה" || header === "תאריך יעד") cleanKey = "deliveryDate";
          else if (header === "Delivery Time" || header === "שעת אספקה" || header === "שעת יעד") cleanKey = "deliveryTime";
          
          obj[cleanKey] = val;
        });
        return obj;
      });
    };

    let data = json;
    
    // Check if response has wrapped format `{ success: ..., data: ... }`
    if (json && typeof json === 'object' && json.success !== undefined) {
      if (json.success) {
        // Handle double wrap: { success: true, data: { success: true, data: [...] } }
        if (json.data && typeof json.data === 'object' && json.data.success && json.data.data !== undefined) {
          data = json.data.data;
        } else if (json.data !== undefined) {
          data = json.data;
        }
      } else {
        // Fallback for missing action support in older script deployments
        if (url.includes('action=getDictionary')) {
          console.warn('getDictionary is not supported by deployed Apps Script. Falling back.');
          return [];
        }
        throw new Error(json.error || 'Invalid API response structure');
      }
    }

    // Now format raw arrays to matches standard schemas
    if (Array.isArray(data)) {
      if (data.length > 0 && Array.isArray(data[0])) {
        // Raw 2D Spreadsheet Rows
        return parse2DArray(data);
      } else {
        // Raw 1D List (e.g. array of customer sheet names)
        return data.map(item => {
          if (typeof item === 'string') {
            return { name: item };
          }
          return item;
        });
      }
    }

    return data;
  } catch (err: any) {
    console.error('SWR Fetcher error:', err);
    // Only set system as offline for genuine connection drops or HTML outputs
    if (err.message && (
      err.message.includes('Failed to fetch') || 
      err.message.includes('NetworkError') || 
      err.message.includes('HTTP error') || 
      err.message.includes('JSON')
    )) {
      setOfflineStatus(true);
    }
    throw err;
  }
}
