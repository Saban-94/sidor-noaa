import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, Database, AlertTriangle, User, ChevronRight, Edit3, Check, Tag, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ה-URL המלא של ה-Deployment שלך
const GOOGLE_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbzZPSpu15sbrfuWVwzYEcSKYhTCXG6jPJlgqvKuBBCQaZTR8gT9n7YX3AXnaLZs_vThOA/exec";

export default function GoogleSheetsSync() {
  const [activeTab, setActiveTab] = useState<'sync' | 'crm' | 'dict'>('sync');
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [customerTabs, setCustomerTabs] = useState<any[]>([]);
  const [dictionaryItems, setDictionaryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [pollCount, setPollCount] = useState(0);

  const addLog = (msg: string) => setSyncLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);

  const fetchData = async (action: string, params: string = "") => {
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_API_URL}?action=${action}${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err: any) {
      addLog(`❌ שגיאת API (${action}): ${err.message}`);
      return null;
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    addLog("מתחיל סנכרון חי מול גוגל...");
    
    // קריאה ישירה ל-API ללא Proxy
    const orders = await fetchData('getLiveOrders');
    const customers = await fetchData('getCustomerList');
    const dict = await fetchData('getDictionary');

    if (orders) setLiveOrders(orders);
    if (customers) setCustomerTabs(customers);
    if (dict) setDictionaryItems(dict);
    
    setPollCount(prev => prev + 1);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 10000); // רענון כל 10 שניות
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen" dir="rtl">
      <h1 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">מרכז הזמנות חי - SBN Logistics</h1>
      
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex gap-4 mb-6">
          <button onClick={() => setActiveTab('sync')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">לוג הזמנות</button>
          <button onClick={() => setActiveTab('crm')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold">כרטיסי לקוח</button>
        </div>

        {activeTab === 'sync' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-950 text-slate-500">
                  <th className="p-3">הזמנה</th>
                  <th className="p-3">לקוח</th>
                  <th className="p-3">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {liveOrders.map((order: any, idx: number) => (
                  <tr key={idx} className="border-b dark:border-slate-700">
                    <td className="p-3 font-mono">{order.order_number}</td>
                    <td className="p-3">{order.customer_name}</td>
                    <td className="p-3">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
