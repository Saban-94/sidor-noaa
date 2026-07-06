import React, { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import { sheetsFetcher } from '../lib/fetcher';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, DictionaryItem } from '../types';
import { 
  Plus, 
  Search, 
  TrendingDown, 
  Volume2, 
  AlertTriangle, 
  CheckCircle, 
  Trash2, 
  Truck, 
  Clock, 
  Layers, 
  Check, 
  X,
  Package,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LiveOrdersProps {
  soundAlertsEnabled: boolean;
}

export default function LiveOrders({ soundAlertsEnabled }: LiveOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryItem[]>([]);
  
  // Toast notifications state
  const [toasts, setToasts] = useState<{ id: string; title: string; message: string; type: 'error' | 'success' }[]>([]);

  // Form states for new order
  const [customerName, setCustomerName] = useState('');
  const [warehouse, setWarehouse] = useState('מחסן מרכז (רמלה)');
  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [depositStatus, setDepositStatus] = useState<'OK' | '❌' | 'חלקית'>('OK');
  const [palletStatus, setPalletStatus] = useState<'OK' | '❌' | 'חלקית'>('OK');
  const [rejectionReason, setRejectionReason] = useState('');
  const [customItems, setCustomItems] = useState('');
  const [totalAmount, setTotalAmount] = useState(1200);

  // Track loaded orders to detect *newly added* orders for alarms
  const loadedOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Synthesize warning beep offline-compatible
  const playSyntheticAlertSound = () => {
    if (!soundAlertsEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Sequence: double distinct beep
      const playBeep = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = audioCtx.currentTime;
      playBeep(280, now, 0.18);
      playBeep(320, now + 0.22, 0.28);
    } catch (err) {
      console.warn("Failed to play synthesized alert sound:", err);
    }
  };

  const addToast = (title: string, message: string, type: 'error' | 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Poll live orders
  const { data: sheetOrders, mutate: mutateOrders } = useSWR(
    '/api/sheets/proxy?action=getLiveOrders',
    sheetsFetcher,
    { refreshInterval: 5000 }
  );

  // Poll dictionary
  const { data: sheetDictionary } = useSWR(
    '/api/sheets/proxy?action=getDictionary',
    sheetsFetcher,
    { refreshInterval: 10000 }
  );

  // Sync state with SWR Orders
  useEffect(() => {
    if (sheetOrders && Array.isArray(sheetOrders)) {
      setOrders(sheetOrders);
      setLoading(false);
      
      // Filter and check for new orders with issues (❌)
      sheetOrders.forEach((order) => {
        const orderId = order.order_number || order.id || '';
        if (orderId && !loadedOrderIdsRef.current.has(orderId)) {
          // If this is NOT the first load, and a new order arrives with a "❌" in deposit or pallet
          if (!isFirstLoadRef.current) {
            if (order.deposit_status === '❌' || order.pallet_status === '❌') {
              playSyntheticAlertSound();
              addToast(
                `חריגה קריטית בהזמנה ${order.order_number}`,
                `לקוח: ${order.customer_name}. בעיה ב${order.deposit_status === '❌' ? 'פיקדון בלה' : 'החזרת משטחים'}.`,
                'error'
              );
            } else {
              addToast(
                `הזמנה חדשה התקבלה`,
                `הזמנה מס׳ ${order.order_number} עבור ${order.customer_name} עודכנה בהצלחה.`,
                'success'
              );
            }
          }
          loadedOrderIdsRef.current.add(orderId);
        }
      });
      
      if (sheetOrders.length > 0) {
        isFirstLoadRef.current = false;
      }
    } else if (sheetOrders === undefined) {
      // Still loading initially
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [sheetOrders, soundAlertsEnabled]);

  // Sync state with SWR Dictionary
  useEffect(() => {
    if (sheetDictionary && Array.isArray(sheetDictionary)) {
      setDictionaryItems(sheetDictionary);
      if (sheetDictionary.length > 0 && !selectedSku) {
        setSelectedSku(sheetDictionary[0].sku);
      }
    }
  }, [sheetDictionary, selectedSku]);

  // Form handler for adding order
  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert("נא להזין שם לקוח");
      return;
    }

    // Determine order items details
    let itemsStr = customItems;
    if (!itemsStr && selectedSku) {
      const selected = dictionaryItems.find(d => d.sku === selectedSku);
      if (selected) {
        const totalUnits = selected.qty_per_pallet * quantity;
        itemsStr = `${selected.name} x ${totalUnits} יחידות (${quantity} משטחים)`;
      }
    }

    const orderNum = `SBN-${Math.floor(10000 + Math.random() * 90000)}`;

    try {
      // 1. Write to Firestore
      const newOrderData = {
        timestamp: new Date().toISOString(),
        order_number: orderNum,
        customer_name: customerName,
        warehouse,
        items_string: itemsStr || 'חומרי בניין מעורבים',
        deposit_status: depositStatus,
        pallet_status: palletStatus,
        status: 'ממתין' as const,
        rejection_reason: depositStatus === '❌' || palletStatus === '❌' ? rejectionReason || 'ממתין להסדרת ערבון' : '',
        total_amount: Number(totalAmount)
      };
      
      await addDoc(collection(db, 'orders'), newOrderData);

      // 2. Synchronize to Google Sheets
      try {
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const dictSnap = await getDocs(collection(db, 'dictionary'));
        const allOrders = ordersSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        const allDict = dictSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        
        await fetch('/api/sheets/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'syncAllFromFirebase',
            orders: allOrders,
            dictionary: allDict
          })
        });
      } catch (syncErr) {
        console.error("Sync to Sheets failed:", syncErr);
      }

      setShowAddModal(false);
      // Reset state
      setCustomerName('');
      setCustomItems('');
      setRejectionReason('');
      setQuantity(1);
      setDepositStatus('OK');
      setPalletStatus('OK');
      
      // Trigger instant revalidate
      mutateOrders();
    } catch (err) {
      console.error("Error creating order:", err);
      alert("שגיאה ברישום ההזמנה בשרת");
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const matchedOrder = orders.find(o => o.id === orderId);
      
      // Update Firestore
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
      
      // Update Google Sheets
      if (matchedOrder) {
        try {
          await fetch('/api/sheets/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'updateOrder',
              orderId: matchedOrder.order_number,
              status: newStatus,
              rejectionReason: matchedOrder.rejection_reason || '',
              customerName: matchedOrder.customer_name
            })
          });
        } catch (syncErr) {
          console.error("Sheets updateOrder call failed:", syncErr);
        }
      }
      
      mutateOrders();
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleUpdateRejection = async (orderId: string, text: string) => {
    try {
      const matchedOrder = orders.find(o => o.id === orderId);
      
      // Update Firestore
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { rejection_reason: text });
      
      // Update Google Sheets
      if (matchedOrder) {
        try {
          await fetch('/api/sheets/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'updateOrder',
              orderId: matchedOrder.order_number,
              status: matchedOrder.status,
              rejectionReason: text,
              customerName: matchedOrder.customer_name
            })
          });
        } catch (syncErr) {
          console.error("Sheets updateOrder reason call failed:", syncErr);
        }
      }
      
      mutateOrders();
    } catch (err) {
      console.error("Error updating rejection text:", err);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (confirm("האם למחוק הזמנה זו מהיומן?")) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
        
        // Sync to Sheets
        try {
          const ordersSnap = await getDocs(collection(db, 'orders'));
          const dictSnap = await getDocs(collection(db, 'dictionary'));
          const allOrders = ordersSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          const allDict = dictSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          
          await fetch('/api/sheets/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'syncAllFromFirebase',
              orders: allOrders,
              dictionary: allDict
            })
          });
        } catch (syncErr) {
          console.error("Sheets sync after delete failed:", syncErr);
        }
        
        addToast("הזמנה נמחקה", "ההזמנה הוסרה מיומן המערכת.", "success");
        mutateOrders();
      } catch (err) {
        console.error("Error deleting order:", err);
      }
    }
  };

  const filteredOrders = orders.filter((o) => {
    const searchVal = (search || '').toLowerCase();
    const matchesSearch = 
      (o?.customer_name || '').toLowerCase().includes(searchVal) || 
      (o?.order_number || '').toLowerCase().includes(searchVal) || 
      (o?.items_string || '').toLowerCase().includes(searchVal);
    
    const matchesStatus = statusFilter === 'all' ? true : o?.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Order['status']) => {
    const styles: Record<Order['status'], string> = {
      'ממתין': 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900',
      'בטיפול': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900',
      'בדרך': 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-900',
      'נמסר': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900',
      'בוטל': 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
    };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>{status}</span>;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast Render Component */}
      <div className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className={`p-4 rounded-2xl shadow-xl border backdrop-blur-md flex items-start gap-3 pointer-events-auto text-right ${
                t.type === 'error' 
                  ? 'bg-red-50/95 dark:bg-red-950/90 border-red-200 dark:border-red-900 text-red-900 dark:text-red-100' 
                  : 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100'
              }`}
            >
              <div className="p-1 rounded-lg bg-white/50 dark:bg-black/20">
                {t.type === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold leading-tight">{t.title}</h4>
                <p className="text-[11px] opacity-90 mt-1">{t.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Control Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            מרכז הזמנות ארצי חי
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            מעקב אחר משאיות, מחסנים, פיקדונות ואישורי פריקה בזמן אמת בחיבור Firestore ישיר
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all active:scale-[0.98] shadow-lg shadow-blue-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          קלוט הזמנה חדשה
        </button>
      </div>

      {/* Bento Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1 font-semibold uppercase tracking-wider">תפוקת מחסן ארצי</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">84%</span>
            <span className="text-[10px] text-green-500 mb-1 font-bold">+5.2% ↑</span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1 font-semibold uppercase tracking-wider">משאיות בטעינה ושינוע</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {orders.filter(o => o.status === 'בטיפול' || o.status === 'בדרך').length}
            </span>
            <span className="text-[10px] text-slate-400 mb-1">מתוך {orders.length} סה״כ</span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1 font-semibold uppercase tracking-wider">חריגות פיקדון / משטחים</p>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-bold ${
              orders.filter(o => o.deposit_status === '❌' || o.pallet_status === '❌').length > 0 
                ? 'text-red-500 dark:text-red-400' 
                : 'text-slate-800 dark:text-slate-100'
            }`}>
              {orders.filter(o => o.deposit_status === '❌' || o.pallet_status === '❌').length}
            </span>
            <span className="text-[10px] text-slate-400 mb-1">חריגות פעילות</span>
          </div>
        </div>

        {/* Stat 4 */}
        {(() => {
          const latestIssue = orders.find(o => o.deposit_status === '❌' || o.pallet_status === '❌') || orders[0];
          return (
            <div className={`p-4 rounded-xl border shadow-sm ${
              latestIssue && (latestIssue.deposit_status === '❌' || latestIssue.pallet_status === '❌')
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
                : 'bg-orange-50 dark:bg-amber-950/10 border-orange-100 dark:border-amber-900/40'
            }`}>
              <p className={`text-[10px] mb-1 font-semibold uppercase tracking-wider ${
                latestIssue && (latestIssue.deposit_status === '❌' || latestIssue.pallet_status === '❌')
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-orange-600 dark:text-amber-400'
              }`}>
                {latestIssue && (latestIssue.deposit_status === '❌' || latestIssue.pallet_status === '❌')
                  ? 'טיפול חריג דחוף ⚠️'
                  : 'הזמנה אחרונה'}
              </p>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate" title={latestIssue?.customer_name}>
                {latestIssue ? `${latestIssue.order_number} - ${latestIssue.customer_name}` : 'אין הזמנות כרגע'}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Filters Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/40 dark:bg-slate-900/40 p-4 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl">
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="חפש לפי לקוח, הזמנה או פריט..."
            className="w-full pr-10 pl-4 py-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">סנן סטטוס:</span>
          <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 flex-1">
            {['all', 'ממתין', 'בטיפול', 'בדרך', 'נמסר', 'בוטל'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === st 
                    ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm' 
                    : 'bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {st === 'all' ? 'הכל' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Live status indicators */}
        <div className="flex items-center justify-end gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30">
            <Volume2 className="w-3.5 h-3.5" />
            התראות קוליות: {soundAlertsEnabled ? 'פעיל 🔊' : 'מושתק 🔇'}
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded">
            סה"כ: {filteredOrders.length} פריטים
          </span>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400">מתחבר למחסן הנתונים של SBN...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400 space-y-2">
            <Package className="w-12 h-12 mx-auto opacity-30 text-slate-400" />
            <h3 className="font-bold text-sm">לא נמצאו הזמנות פעילות</h3>
            <p className="text-xs text-slate-400">נסה לשנות את מסנני החיפוש או הסטטוס</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="p-3.5 font-bold">שעה</th>
                  <th className="p-3.5 font-bold">מספר הזמנה</th>
                  <th className="p-3.5 font-bold">לקוח</th>
                  <th className="p-3.5 font-bold">מחסן מקור</th>
                  <th className="p-3.5 font-bold">פירוט פריטים</th>
                  <th className="p-3.5 font-bold text-center">ערבון בלות (שקים)</th>
                  <th className="p-3.5 font-bold text-center">החזרת משטחים</th>
                  <th className="p-3.5 font-bold">סטטוס משלוח</th>
                  <th className="p-3.5 font-bold text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/80">
                {filteredOrders.map((order) => {
                  // Perfect order checks: No issues in deposit and pallet
                  const isPerfect = order.deposit_status === 'OK' && order.pallet_status === 'OK';
                  const hasIssues = order.deposit_status === '❌' || order.pallet_status === '❌';
                  
                  const rowClass = isPerfect 
                    ? 'bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100' 
                    : hasIssues 
                    ? 'bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 text-rose-950 dark:text-rose-100'
                    : 'bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-950/10 dark:hover:bg-amber-950/20 text-amber-950 dark:text-amber-100';

                  return (
                    <tr key={order.id} className={`transition-all duration-150 ${rowClass}`}>
                      {/* Hour */}
                      <td className="p-3.5 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                        {order.timestamp ? new Date(order.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      
                      {/* Order Number */}
                      <td className="p-3.5 whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                          {order.order_number}
                        </span>
                      </td>

                      {/* Customer Name */}
                      <td className="p-3.5 font-bold">{order.customer_name}</td>

                      {/* Warehouse */}
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">{order.warehouse}</td>

                      {/* Items String */}
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 font-medium max-w-xs truncate" title={order.items_string}>
                        {order.items_string}
                      </td>

                      {/* Deposit Status */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          order.deposit_status === 'OK' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                            : order.deposit_status === '❌'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-extrabold animate-pulse'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {order.deposit_status === 'OK' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-red-600" />}
                          {order.deposit_status === 'OK' ? 'פיקדון תקין' : order.deposit_status === '❌' ? 'חסר פיקדון ❌' : 'חלקית'}
                        </span>
                      </td>

                      {/* Pallet Status */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          order.pallet_status === 'OK' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                            : order.pallet_status === '❌'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-extrabold animate-pulse'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {order.pallet_status === 'OK' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-red-600" />}
                          {order.pallet_status === 'OK' ? 'משטחים הוחזרו' : order.pallet_status === '❌' ? 'אין משטחים ❌' : 'חוב משטחים'}
                        </span>
                      </td>

                      {/* Status select controller */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(order.status)}
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateStatus(order.id, e.target.value as Order['status'])}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                          >
                            <option value="ממתין">ממתין</option>
                            <option value="בטיפול">בטיפול</option>
                            <option value="בדרך">בדרך</option>
                            <option value="נמסר">נמסר</option>
                            <option value="בוטל">בוטל</option>
                          </select>
                        </div>
                        {order.rejection_reason && (
                          <div className="mt-1 text-[10px] text-red-600 dark:text-red-400 flex items-center gap-1 font-medium bg-red-100/50 dark:bg-red-950/20 p-1 rounded max-w-xs">
                            <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                            <input
                              type="text"
                              className="bg-transparent border-none outline-none text-red-700 dark:text-red-400 w-full"
                              value={order.rejection_reason}
                              onChange={(e) => handleUpdateRejection(order.id, e.target.value)}
                            />
                          </div>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-all cursor-pointer"
                          title="מחק הזמנה מהיומן"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add New Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-right">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">קליטת הזמנה לוגיסטית חדשה</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddOrder} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">שם הלקוח</label>
                <input
                  type="text"
                  required
                  placeholder="לדוגמא: דניה סיבוס בע״מ"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              {/* Warehouse Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">מחסן פריקה</label>
                <select
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                >
                  <option value="מחסן מרכז (רמלה)">מחסן מרכז (רמלה)</option>
                  <option value="מחסן צפון (חיפה)">מחסן צפון (חיפה)</option>
                  <option value="מחסן דרום (אשדוד)">מחסן דרום (אשדוד)</option>
                  <option value="מחסן ירושלים (עטרות)">מחסן ירושלים (עטרות)</option>
                </select>
              </div>

              {/* SKU Selection & Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">בחר מוצר (ממילון)</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={selectedSku}
                    onChange={(e) => setSelectedSku(e.target.value)}
                  >
                    {dictionaryItems.map((item) => (
                      <option key={item.id} value={item.sku}>
                        {item.name} ({item.sku})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">כמות (משטחים/בלות)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Custom Item overrides */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">פירוט פריטים ידני (אופציונלי - עוקף את המילון)</label>
                <input
                  type="text"
                  placeholder="הזן תיאור מותאם אישית של החומרים והכמות..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={customItems}
                  onChange={(e) => setCustomItems(e.target.value)}
                />
              </div>

              {/* Status Issues Toggles */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">ערבון בלות (שקים)</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={depositStatus}
                    onChange={(e) => setDepositStatus(e.target.value as any)}
                  >
                    <option value="OK">OK (פיקדון מוסדר)</option>
                    <option value="❌">❌ חסר (התראת צופר!)</option>
                    <option value="חלקית">חלקית</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">החלפת משטחים ריקים</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={palletStatus}
                    onChange={(e) => setPalletStatus(e.target.value as any)}
                  >
                    <option value="OK">OK (משטחים סופקו)</option>
                    <option value="❌">❌ חסר (התראת צופר!)</option>
                    <option value="חלקית">חוב משטחים חתום</option>
                  </select>
                </div>
              </div>

              {/* Rejection / Warning reason */}
              {(depositStatus === '❌' || palletStatus === '❌' || depositStatus === 'חלקית' || palletStatus === 'חלקית') && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl">
                  <label className="block text-xs font-bold text-red-700 dark:text-red-400 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    פירוט סיבת העיכוב / חריגה
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="לדוגמא: הלקוח סירב לשלם פיקדון שק או לספק משטחי עץ תואמים."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-red-200 dark:border-red-900 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">שווי כספי מוערך (₪)</label>
                  <input
                    type="number"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/15 cursor-pointer"
                >
                  אשר ורשום הזמנה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
