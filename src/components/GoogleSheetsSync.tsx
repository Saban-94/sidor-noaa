import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, Customer, DictionaryItem } from '../types';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Database, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  ToggleLeft, 
  Clock, 
  Settings, 
  Eye, 
  EyeOff, 
  Play, 
  Square,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function GoogleSheetsSync() {
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSynced, setLastSynced] = useState<string | null>(() => localStorage.getItem('last_sheets_sync_time'));
  const [autoSync, setAutoSync] = useState<boolean>(() => localStorage.getItem('auto_sheets_sync_enabled') === 'true');
  const [syncInterval, setSyncInterval] = useState<number>(30); // seconds
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [sheetPreviewData, setSheetPreviewData] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Auto Sync Interval Effect
  useEffect(() => {
    if (!autoSync) return;

    console.log(`Starting auto-sync interval every ${syncInterval} seconds...`);
    const intervalId = setInterval(() => {
      handleBidirectionalSync(true); // silent auto-sync
    }, syncInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoSync, syncInterval]);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString('he-IL');
    setSyncLogs((prev) => [`[${time}] ${message}`, ...prev.slice(0, 49)]);
  };

  // Safe mapper that converts various column names (Hebrew/English) to standard SBN Logistics schema
  const mapRowToSchema = (row: any) => {
    const keys = Object.keys(row);
    const getVal = (possibleKeys: string[]): any => {
      for (const k of possibleKeys) {
        // match case-insensitive and trim
        const foundKey = keys.find(originalKey => 
          originalKey.trim().toLowerCase() === k.toLowerCase()
        );
        if (foundKey !== undefined) return row[foundKey];
      }
      return undefined;
    };

    // Determine type based on properties
    const hasOrderFields = getVal(['order_number', 'מספר הזמנה', 'הזמנה', 'order', 'num']);
    const hasSKUFields = getVal(['sku', 'מק"ט', 'מקט', 'קוד מוצר']);
    const hasCustomerUnreturned = getVal(['unreturned_pallets', 'יתרת משטחים', 'משטחים', 'unreturned_bags', 'יתרת בלות']);

    if (hasOrderFields !== undefined || getVal(['customer_name', 'שם לקוח', 'לקוח']) !== undefined && getVal(['warehouse', 'מחסן']) !== undefined) {
      // Order type mapping
      return {
        type: 'order',
        data: {
          order_number: String(hasOrderFields || 'SBN-' + Math.floor(Math.random() * 90000 + 10000)),
          customer_name: String(getVal(['customer_name', 'שם לקוח', 'לקוח', 'customer']) || 'לקוח כללי'),
          warehouse: String(getVal(['warehouse', 'מחסן', 'סניף', 'warehouse']) || 'מחסן מרכז (רמלה)'),
          items_string: String(getVal(['items_string', 'פריטים', 'תכולה', 'items', 'מוצרים']) || 'חומרי בניין מעורבים'),
          deposit_status: (getVal(['deposit_status', 'פיקדון בלה', 'פיקדון', 'deposit']) || 'OK') === 'OK' ? 'OK' : '❌',
          pallet_status: (getVal(['pallet_status', 'החזרת משטחים', 'משטחים', 'pallet']) || 'OK') === 'OK' ? 'OK' : '❌',
          status: String(getVal(['status', 'סטטוס', 'מצב']) || 'ממתין'),
          total_amount: Number(getVal(['total_amount', 'סה"כ', 'מחיר', 'סהכ', 'total', 'price']) || 1500),
          timestamp: String(getVal(['timestamp', 'תאריך', 'שעה', 'time']) || new Date().toISOString())
        }
      };
    } else if (hasSKUFields !== undefined) {
      // DictionaryItem mapping
      return {
        type: 'dictionary',
        data: {
          sku: String(hasSKUFields),
          name: String(getVal(['name', 'שם מוצר', 'פריט', 'תיאור', 'name']) || 'מוצר חדש'),
          qty_per_pallet: Number(getVal(['qty_per_pallet', 'כמות למשטח', 'כמות_במשטח', 'quantity']) || 40),
          requires_bag: (getVal(['requires_bag', 'דרוש בלה', 'בלה', 'bag']) === 'כן' || getVal(['requires_bag', 'דרוש בלה', 'בלה', 'bag']) === true) ? 'כן' : 'לא',
          requires_pallet: (getVal(['requires_pallet', 'דרוש משטח', 'משטח', 'pallet']) === 'לא' || getVal(['requires_pallet', 'דרוש משטח', 'משטח', 'pallet']) === false) ? 'לא' : 'כן'
        }
      };
    } else if (getVal(['name', 'לקוח', 'שם לקוח']) !== undefined) {
      // Customer mapping
      return {
        type: 'customer',
        data: {
          name: String(getVal(['name', 'שם לקוח', 'לקוח'])),
          phone: String(getVal(['phone', 'טלפון', 'נייד']) || ''),
          email: String(getVal(['email', 'אימייל', 'דואל']) || ''),
          address: String(getVal(['address', 'כתובת', 'מיקום']) || ''),
          balance: Number(getVal(['balance', 'יתרת חוב', 'אובליגו', 'balance']) || 0),
          unreturned_pallets: Number(getVal(['unreturned_pallets', 'יתרת משטחים', 'משטחים_חוב', 'pallets']) || 0),
          unreturned_bags: Number(getVal(['unreturned_bags', 'יתרת בלות', 'בלות_חוב', 'bags']) || 0)
        }
      };
    }
    return null;
  };

  const handleBidirectionalSync = async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setSyncStatus('idle');
    }
    setErrorMessage('');
    addLog('מתחיל סנכרון דו-כיווני עם גליון Google Sheets...');

    try {
      // Step 1: Fetch raw spreadsheet rows from the server proxy
      const response = await fetch('/api/sheets/proxy');
      if (!response.ok) {
        throw new Error(`שגיאת שרת: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'נכשל החיבור לגליון דרך שרת הפרוקסי');
      }

      const rawData = result.data;
      setSheetPreviewData(rawData);
      addLog('נתוני הגליון הגולמיים נטענו בהצלחה!');

      // Step 2: Extract rows array from spreadsheet API response
      let rowsToSync: any[] = [];
      if (Array.isArray(rawData)) {
        rowsToSync = rawData;
      } else if (rawData && typeof rawData === 'object') {
        // Common Apps Script wrappers
        if (Array.isArray(rawData.data)) {
          rowsToSync = rawData.data;
        } else if (Array.isArray(rawData.rows)) {
          rowsToSync = rawData.rows;
        } else if (Array.isArray(rawData.orders)) {
          rowsToSync = rawData.orders;
        } else {
          // Flatten nested arrays if any
          const arrays = Object.values(rawData).filter(val => Array.isArray(val));
          if (arrays.length > 0) {
            rowsToSync = arrays[0] as any[];
          }
        }
      }

      if (rowsToSync.length === 0) {
        addLog('הגליון ריק או שלא זוהה מערך נתונים מתאים. מכין יצוא נתונים מקומיים לגיבוי...');
        await handlePushToSheet(true); // auto backup
        if (!isSilent) {
          setSyncStatus('success');
        }
        return;
      }

      addLog(`זוהו ${rowsToSync.length} שורות בגליון. מתחיל ניתוח שדות...`);

      // Step 3: Run mapper to sync orders, dictionary, and customers to Firestore
      let ordersSynced = 0;
      let customersSynced = 0;
      let dictionarySynced = 0;

      // Load existing Firestore collections first to check for duplicates
      const [ordersSnap, customersSnap, dictSnap] = await Promise.all([
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'dictionary'))
      ]);

      const existingOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const existingCustomers = customersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const existingDict = dictSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      for (const row of rowsToSync) {
        const mapped = mapRowToSchema(row);
        if (!mapped) continue;

        if (mapped.type === 'order') {
          // Check duplicate order by order_number
          const orderData = mapped.data;
          const duplicate = existingOrders.find(o => o.order_number === orderData.order_number);
          if (duplicate) {
            // Update exist
            await updateDoc(doc(db, 'orders', duplicate.id), orderData);
          } else {
            // Add new
            await addDoc(collection(db, 'orders'), orderData);
          }
          ordersSynced++;
        } 
        else if (mapped.type === 'customer') {
          const custData = mapped.data;
          const duplicate = existingCustomers.find(c => c.name === custData.name);
          if (duplicate) {
            await updateDoc(doc(db, 'customers', duplicate.id), custData);
          } else {
            await addDoc(collection(db, 'customers'), custData);
          }
          customersSynced++;
        }
        else if (mapped.type === 'dictionary') {
          const dictData = mapped.data;
          const duplicate = existingDict.find(d => d.sku === dictData.sku);
          if (duplicate) {
            await updateDoc(doc(db, 'dictionary', duplicate.id), dictData);
          } else {
            await addDoc(collection(db, 'dictionary'), dictData);
          }
          dictionarySynced++;
        }
      }

      const syncSummary = `סונכרנו בהצלחה: ${ordersSynced} הזמנות, ${customersSynced} לקוחות, ${dictionarySynced} מק״טים.`;
      addLog(syncSummary);

      // Now Push local data that is not in the sheet back to keep it robust (Bidirectional Harmony!)
      await handlePushToSheet(true);

      const nowStr = new Date().toLocaleString('he-IL');
      setLastSynced(nowStr);
      localStorage.setItem('last_sheets_sync_time', nowStr);
      if (!isSilent) {
        setSyncStatus('success');
      }
    } catch (err: any) {
      console.error("Bidirectional sync failed:", err);
      setErrorMessage(err.message || 'שגיאת רשת לא ידועה בסנכרון הגליון');
      addLog(`❌ סנכרון נכשל: ${err.message || 'שגיאת חיבור'}`);
      if (!isSilent) {
        setSyncStatus('error');
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  const handlePushToSheet = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    try {
      addLog('מכין יצוא וגיבוי של בסיס הנתונים המקומי (Firestore) לגליון גוגל...');

      // Fetch all collections from Firestore
      const [ordersSnap, customersSnap, dictSnap] = await Promise.all([
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'dictionary'))
      ]);

      const orders = ordersSnap.docs.map(d => d.data());
      const customers = customersSnap.docs.map(d => d.data());
      const dictionary = dictSnap.docs.map(d => d.data());

      // Prepare payload
      const payload = {
        action: 'write',
        syncSource: 'SBN Logistics ERP Client',
        timestamp: new Date().toISOString(),
        orders,
        customers,
        dictionary
      };

      const response = await fetch('/api/sheets/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`שגיאת שרת יצוא: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        addLog('הנתונים הועלו וסונכרנו בהצלחה בתוך גליון Google Sheets! 📁');
      } else {
        addLog(`הערה: השרת קיבל את הנתונים אך החזיר הודעת סטטוס: ${result.error || 'ללא שגיאה מפורטת'}`);
      }
    } catch (err: any) {
      console.warn("Push backup to sheet failed:", err);
      addLog(`שים לב: יצוא הגיבוי לגליון נתקל בקושי (${err.message}). ייתכן והגליון מוגדר לקריאה בלבד.`);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  const toggleAutoSync = () => {
    const newState = !autoSync;
    setAutoSync(newState);
    localStorage.setItem('auto_sheets_sync_enabled', String(newState));
    addLog(newState ? `סנכרון מחזורי אוטומטי הופעל (כל ${syncInterval} שניות)` : 'סנכרון אוטומטי כבוי');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mt-6">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner relative">
            <FileSpreadsheet className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              חיבור וסנכרון גליונות Google Sheets
              <span className="text-[10px] bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest">REALTIME</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">סנכרון מלא, מילון מק״טים, והזמנות חריגות מול הגליון הרשמי</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleAutoSync}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
              autoSync 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            {autoSync ? <Play className="w-3.5 h-3.5 fill-emerald-600 dark:fill-emerald-400 text-emerald-600 dark:text-emerald-400" /> : <Square className="w-3 h-3 text-slate-400" />}
            {autoSync ? 'סנכרון אוטומטי פעיל' : 'הפעל סנכרון אוטומטי'}
          </button>

          <button
            onClick={() => handleBidirectionalSync()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-500/10 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'מסנכרן נתונים...' : 'סנכרן כעת'}
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Connection status and controller */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-3.5">
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">פרטי שער המקשר (Web App Endpoint)</h4>
            
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">כתובת ה-Apps Script:</span>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400 break-all select-all">
                https://script.google.com/macros/s/AKfycbxHm1GO0CNvCiTDoPwuLzPxFIzg5izfyLTH5lUP1OHu83tKUEEETtqTvZkXjan9By0UyQ/exec
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-150 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 block mb-0.5">זמן סנכרון אחרון:</span>
                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                  {lastSynced ? lastSynced.split(',')[1] || lastSynced : 'לא סונכרן'}
                </span>
              </div>
              
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-150 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 block mb-0.5">סטטוס סנכרון:</span>
                <span className="text-[11px] font-bold flex items-center gap-1">
                  {syncStatus === 'success' && <span className="text-emerald-500">תקין ✓</span>}
                  {syncStatus === 'error' && <span className="text-red-500">נכשל ❌</span>}
                  {syncStatus === 'idle' && <span className="text-slate-500">ממתין</span>}
                </span>
              </div>
            </div>

            {/* Config Sync Interval if auto sync enabled */}
            {autoSync && (
              <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/80 space-y-2">
                <label className="text-[10px] text-slate-400 font-bold block">תדירות סנכרון (שניות):</label>
                <div className="flex gap-2">
                  {[15, 30, 60, 120].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setSyncInterval(sec)}
                      className={`flex-1 py-1 text-[10px] font-mono font-bold rounded border transition-all cursor-pointer ${
                        syncInterval === sec 
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {sec}ש'
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sync control tools */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleBidirectionalSync()}
              className="flex items-center justify-center gap-1.5 py-3 border border-blue-200 dark:border-blue-900/60 bg-blue-50/20 hover:bg-blue-50/40 dark:bg-blue-950/10 dark:hover:bg-blue-950/30 rounded-xl text-[10px] font-extrabold text-blue-600 dark:text-blue-400 cursor-pointer transition-colors"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              ייבא מהגליון
            </button>

            <button
              onClick={() => handlePushToSheet()}
              className="flex items-center justify-center gap-1.5 py-3 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 hover:bg-emerald-50/40 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/30 rounded-xl text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 cursor-pointer transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              ייצא וגבה לגליון
            </button>
          </div>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer transition-colors"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? 'הסתר מציג נתונים גולמיים' : 'הצג נתוני גליון גולמיים'}
          </button>
        </div>

        {/* Realtime Action Logs */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-[220px]">
          <div className="bg-slate-900 dark:bg-slate-950 text-slate-300 font-mono text-[10px] p-4 rounded-xl flex-1 border border-slate-800 flex flex-col justify-between overflow-hidden shadow-inner">
            <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[170px] custom-scrollbar" dir="ltr">
              <p className="text-blue-400 font-bold border-b border-slate-800 pb-1 mb-2 text-right" dir="rtl">💬 לוג פעילות סנכרון בזמן אמת</p>
              {syncLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-6">אין לוגים כרגע. לחץ על "סנכרן כעת" להתחלת התקשורת.</p>
              ) : (
                syncLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed hover:bg-slate-800/40 px-1 rounded transition-colors break-words text-left">
                    {log}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-800 pt-2.5 mt-2 flex justify-between items-center text-[9px] text-slate-500" dir="rtl">
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-500" />
                חיבור Firestore פעיל: 24/7
              </span>
              <span>SBN Sync Engine v1.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Raw Sheet JSON Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-950/10"
          >
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-500" />
                נתונים גולמיים שהתקבלו מ-Google Apps Script Web App
              </h4>
              <span className="text-[9px] text-slate-400 font-mono">JSON RESPONSE PREVIEW</span>
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-[10px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto max-h-[250px] custom-scrollbar" dir="ltr">
              {sheetPreviewData ? (
                <pre>{JSON.stringify(sheetPreviewData, null, 2)}</pre>
              ) : (
                <p className="text-slate-400 italic text-center py-4">אין נתונים זמינים. בצע סנכרון תחילה כדי לראות את תגובת ה-API.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
