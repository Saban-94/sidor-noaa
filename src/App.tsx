import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, seedInitialDataIfNeeded } from './lib/firebase';
import { AccessibilityPreferences } from './types';
import Auth from './components/Auth';
import LiveOrders from './components/LiveOrders';
import Customers from './components/Customers';
import Dictionary from './components/Dictionary';
import NoaChat from './components/NoaChat';
import SettingsPanel from './components/SettingsPanel';
import GoogleSheetsSync from './components/GoogleSheetsSync';
import { 
  Truck, 
  Users, 
  BookOpen, 
  Bot, 
  Sliders, 
  LogOut, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  User as UserIcon,
  Shield,
  Layers,
  Sparkles,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'customers' | 'dictionary' | 'chat' | 'settings'>('orders');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSheetsOffline, setIsSheetsOffline] = useState(false);

  // Subscribe to offline state change
  useEffect(() => {
    const handleOfflineChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsSheetsOffline(customEvent.detail);
    };
    window.addEventListener('sheets-offline-change', handleOfflineChange);
    return () => {
      window.removeEventListener('sheets-offline-change', handleOfflineChange);
    };
  }, []);

  // Theme State
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Accessibility Preferences
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(() => {
    const saved = localStorage.getItem('accessibility_prefs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* use default */ }
    }
    return {
      fontSize: 'normal',
      highContrast: false,
      reduceMotion: false,
      soundAlerts: true
    };
  });

  // Handle Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    // Run the Firestore seeding mechanism
    seedInitialDataIfNeeded();

    return () => unsubscribe();
  }, []);

  // Update Theme in DOM
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Update Accessibility Preferences in Local Storage
  const handleUpdatePreferences = (newPrefs: Partial<AccessibilityPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      localStorage.setItem('accessibility_prefs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogout = async () => {
    if (confirm("האם להתנתק ממערכת ERP SBN?")) {
      try {
        await signOut(auth);
        setUser(null);
      } catch (err) {
        console.error("Logout failed:", err);
        // Clean session even if firebase fails
        setUser(null);
      }
    }
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-amber-500/20 border border-amber-400">
          SBN
        </div>
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full w-1/2 bg-amber-500 rounded-full animate-[loading_1s_infinite_linear]" style={{ animationName: 'loading' }} />
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">מתחבר לשער הבקרה של סבן חומרי בניין בע"מ...</p>
      </div>
    );
  }

  // If not logged in, show elegant Auth gateway
  if (!user) {
    return <Auth onAuthSuccess={(u) => setUser(u)} />;
  }

  // Sidebar Menu Config
  const menuItems = [
    { id: 'orders' as const, label: 'מרכז הזמנות חי', icon: Truck, desc: 'מעקב הזמנות ופיקדונות' },
    { id: 'customers' as const, label: 'תיקי לקוחות', icon: Users, desc: 'אובליגו ויתרות משטחים' },
    { id: 'dictionary' as const, label: 'ניהול מילון לוגיסטי', icon: BookOpen, desc: 'הגדרות פריקה ומק"טים' },
    { id: 'chat' as const, label: 'נועה AI - חדר בקרה', icon: Bot, desc: 'עוזרת בקרה וחישובי המרה' },
    { id: 'settings' as const, label: 'הגדרות ונגישות', icon: Sliders, desc: 'לוח נגישות והעדפות' },
  ];

  // Font sizing styles
  const fontClass = 
    preferences.fontSize === 'large' 
      ? 'text-sm md:text-base' 
      : preferences.fontSize === 'xlarge' 
      ? 'text-base md:text-lg' 
      : 'text-xs md:text-sm';

  // Contrast boundaries styles
  const contrastClass = preferences.highContrast 
    ? 'border-2 border-slate-900 dark:border-white contrast-125' 
    : '';

  return (
    <div 
      className={`min-h-screen bg-slate-50 dark:bg-slate-950 font-sans flex flex-col lg:flex-row transition-colors duration-200 ${fontClass} ${contrastClass}`} 
      dir="rtl"
    >
      {/* Top Mobile Bar */}
      <header className="lg:hidden flex items-center justify-between px-5 py-4 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white font-extrabold text-lg border border-amber-400 shadow shadow-amber-500/15">
            SBN
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-800 dark:text-slate-100">סבן חומרי בניין בע"מ</h1>
            <p className="text-[10px] text-slate-400">חדר בקרה ארצי</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick theme toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop Layout (Always right side since dir is RTL) */}
      <aside className={`
        fixed lg:static inset-y-0 right-0 z-50 w-64 bg-slate-900 text-slate-100 border-l border-slate-800 flex flex-col justify-between p-5 transform transition-transform duration-300 lg:translate-x-0 shrink-0
        ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="space-y-6">
          {/* Close menu button on mobile */}
          <div className="flex justify-between items-center lg:hidden">
            <span className="text-xs font-black text-slate-400">תפריט בקרה</span>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SBN Logo */}
          <div className="p-2 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-tight text-orange-500">SBN Logistics</h1>
            <p className="text-xs text-slate-400 font-medium">סבן חומרי בניין בע"מ</p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all text-right group cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/15' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:translate-x-0.5'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="block leading-none">{item.label}</span>
                    <span className={`block text-[10px] mt-1 font-medium leading-none ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                      {item.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer User controls */}
        <div className="border-t border-slate-800 pt-5 space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-amber-500 flex items-center justify-center border border-slate-700 shadow-inner relative">
              <UserIcon className="w-5 h-5 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-slate-200 truncate leading-none">
                {user.displayName || 'משתמש מחובר'}
              </p>
              <p className="text-[9px] text-slate-500 truncate mt-1 leading-none font-mono">
                {user.email || 'hsaban2025@gmail.com'}
              </p>
            </div>
          </div>

          {/* Glowing system status widget */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">סטטוס מערכת</span>
              <span className={`w-2.5 h-2.5 rounded-full ${isSheetsOffline ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse'}`}></span>
            </div>
            <p className="text-[11px] font-mono text-slate-300 tracking-tighter">
              {isSheetsOffline ? 'SHEETS_API: OFFLINE ⚠️' : 'SHEETS_API: ONLINE ✓'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-300 transition-all cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
              {isDark ? 'מצב בהיר' : 'מצב כהה'}
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 rounded-lg text-[10px] font-bold text-red-400 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              התנתק
            </button>
          </div>

          <div className="text-center">
            <span className="text-[9px] font-mono text-slate-500 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3 text-orange-500" />
              SBN ERP v2.4 • {isSheetsOffline ? 'OFFLINE MODE' : 'ONLINE'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              {activeTab === 'orders' && 'לוח בקרה לוגיסטי - מרכז הזמנות חי'}
              {activeTab === 'customers' && 'ניהול תיקי לקוחות - אובליגו ופיקדונות'}
              {activeTab === 'dictionary' && 'מילון לוגיסטי ומק״טים'}
              {activeTab === 'chat' && 'נועה AI - חדר בקרה תבוני'}
              {activeTab === 'settings' && 'הגדרות מערכת ולוח נגישות'}
            </h2>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="flex gap-5">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">סטטוס מסד</span>
                <span className={`text-xs font-bold flex items-center gap-1 ${isSheetsOffline ? 'text-red-500' : 'text-emerald-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSheetsOffline ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                  {isSheetsOffline ? 'חיבור Google Sheets נכשל' : 'מחובר ל-Google Sheets Live'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">חוסר בפיקדונות</span>
                <span className="text-xs font-bold text-red-500">פיקוח אוטומטי</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 font-mono">
              {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
              {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'SB'}
            </div>
          </div>
        </header>

        {/* Main Content Scrollable Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={preferences.reduceMotion ? { opacity: 1 } : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={preferences.reduceMotion ? { opacity: 1 } : { opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto"
          >
            {activeTab === 'orders' && (
              <LiveOrders soundAlertsEnabled={preferences.soundAlerts} />
            )}
            
            {activeTab === 'customers' && (
              <Customers />
            )}

            {activeTab === 'dictionary' && (
              <Dictionary />
            )}

            {activeTab === 'chat' && (
              <NoaChat />
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <SettingsPanel 
                  preferences={preferences} 
                  onUpdatePreferences={handleUpdatePreferences} 
                  isDark={isDark} 
                  onToggleTheme={toggleTheme} 
                />
                <GoogleSheetsSync />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      </div>

      {/* Background ambient glow/visual elements */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-amber-500/5 dark:bg-amber-500/1 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/1 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Offline Notification */}
      {isSheetsOffline && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 bg-red-600 dark:bg-red-950 text-white dark:text-red-100 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-red-500 dark:border-red-900 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0"></span>
          <p className="text-xs font-black">
            שרת Google Sheets אינו זמין (Offline) • המערכת פועלת במצב מקומי מסונכרן
          </p>
        </div>
      )}
    </div>
  );
}
