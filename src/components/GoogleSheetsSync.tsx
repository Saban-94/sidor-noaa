import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Database, 
  AlertCircle, 
  CheckCircle2, 
  Search,
  Settings, 
  Eye, 
  EyeOff, 
  Play, 
  Square,
  HelpCircle,
  User,
  Layers,
  ChevronRight,
  TrendingUp,
  Tag,
  Edit3,
  Check,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { GOOGLE_SCRIPT_API_URL } from '../lib/fetcher';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';

interface SheetCustomer {
  name: string;
  rowCount: number;
}

interface SheetOrder {
  order_number: string;
  timestamp: string;
  customer_name: string;
  warehouse: string;
  items_string: string;
  deposit_status: string;
  pallet_status: string;
  status: string;
  rejection_reason?: string;
  total_amount?: number;
}

interface SheetDictionaryItem {
  sku: string;
  name: string;
  qty_per_pallet: number;
  requires_bag: string;
  requires_pallet: string;
}

export default function GoogleSheetsSync() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'sync' | 'crm' | 'dict'>('sync');

  // Core Data States
  const [liveOrders, setLiveOrders] = useState<SheetOrder[]>([]);
  const [customerTabs, setCustomerTabs] = useState<SheetCustomer[]>([]);
  const [dictionaryItems, setDictionaryItems] = useState<SheetDictionaryItem[]>([]);
  
  // Loading & Sync States
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingDict, setLoadingDict] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [networkPulse, setNetworkPulse] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('');

  // Selected CRM Customer Card State
  const [selectedCustomer, setSelectedCustomer] = useState<SheetCustomer | null>(null);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [loadingCustomerData, setLoadingCustomerData] = useState(false);
  const [crmSearch, setCrmSearch] = useState('');

  // Editing Orders Drawer State
  const [editingOrder, setEditingOrder] = useState<SheetOrder | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editRejection, setEditRejection] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);

  // New Dictionary Item State
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState(40);
  const [newBag, setNewBag] = useState('לא');
  const [newPallet, setNewPallet] = useState('כן');
  const [savingDict, setSavingDict] = useState(false);

  // Auto-polling interval toggles
  const [autoSync, setAutoSync] = useState(true);
  const [pollCount, setPollCount] = useState(0);

  // Setup initial logs
  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString('he-IL');
    setSyncLogs((prev) => [`[${time}] ${message}`, ...prev.slice(0, 39)]);
  };

  // Real-time fetching function (Continuous Live Polling)
  const fetchLiveOrdersAndCustomers = async (silent = false) => {
    if (!silent) {
      setLoadingOrders(true);
      setLoadingCustomers(true);
    }
    setNetworkPulse(true);
    try {
      // 1. Fetch Live Orders
      const orderRes = await fetch(`${GOOGLE_SCRIPT_API_URL}?action=getLiveOrders`);
      if (orderRes.ok) {
        const orderDataResult = await orderRes.json();
        if (orderDataResult.success && Array.isArray(orderDataResult.data)) {
          setLiveOrders(orderDataResult.data);
          if (!silent) addLog(`נטענו בהצלחה ${orderDataResult.data.length} הזמנות חיות מהגליון`);
        }
      }

      // 2. Fetch Customer CRM tabs list
      const custRes = await fetch(`${GOOGLE_SCRIPT_API_URL}?action=getCustomerList`);
      if (custRes.ok) {
        const custDataResult = await custRes.json();
        if (custDataResult.success && Array.isArray(custDataResult.data)) {
          setCustomerTabs(custDataResult.data);
          if (!silent) addLog(`זוהו ${custDataResult.data.length} כרטיסי לקוחות דינמיים בגליון`);
        }
      }

      // 3. Fetch Dictionary items
      const dictRes = await fetch(`${GOOGLE_SCRIPT_API_URL}?action=getDictionary`);
      if (dictRes.ok) {
        const dictDataResult = await dictRes.json();
        if (dictDataResult.success && Array.isArray(dictDataResult.data)) {
          setDictionaryItems(dictDataResult.data);
        }
      }

      setLastCheckedTime(new Date().toLocaleTimeString('he-IL'));
      setPollCount(prev => prev + 1);
    } catch (err: any) {
      console.error("Continuous fetch error:", err);
      addLog(`שגיאה בעדכון רקע: ${err.message}`);
    } finally {
      setLoadingOrders(false);
      setLoadingCustomers(false);
      setTimeout(() => setNetworkPulse(false), 800);
    }
  };

  // Handle continuous polling effect
  useEffect(() => {
    fetchLiveOrdersAndCustomers();
    addLog('שירות סנכרון Google Sheets הופעל בהצלחה.');

    if (!autoSync) return;

    const intervalId = setInterval(() => {
      fetchLiveOrdersAndCustomers(true);
    }, 5000); // Poll every 5 seconds for ultimate "live data" feel

    return () => clearInterval(intervalId);
  }, [autoSync]);

  // Handle Dynamic Customer Card selection (Fetch specific TabName data)
  const handleSelectCustomer = async (customer: SheetCustomer) => {
    setSelectedCustomer(customer);
    setLoadingCustomerData(true);
    setCustomerData([]);
    addLog(`טוען נתונים עבור כרטיס לקוח: "${customer.name}"...`);

    try {
      const response = await fetch(`${GOOGLE_SCRIPT_API_URL}?action=getCustomerData&name=${encodeURIComponent(customer.name)}`);
      if (!response.ok) {
        throw new Error(`שגיאת שרת: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setCustomerData(result.data);
        addLog(`נטענו בהצלחה ${result.data.length} שורות עבור לקוח "${customer.name}"`);
      } else {
        throw new Error(result.error || "נתונים ריקים או לא תקינים מהכרטיס");
      }
    } catch (err: any) {
      console.error("Error fetching customer tab data:", err);
      addLog(`❌ נכשל טעינת כרטיס הלקוח: ${err.message}`);
    } finally {
      setLoadingCustomerData(false);
    }
  };

  // DELIVERABLE 2.3: POST capability helper
  const updateSheetData = async (payload: any) => {
    addLog(`שולח עדכון נתונים לגליון: ${payload.action}...`);
    const response = await fetch(GOOGLE_SCRIPT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`שגיאת רשת בעדכון: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  };

  // Handle Order Status Editing & Sync back to both log & customer tab
  const handleSaveOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    setSavingOrder(true);
    addLog(`מעדכן הזמנה ${editingOrder.order_number} לסטטוס "${editStatus}"...`);

    try {
      // 1. Post to Apps Script API (updates both master & customer sheet)
      const payload = {
        action: 'updateOrder',
        orderId: editingOrder.order_number,
        status: editStatus,
        rejectionReason: editRejection,
        customerName: editingOrder.customer_name
      };

      const result = await updateSheetData(payload);

      if (result.success) {
        addLog(`✓ ההזמנה ${editingOrder.order_number} עודכנה בהצלחה בשני הגליונות!`);
        
        // 2. Also write back to Firestore if needed to maintain synced harmony
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const docToUpdate = ordersSnap.docs.find(d => d.data().order_number === editingOrder.order_number);
        if (docToUpdate) {
          await updateDoc(doc(db, 'orders', docToUpdate.id), {
            status: editStatus,
            rejection_reason: editRejection
          });
          addLog(`✓ נתוני Firestore סונכרנו בהצלחה עם סטטוס הגליון החדש.`);
        }

        // Close and refresh
        setEditingOrder(null);
        fetchLiveOrdersAndCustomers(true);
      } else {
        throw new Error(result.error || "תשובת שרת שלילית");
      }
    } catch (err: any) {
      console.error("Error editing order:", err);
      addLog(`❌ עדכון הזמנה נכשל: ${err.message}`);
    } finally {
      setSavingOrder(false);
    }
  };

  // Handle SKU Dictionary additions
  const handleAddDictionaryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku.trim() || !newName.trim()) {
      alert("נא להזין מק\"ט ושם מוצר");
      return;
    }

    setSavingDict(true);
    addLog(`מוסיף מק"ט ${newSku} למילון הלוגיסטי...`);

    try {
      const payload = {
        action: 'updateDictionary',
        sku: newSku,
        name: newName,
        qtyPerPallet: newQty,
        requiresBag: newBag,
        requiresPallet: newPallet
      };

      const result = await updateSheetData(payload);

      if (result.success) {
        addLog(`✓ המק"ט ${newSku} נשמר ועודכן במילון הלוגיסטי בגליון!`);

        // Synchronize locally to Firestore
        await addDoc(collection(db, 'dictionary'), {
          sku: newSku,
          name: newName,
          qty_per_pallet: Number(newQty),
          requires_bag: newBag,
          requires_pallet: newPallet
        });

        // Clear forms
        setNewSku('');
        setNewName('');
        setNewQty(40);
        
        // Refresh catalog lists
        fetchLiveOrdersAndCustomers(true);
      } else {
        throw new Error(result.error || "תשובת שרת נכשלה");
      }
    } catch (err: any) {
      console.error("Error creating dictionary item:", err);
      addLog(`❌ הוספת מק"ט נכשלה: ${err.message}`);
    } finally {
      setSavingDict(false);
    }
  };

  // Helper status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ממתין': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/40';
      case 'בטיפול': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/40';
      case 'בדרך': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/40';
      case 'נמסר': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/40';
      case 'מבוטל': case 'בוטל': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/40';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mt-6">
      
      {/* Top Main Panel Title with Status Bar */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-inner relative">
            <FileSpreadsheet className="w-6 h-6" />
            <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center transition-all ${
              autoSync ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}>
              {networkPulse && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              מערכת סנכרון לוגיסטי - Google Sheets Live
              <span className="text-[10px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-full">ACTIVE API</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">קריאה וכתיבה ישירה, כרטיסי לקוח דינמיים ואינדיקטורים בזמן אמת</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Polled count status bubble */}
          <div className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border border-slate-200/40 dark:border-slate-700/40">
            <span className={`w-1.5 h-1.5 rounded-full ${autoSync ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
            <span>עדכון אחרון: {lastCheckedTime || 'ממתין...'} ({pollCount} פעימות)</span>
          </div>

          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
              autoSync 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            {autoSync ? <Play className="w-3 h-3 fill-emerald-600 dark:fill-emerald-400" /> : <Square className="w-3 h-3 text-slate-400" />}
            {autoSync ? 'עדכון אוטומטי פעיל' : 'הפעל עדכון חי'}
          </button>

          <button
            onClick={() => fetchLiveOrdersAndCustomers()}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm cursor-pointer"
            title="סנכרן כעת ידנית"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10 px-4">
        <button
          onClick={() => setActiveTab('sync')}
          className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'sync' 
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          לוח בקרה וסנכרון ראשי ({liveOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('crm')}
          className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'crm' 
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          כרטיסי לקוח דינמיים CRM ({customerTabs.length})
        </button>

        <button
          onClick={() => setActiveTab('dict')}
          className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'dict' 
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          מילון מק״טים לוגיסטי
        </button>
      </div>

      {/* Main Tab Contents */}
      <div className="p-6">
        
        {/* TAB 1: SYNC & LIVE MASTER LOGS */}
        {activeTab === 'sync' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Live Orders Feed */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    לוג הזמנות פעיל - לוג_הזמנות_מערכת
                  </h4>
                  <span className="text-[10px] text-slate-400">מתעדכן אוטומטית מגליון גוגל</span>
                </div>

                {loadingOrders && liveOrders.length === 0 ? (
                  /* Skeleton Loader */
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800/60 h-16 rounded-xl border border-slate-200/50 dark:border-slate-800/80"></div>
                    ))}
                  </div>
                ) : liveOrders.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-bold">לא נמצאו הזמנות בגליון Master 'לוג_הזמנות_מערכת'</p>
                    <p className="text-[10px] text-slate-400 mt-1">ודא שהזנת שורות בגליון או בצע יצוא ראשוני של הנתונים המקומיים לגליון</p>
                  </div>
                ) : (
                  <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm max-h-[450px] overflow-y-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-black border-b border-slate-200 dark:border-slate-800">
                          <th className="p-3">מספר הזמנה</th>
                          <th className="p-3">לקוח</th>
                          <th className="p-3">מחסן</th>
                          <th className="p-3">פריטים</th>
                          <th className="p-3">סה״כ</th>
                          <th className="p-3">סטטוס</th>
                          <th className="p-3">פעולה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {liveOrders.map((order, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="p-3 font-mono font-black text-blue-600 dark:text-blue-400">{order.order_number}</td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{order.customer_name}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">{order.warehouse}</td>
                            <td className="p-3 max-w-[150px] truncate text-slate-600 dark:text-slate-400" title={order.items_string}>
                              {order.items_string}
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {order.total_amount ? `₪${Number(order.total_amount).toLocaleString()}` : '₪0'}
                            </td>
                            <td className="p-3">
                              <span className={`inline-block px-2.5 py-1 text-[10px] font-black rounded-full ${getStatusColor(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => {
                                  setEditingOrder(order);
                                  setEditStatus(order.status);
                                  setEditRejection(order.rejection_reason || '');
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:hover:bg-blue-950/60 dark:text-blue-400 rounded-lg border border-blue-200/40 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                ערוך שורה
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right Column: Console sync log & stats */}
              <div className="lg:col-span-4 space-y-4">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">לוג וסטטוס מסוף</h4>
                
                <div className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">חיבור Google REST Webapp:</span>
                    <span className="text-emerald-500 font-black">פעיל ✓</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/50 dark:border-slate-800/80 pt-2">
                    <span className="text-slate-400 font-bold">סך הכל שורות מאסטר:</span>
                    <span className="font-mono font-black text-slate-700 dark:text-slate-300">{liveOrders.length}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/50 dark:border-slate-800/80 pt-2">
                    <span className="text-slate-400 font-bold">מילון פריטים:</span>
                    <span className="font-mono font-black text-slate-700 dark:text-slate-300">{dictionaryItems.length} מוצרים</span>
                  </div>
                </div>

                <div className="bg-slate-900 text-slate-300 font-mono text-[10px] p-4 rounded-xl h-[280px] flex flex-col justify-between border border-slate-800 shadow-inner">
                  <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar" dir="ltr">
                    <p className="text-blue-400 font-bold border-b border-slate-800 pb-1 mb-2 text-right" dir="rtl">💬 תיעוד פעילות API לוגיסטי</p>
                    {syncLogs.length === 0 ? (
                      <p className="text-slate-500 italic text-center py-10">ממתין לפעימת API ראשונה...</p>
                    ) : (
                      syncLogs.map((log, i) => (
                        <div key={i} className="leading-relaxed hover:bg-slate-800/40 px-1 rounded transition-colors break-words text-left">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-slate-800 pt-2 mt-2 flex justify-between items-center text-[9px] text-slate-500" dir="rtl">
                    <span>ערוץ REST Webapp</span>
                    <span>SBN Live API 1.1</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: DYNAMIC CUSTOMER CRM CARDS */}
        {activeTab === 'crm' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Sidebar: All Dynamic Sheet names representing customer accounts */}
              <div className="lg:col-span-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">
                    כרטיסי לקוח דינמיים בגליון
                  </h4>
                  <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-0.5 rounded-full font-black">
                    {customerTabs.length} גליונות
                  </span>
                </div>

                {loadingCustomers && customerTabs.length === 0 ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800 h-12 rounded-xl"></div>
                    ))}
                  </div>
                ) : customerTabs.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs font-bold">
                    לא נמצאו כרטיסי לקוח בגליון.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {customerTabs.map((customer, idx) => {
                      const isSelected = selectedCustomer?.name === customer.name;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectCustomer(customer)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-right cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10 scale-[1.01]'
                              : 'bg-white hover:bg-slate-50/80 dark:bg-slate-900 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            }`}>
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-black">{customer.name}</h5>
                              <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                {customer.rowCount} שורות היסטוריה
                              </p>
                            </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-300'}`} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CRM Card Content View (Loads sheets dynamically) */}
              <div className="lg:col-span-8 space-y-4">
                {selectedCustomer ? (
                  <div className="bg-slate-50/50 dark:bg-slate-950/10 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                    
                    {/* Header customer selected */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-5">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                          {selectedCustomer.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-base font-black text-slate-800 dark:text-slate-100">{selectedCustomer.name}</h4>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full font-bold">
                            כרטיס לקוח מנוהל (Google Sheets CRM)
                          </span>
                        </div>
                      </div>

                      {/* Instant custom filter */}
                      <div className="relative">
                        <input
                          type="text"
                          value={crmSearch}
                          onChange={(e) => setCrmSearch(e.target.value)}
                          placeholder="חפש בהיסטוריית הכרטיס..."
                          className="w-full sm:w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 pl-9 text-xs text-right focus:outline-none focus:border-blue-500"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      </div>
                    </div>

                    {/* Customer Tab Ledger Grid */}
                    {loadingCustomerData ? (
                      /* Skeleton grid loading */
                      <div className="space-y-3.5 py-6">
                        <div className="h-6 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg w-1/3"></div>
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-lg"></div>
                          ))}
                        </div>
                      </div>
                    ) : customerData.length === 0 ? (
                      <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                        <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-bold">הכרטיס ריק או שאין היסטוריית הזמנות רשומה</p>
                        <p className="text-[10px] text-slate-400 mt-1">הזן הזמנות עבור לקוח זה כדי לראות אותן בייצוא הבא</p>
                      </div>
                    ) : (
                      <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm overflow-x-auto">
                        <table className="w-full text-right border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-black border-b border-slate-200 dark:border-slate-800">
                              <th className="p-3.5">מזהה הזמנה</th>
                              <th className="p-3.5">תאריך הזנה</th>
                              <th className="p-3.5">מחסן מקור</th>
                              <th className="p-3.5">פירוט חומרים ומוצרים</th>
                              <th className="p-3.5">סה״כ</th>
                              <th className="p-3.5">סטטוס</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {customerData
                              .filter(row => {
                                const term = crmSearch.toLowerCase();
                                return (
                                  (row.order_number && row.order_number.toLowerCase().includes(term)) ||
                                  (row.items_string && row.items_string.toLowerCase().includes(term)) ||
                                  (row.warehouse && row.warehouse.toLowerCase().includes(term)) ||
                                  (row.status && row.status.toLowerCase().includes(term))
                                );
                              })
                              .map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                  <td className="p-3.5 font-mono font-black text-blue-600 dark:text-blue-400">{row.order_number}</td>
                                  <td className="p-3.5 text-slate-400 font-mono text-[10px]">
                                    {row.timestamp ? new Date(row.timestamp).toLocaleString('he-IL') : 'לא צוין'}
                                  </td>
                                  <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">{row.warehouse}</td>
                                  <td className="p-3.5 text-slate-600 dark:text-slate-400">{row.items_string}</td>
                                  <td className="p-3.5 font-mono font-black text-slate-800 dark:text-slate-200">
                                    {row.total_amount ? `₪${Number(row.total_amount).toLocaleString()}` : '₪0'}
                                  </td>
                                  <td className="p-3.5">
                                    <span className={`inline-block px-2.5 py-1 text-[10px] font-black rounded-full ${getStatusColor(row.status)}`}>
                                      {row.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/20 dark:bg-slate-900/10">
                    <User className="w-10 h-10 text-slate-300 animate-pulse mb-3" />
                    <h4 className="text-xs font-black text-slate-600 dark:text-slate-400">טרם נבחר כרטיס לקוח</h4>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs text-center">בחר את אחד מגליונות הלקוח הפעילים בסרגל הצד כדי לטעון ולחקור את המאזן הפיננסי שלו בזמן אמת</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: LOGISTICS DICTIONARY (SKU MANAGE) */}
        {activeTab === 'dict' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Registering new catalog item to 'מילון_לוגיסטי' */}
              <div className="lg:col-span-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">הוספת פריט קטלוג חדש</h4>
                </div>

                <form onSubmit={handleAddDictionaryItem} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold block">מק"ט לוגיסטי (SKU):</label>
                    <input
                      type="text"
                      required
                      placeholder="לדוגמה: CEM-PORT-50"
                      value={newSku}
                      onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-right focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold block">שם המוצר/חומר:</label>
                    <input
                      type="text"
                      required
                      placeholder='לדוגמה: מלט פורטלנד 50 ק"ג'
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-right focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold block">כמות ממוצעת למשטח (Pack Qty):</label>
                    <input
                      type="number"
                      required
                      value={newQty}
                      onChange={(e) => setNewQty(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-right font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-bold block">דורש שק בלה?</label>
                      <select
                        value={newBag}
                        onChange={(e) => setNewBag(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-right focus:outline-none focus:border-blue-500"
                      >
                        <option value="כן">כן</option>
                        <option value="לא">לא</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-bold block">דורש משטח עץ?</label>
                      <select
                        value={newPallet}
                        onChange={(e) => setNewPallet(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-right focus:outline-none focus:border-blue-500"
                      >
                        <option value="כן">כן</option>
                        <option value="לא">לא</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingDict}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-xs font-black rounded-xl cursor-pointer shadow-md shadow-blue-500/10 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {savingDict ? 'רושם פריט בגליון...' : 'שמור מק״ט חדש'}
                  </button>
                </form>
              </div>

              {/* Right Column: Displaying SKU Dictionary list loaded from Google Sheet */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">
                    מילון פריטים רשום (מילון_לוגיסטי)
                  </h4>
                  <span className="text-[10px] text-slate-400 font-bold">סונכרן מגליון גוגל</span>
                </div>

                {dictionaryItems.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <p className="text-xs text-slate-400 font-bold">לא נמצאו פריטי מילון רשומים בגליון</p>
                  </div>
                ) : (
                  <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-black border-b border-slate-200 dark:border-slate-800">
                          <th className="p-3">קוד מק״ט</th>
                          <th className="p-3">שם החומר / פריט קטלוגי</th>
                          <th className="p-3">כמות למשטח</th>
                          <th className="p-3">מצריך בלה</th>
                          <th className="p-3">מצריך משטח עץ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dictionaryItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                            <td className="p-3 font-mono font-black text-blue-600 dark:text-blue-400">{item.sku}</td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                            <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{item.qty_per_pallet} יח'</td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.requires_bag === 'כן' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {item.requires_bag}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.requires_pallet === 'כן' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {item.requires_pallet}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Editing Order Status Modal (Drawer Panel Overlay) */}
      <AnimatePresence>
        {editingOrder && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-right"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  עדכון סטטוס הזמנה: {editingOrder.order_number}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveOrderEdit} className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <p><strong>לקוח משויך:</strong> {editingOrder.customer_name}</p>
                  <p><strong>פירוט פריטים:</strong> {editingOrder.items_string}</p>
                  <p><strong>מחסן מוצא:</strong> {editingOrder.warehouse}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold block">סטטוס משלוח נוכחי:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-xs text-right focus:outline-none focus:border-blue-500 font-bold"
                  >
                    <option value="ממתין">ממתין (Pending Approval)</option>
                    <option value="בטיפול">בטיפול (In Progress)</option>
                    <option value="בדרך">בדרך (On the Road)</option>
                    <option value="נמסר">נמסר (Delivered)</option>
                    <option value="בוטל">מבוטל (Cancelled)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold block">סיבת דחייה / הערה מנהלתית:</label>
                  <textarea
                    rows={3}
                    value={editRejection}
                    onChange={(e) => setEditRejection(e.target.value)}
                    placeholder="הערה זו תופיע ישירות בגליון..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-right focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingOrder}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-xs font-black rounded-xl cursor-pointer shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {savingOrder ? 'מעדכן בשני הגליונות...' : 'שמור וסנכרן'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingOrder(null)}
                    className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
