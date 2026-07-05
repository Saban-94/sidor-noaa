import React from 'react';
import { AccessibilityPreferences } from '../types';
import { 
  Eye, 
  Volume2, 
  Sparkles, 
  Sliders, 
  RefreshCw, 
  Wifi, 
  ShieldCheck, 
  HelpCircle,
  Moon,
  Sun
} from 'lucide-react';

interface SettingsPanelProps {
  preferences: AccessibilityPreferences;
  onUpdatePreferences: (prefs: Partial<AccessibilityPreferences>) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export default function SettingsPanel({
  preferences,
  onUpdatePreferences,
  isDark,
  onToggleTheme
}: SettingsPanelProps) {
  
  const handleToggleSound = () => {
    onUpdatePreferences({ soundAlerts: !preferences.soundAlerts });
  };

  const handleToggleContrast = () => {
    onUpdatePreferences({ highContrast: !preferences.highContrast });
  };

  const handleToggleMotion = () => {
    onUpdatePreferences({ reduceMotion: !preferences.reduceMotion });
  };

  const handleFontChange = (size: AccessibilityPreferences['fontSize']) => {
    onUpdatePreferences({ fontSize: size });
  };

  const handleResetCache = () => {
    if (confirm("האם לאפס את הגדרות התצוגה השמורות בדפדפן (localStorage)?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-right" dir="rtl">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-base font-black flex items-center gap-2 text-white">
          <Sliders className="w-5 h-5 text-amber-500" />
          לוח נגישות והעדפות מערכת
        </h2>
        <p className="text-[11px] text-slate-400 mt-1">
          התאמה אישית של חווית השימוש, שיפור הנגישות הראייתית והגדרת התראות קוליות בחדר הבקרה
        </p>
      </div>

      {/* Light / Dark Mode Toggle Section */}
      <div className="bg-slate-950/50 p-4 border border-slate-800/80 rounded-2xl flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white">מצב תצוגה (Light / Dark)</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">מעבר מהיר בין תצוגת לילה חשוכה לבין תצוגת יום בהירה</p>
        </div>

        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              מצב יום (בהיר)
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-blue-400" />
              מצב לילה (כהה)
            </>
          )}
        </button>
      </div>

      {/* Accessibility preferences */}
      <div className="space-y-4">
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">נגישות ראייתית וקולית</h3>
        
        {/* Font size */}
        <div className="bg-slate-950/30 p-4 border border-slate-800/40 rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-white">גודל גופני המערכת (Font Size)</span>
            <span className="text-[10px] text-slate-400">הגדלת הכתב לנוחות קריאה</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['normal', 'large', 'xlarge'] as const).map((size) => {
              const labels = { normal: 'רגיל', large: 'גדול', xlarge: 'ענק' };
              return (
                <button
                  key={size}
                  onClick={() => handleFontChange(size)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    preferences.fontSize === size
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-300'
                  }`}
                >
                  {labels[size]}
                </button>
              );
            })}
          </div>
        </div>

        {/* High Contrast */}
        <div className="bg-slate-950/30 p-4 border border-slate-800/40 rounded-2xl flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white">מצב ניגודיות גבוהה</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">מדגיש גבולות וצבעים לטובת מוגבלות ראייה</p>
          </div>
          <button
            onClick={handleToggleContrast}
            className={`w-11 h-6 rounded-full p-1 transition-all cursor-pointer ${preferences.highContrast ? 'bg-amber-500' : 'bg-slate-800'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${preferences.highContrast ? '-translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Reduce Motion */}
        <div className="bg-slate-950/30 p-4 border border-slate-800/40 rounded-2xl flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white">הפחתת אנימציות ומעברים</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">מבטל תנועה דינמית ומעברים חלקים</p>
          </div>
          <button
            onClick={handleToggleMotion}
            className={`w-11 h-6 rounded-full p-1 transition-all cursor-pointer ${preferences.reduceMotion ? 'bg-amber-500' : 'bg-slate-800'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${preferences.reduceMotion ? '-translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Sound alerts toggle */}
        <div className="bg-slate-950/30 p-4 border border-slate-800/40 rounded-2xl flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-amber-500" />
              צופר התראות קוליות (Alert Sound)
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">השמעת התראות קוליות בכל כניסת הזמנה חריגה (❌)</p>
          </div>
          <button
            onClick={handleToggleSound}
            className={`w-11 h-6 rounded-full p-1 transition-all cursor-pointer ${preferences.soundAlerts ? 'bg-amber-500' : 'bg-slate-800'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${preferences.soundAlerts ? '-translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* System info */}
      <div className="border-t border-slate-800 pt-5 space-y-3 text-xs">
        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">חיבוריות ואבטחה</h4>
        
        <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800/60 text-[10px] space-y-2 text-slate-400">
          <div className="flex justify-between">
            <span>סטטוס חיבור Firestore:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              מחובר ומאזין ישירות (onSnapshot)
            </span>
          </div>

          <div className="flex justify-between">
            <span>שרת קצה (Backend Server):</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              מקוון (API Secure Proxy)
            </span>
          </div>

          <div className="flex justify-between">
            <span>סביבת ריצה:</span>
            <span className="font-mono text-slate-300">Cloud Run Containers (Port 3000)</span>
          </div>
        </div>

        <button
          onClick={handleResetCache}
          className="w-full py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-850 text-center cursor-pointer"
        >
          אפס הגדרות מטמון מקומי
        </button>
      </div>

    </div>
  );
}
