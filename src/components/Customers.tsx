import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { sheetsFetcher } from '../lib/fetcher';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer, Order } from '../types';
import { 
  Users, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign, 
  Layers, 
  Calendar, 
  ArrowLeftRight, 
  TrendingUp, 
  Search, 
  UserPlus, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Briefcase,
  FileSpreadsheet,
  Package,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Create / Edit customer states
  const [showAddModal, setShowAddModal] = useState(false);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cBalance, setCBalance] = useState(0);
  const [cUnreturnedPallets, setCUnreturnedPallets] = useState(0);
  const [cUnreturnedBags, setCUnreturnedBags] = useState(0);

  const [rawCustomers, setRawCustomers] = useState<any[]>([]); // Firestore metadata

  // 1. Fetch live customer sheet names
  const { data: sheetCustomerNames } = useSWR(
    '/api/sheets/proxy?action=getCustomerList',
    sheetsFetcher,
    { refreshInterval: 5000 }
  );

  // 2. Fetch live sheet orders
  const { data: sheetOrders } = useSWR(
    '/api/sheets/proxy?action=getLiveOrders',
    sheetsFetcher,
    { refreshInterval: 5000 }
  );

  // 3. Listen to Firestore customers for phone, email, address metadata in real-time
  useEffect(() => {
    const q = collection(db, 'customers');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawCustomers(list);
    });
    return () => unsubscribe();
  }, []);

  // Sync sheet orders
  useEffect(() => {
    if (sheetOrders && Array.isArray(sheetOrders)) {
      setOrders(sheetOrders);
    }
  }, [sheetOrders]);

  // Merge SWR Customer Lists with Firestore metadata, live unreturned counts, and live balances
  useEffect(() => {
    if (!sheetCustomerNames || !Array.isArray(sheetCustomerNames)) {
      return;
    }

    const merged = sheetCustomerNames.map((sheetCust: any) => {
      const fsCust = rawCustomers.find(c => c.name.trim().toLowerCase() === sheetCust.name.trim().toLowerCase());
      const custOrders = orders.filter(o => o.customer_name.trim().toLowerCase() === sheetCust.name.trim().toLowerCase());
      
      const unreturnedPallets = custOrders.filter(o => o.pallet_status === '❌' && o.status !== 'בוטל').length;
      const unreturnedBags = custOrders.filter(o => o.deposit_status === '❌' && o.status !== 'בוטל').length;
      
      const totalAmountSum = custOrders
        .filter(o => o.status !== 'בוטל')
        .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

      return {
        id: fsCust?.id || sheetCust.name,
        name: sheetCust.name,
        phone: fsCust?.phone || 'לא צוין טלפון',
        email: fsCust?.email || 'לא צוין אימייל',
        address: fsCust?.address || 'לא צוין כתובת',
        balance: fsCust?.balance !== undefined ? fsCust.balance : totalAmountSum,
        unreturned_pallets: unreturnedPallets,
        unreturned_bags: unreturnedBags,
      };
    });

    setCustomers(merged);
    setLoading(false);
  }, [sheetCustomerNames, rawCustomers, orders]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) {
      alert("נא להזין שם לקוח");
      return;
    }

    try {
      // 1. Write to Firestore so metadata exists
      await addDoc(collection(db, 'customers'), {
        name: cName,
        phone: cPhone,
        email: cEmail,
        address: cAddress,
        balance: Number(cBalance),
        unreturned_pallets: Number(cUnreturnedPallets),
        unreturned_bags: Number(cUnreturnedBags)
      });
      
      // 2. Add placeholder order to initialize customer tab on Google Sheets
      try {
        const orderNum = `SBN-${Math.floor(10000 + Math.random() * 90000)}`;
        const placeholderOrder = {
          timestamp: new Date().toISOString(),
          order_number: orderNum,
          customer_name: cName,
          warehouse: 'מחסן מרכז (רמלה)',
          items_string: 'הקמת כרטיס לקוח - יתרת פתיחה',
          deposit_status: Number(cUnreturnedBags) > 0 ? '❌' : 'OK' as const,
          pallet_status: Number(cUnreturnedPallets) > 0 ? '❌' : 'OK' as const,
          status: 'ממתין' as const,
          rejection_reason: '',
          total_amount: Number(cBalance)
        };
        
        await addDoc(collection(db, 'orders'), placeholderOrder);

        // Fetch remaining data to run a full sync All
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
        console.error("Sheets customer tab initialization failed:", syncErr);
      }

      setShowAddModal(false);
      // Reset
      setCName('');
      setCPhone('');
      setCEmail('');
      setCAddress('');
      setCBalance(0);
      setCUnreturnedPallets(0);
      setCUnreturnedBags(0);
    } catch (err) {
      console.error("Error adding customer:", err);
    }
  };

  const handleDeleteCustomer = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting row
    if (confirm("האם למחוק לקוח זה?")) {
      try {
        await deleteDoc(doc(db, 'customers', id));
        if (selectedCustomer?.id === id) {
          setSelectedCustomer(null);
        }
      } catch (err) {
        console.error("Error deleting customer:", err);
      }
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.phone && c.phone.includes(search))
  );

  // Get specific customer orders
  const getCustomerOrders = (customerName: string) => {
    return orders.filter(o => o.customer_name.toLowerCase() === customerName.toLowerCase());
  };

  // Generate Custom SVG Chart Data for selected customer
  const renderActivityChart = (customerName: string) => {
    const customerOrders = getCustomerOrders(customerName);
    
    // Group orders by month (last 6 months)
    const monthsHebrew = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
    const currentMonthIndex = new Date().getMonth();
    
    // Create an array for the last 6 months
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(currentMonthIndex - 5 + i);
      return {
        monthName: monthsHebrew[d.getMonth()],
        monthNum: d.getMonth(),
        year: d.getFullYear(),
        count: 0,
        volume: 0
      };
    });

    // Populate order counts
    customerOrders.forEach(o => {
      if (!o.timestamp) return;
      const oDate = new Date(o.timestamp);
      const oMonth = oDate.getMonth();
      const oYear = oDate.getFullYear();
      
      const foundMonth = last6Months.find(m => m.monthNum === oMonth && m.year === oYear);
      if (foundMonth) {
        foundMonth.count += 1;
        foundMonth.volume += o.total_amount || 1000;
      }
    });

    // Chart dimensions
    const width = 450;
    const height = 150;
    const padding = 25;
    const maxVal = Math.max(...last6Months.map(m => m.count), 4); // minimum upper bound of 4 orders
    
    // Coordinates for bars or line points
    const points = last6Months.map((m, index) => {
      const x = padding + (index * (width - padding * 2) / 5);
      const y = height - padding - (m.count * (height - padding * 2) / maxVal);
      return { x, y, ...m };
    });

    return (
      <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">גרף פעילות חודשי (כמות הזמנות)</h4>
          <span className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            מגמת רכישות
          </span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Grid lines */}
          {[0, 1, 2, 3].map((g) => {
            const y = padding + (g * (height - padding * 2) / 3);
            const gridVal = Math.round(maxVal - (g * maxVal / 3));
            return (
              <g key={g}>
                <line 
                  x1={padding} 
                  y1={y} 
                  x2={width - padding} 
                  y2={y} 
                  stroke="currentColor" 
                  className="text-slate-200 dark:text-slate-800" 
                  strokeDasharray="4 4"
                />
                <text 
                  x={width - padding + 5} 
                  y={y + 3} 
                  textAnchor="start" 
                  className="fill-slate-400 text-[9px] font-sans"
                >
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Bar Charts with tooltips */}
          {points.map((p, index) => {
            const barWidth = 24;
            const barHeight = height - padding - p.y;
            return (
              <g key={index} className="group cursor-pointer">
                <rect
                  x={p.x - barWidth / 2}
                  y={p.y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  className="fill-amber-500/80 hover:fill-amber-500 transition-colors duration-150"
                />
                
                {/* Value tooltip on top of the bar */}
                <text
                  x={p.x}
                  y={p.y - 6}
                  textAnchor="middle"
                  className="fill-amber-600 dark:fill-amber-400 font-bold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {p.count} הזמנות
                </text>

                {/* X Axis labels */}
                <text
                  x={p.x}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 font-bold text-[10px]"
                >
                  {p.monthName}
                </text>
              </g>
            );
          })}

          {/* Bottom baseline */}
          <line 
            x1={padding} 
            y1={height - padding} 
            x2={width - padding} 
            y2={height - padding} 
            stroke="currentColor" 
            className="text-slate-300 dark:text-slate-700" 
            strokeWidth={1.5}
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-right" dir="rtl">
      
      {/* Left List Pane (Spans 2 cols on wide, 1 col on small) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              תיקי לקוחות ואובליגו
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ניהול יתרות כספיות, חוב משטחים לוגיסטי, היסטוריית הזמנות וכרטיסי לקוח מעודכנים
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            פתח תיק לקוח חדש
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="חפש לקוח לפי שם, טלפון או אימייל..."
            className="w-full pr-10 pl-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Customer Cards Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200/60">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400">טוען תיקי לקוחות...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center p-16 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200/60 text-slate-500 dark:text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto opacity-35" />
            <h3 className="font-bold text-sm">לא נמצאו לקוחות במאגר</h3>
            <p className="text-xs text-slate-400">הוסף לקוח חדש או שנה את החיפוש</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCustomers.map((c) => {
              const custOrders = getCustomerOrders(c.name);
              const isSelected = selectedCustomer?.id === c.id;
              const isDebtor = c.unreturned_pallets > 15 || c.unreturned_bags > 10;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                    isSelected 
                      ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5' 
                      : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
                  }`}
                >
                  <div>
                    {/* Header: Name and Trash Icon */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div>
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-amber-500 transition-colors">
                          {c.name}
                        </h3>
                        {c.address && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {c.address}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleDeleteCustomer(c.id, e)}
                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                        title="מחק כרטיס לקוח"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 my-4 text-center">
                      <div className="bg-slate-100/60 dark:bg-slate-950/40 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/50">
                        <span className="block text-[9px] font-bold text-slate-400 mb-0.5">יתרת אובליגו</span>
                        <span className={`text-xs font-black font-mono ${c.balance && c.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {c.balance ? c.balance.toLocaleString('he-IL') : 0} ₪
                        </span>
                      </div>

                      <div className={`p-2 rounded-xl border ${
                        c.unreturned_pallets > 15 
                          ? 'bg-red-500/5 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400' 
                          : 'bg-slate-100/60 dark:bg-slate-950/40 border-slate-200/40 dark:border-slate-800/50'
                      }`}>
                        <span className="block text-[9px] font-bold text-slate-400 mb-0.5">משטחים חסרים</span>
                        <span className="text-xs font-black font-mono">{c.unreturned_pallets || 0}</span>
                      </div>

                      <div className={`p-2 rounded-xl border ${
                        c.unreturned_bags > 10 
                          ? 'bg-red-500/5 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400' 
                          : 'bg-slate-100/60 dark:bg-slate-950/40 border-slate-200/40 dark:border-slate-800/50'
                      }`}>
                        <span className="block text-[9px] font-bold text-slate-400 mb-0.5">בלות חסרות</span>
                        <span className="text-xs font-black font-mono">{c.unreturned_bags || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footing info */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                    <span className="flex items-center gap-1 font-semibold">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                      {custOrders.length} הזמנות ביומן
                    </span>
                    {isDebtor && (
                      <span className="text-red-500 font-bold animate-pulse flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        חריגת ערבונות פעילה
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Detail Pane (1 Col on wide) */}
      <div className="space-y-6">
        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 px-1">תיק לקוח פעיל</h3>
        
        {selectedCustomer ? (
          <div className="bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            
            {/* Customer Brief */}
            <div className="text-center pb-5 border-b border-slate-200/60 dark:border-slate-800">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-xl font-bold border border-amber-500/20 mb-3">
                {selectedCustomer.name.charAt(0)}
              </div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{selectedCustomer.name}</h2>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-full font-bold mt-1 inline-block">
                מזהה לקוח: {selectedCustomer.id.slice(0, 8)}
              </span>
            </div>

            {/* Contact Card */}
            <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
              {selectedCustomer.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="font-mono">{selectedCustomer.phone}</span>
                </div>
              )}
              {selectedCustomer.email && (
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="font-mono truncate">{selectedCustomer.email}</span>
                </div>
              )}
              {selectedCustomer.address && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{selectedCustomer.address}</span>
                </div>
              )}
            </div>

            {/* Real-time Custom Activity Chart */}
            {renderActivityChart(selectedCustomer.name)}

            {/* Specific Customer Order Logs */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">היסטוריית הזמנות ביומן</h4>
              
              {getCustomerOrders(selectedCustomer.name).length === 0 ? (
                <p className="text-[11px] text-slate-400 py-3 bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                  אין הזמנות מתועדות עבור לקוח זה.
                </p>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-52 pr-1">
                  {getCustomerOrders(selectedCustomer.name).map((o) => (
                    <div key={o.id} className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800 rounded-xl text-xs flex justify-between items-center gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{o.order_number}</span>
                          <span className="text-[10px] text-slate-400">
                            {o.timestamp ? new Date(o.timestamp).toLocaleDateString('he-IL') : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[150px]">{o.items_string}</p>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="block font-bold text-slate-800 dark:text-slate-100 font-mono">
                          {o.total_amount ? o.total_amount.toLocaleString() : 0} ₪
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white/40 dark:bg-slate-900/40 border border-dashed border-slate-200/60 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs">
            <Users className="w-10 h-10 mx-auto opacity-30 text-slate-400 mb-3" />
            <p className="font-bold">טרם נבחר תיק לקוח</p>
            <p className="text-[11px] text-slate-400 mt-1">לחץ על אחד מכרטיסי הלקוח ברשימה מימין כדי להציג את גרף הפעילות וההזמנות שלו</p>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-right">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">פתיחת תיק לקוח חדש</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">שם הלקוח / חברה קבלנית</label>
                <input
                  type="text"
                  required
                  placeholder="סבן קבלנות בניין בע״מ"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">טלפון</label>
                  <input
                    type="text"
                    placeholder="052-1234567"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">אימייל</label>
                  <input
                    type="email"
                    placeholder="office@saban.co.il"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">כתובת רשומה</label>
                <input
                  type="text"
                  placeholder="רחוב הבנאי 15, אזור תעשייה חולון"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  value={cAddress}
                  onChange={(e) => setCAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">אובליגו (₪)</label>
                  <input
                    type="number"
                    className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800"
                    value={cBalance}
                    onChange={(e) => setCBalance(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">משטחים חסרים</label>
                  <input
                    type="number"
                    className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800"
                    value={cUnreturnedPallets}
                    onChange={(e) => setCUnreturnedPallets(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">בלות חסרות</label>
                  <input
                    type="number"
                    className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800"
                    value={cUnreturnedBags}
                    onChange={(e) => setCUnreturnedBags(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  פתח כרטיס
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
