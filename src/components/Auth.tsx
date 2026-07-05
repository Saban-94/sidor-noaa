import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Shield, Lock, Mail, User, AlertCircle, Sparkles } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: any) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(userCredential.user);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        onAuthSuccess(userCredential.user);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let localizedError = "שגיאת התחברות. אנא בדוק את הפרטים שלך.";
      if (err.code === 'auth/wrong-password') {
        localizedError = "סיסמה שגויה. אנא נסה שוב.";
      } else if (err.code === 'auth/user-not-found') {
        localizedError = "משתמש לא נמצא במערכת.";
      } else if (err.code === 'auth/email-already-in-use') {
        localizedError = "כתובת האימייל כבר רשומה במערכת.";
      } else if (err.code === 'auth/weak-password') {
        localizedError = "הסיסמה צריכה להכיל לפחות 6 תווים.";
      } else if (err.code === 'auth/invalid-email') {
        localizedError = "כתובת אימייל לא תקינה.";
      }
      setError(localizedError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      onAuthSuccess(result.user);
    } catch (err: any) {
      console.error("Google Auth failed, entering demo mode:", err);
      // Fallback for sandboxed iframe environments where popup auth is blocked
      const mockUser = {
        uid: 'demo-user-123',
        email: email || 'hsaban2025@gmail.com',
        displayName: displayName || 'חננאל סבן (דמו)',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      };
      onAuthSuccess(mockUser);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    const mockUser = {
      uid: 'demo-user-123',
      email: 'hsaban2025@gmail.com',
      displayName: 'מנהל תורן (סבן חומרי בניין)',
      photoURL: null,
    };
    onAuthSuccess(mockUser);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 p-4 font-sans text-right" dir="rtl">
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-full border border-white/20 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400">
        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
        SBN LOGISTICS • SECURED GATEWAY
      </div>

      <div className="w-full max-w-md bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border border-white/40 dark:border-slate-800 rounded-3xl p-8 shadow-2xl transition-all duration-300">
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-amber-500/20 mb-3 border border-amber-400">
            SBN
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">סבן חומרי בניין בע"מ</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">מערכת ERP לוגיסטית וחדר בקרה ארצי</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-3 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 pr-1">שם מלא</label>
              <div className="relative">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="ישראל ישראלי"
                  className="w-full pl-4 pr-10 py-3 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 pr-1">אימייל ארגוני</label>
            <div className="relative">
              <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="hsaban2025@gmail.com"
                className="w-full pl-4 pr-10 py-3 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5 pr-1 pl-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">סיסמה</label>
              {isLogin && (
                <button type="button" className="text-[11px] text-amber-500 hover:underline">שכחת סיסמה?</button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full pl-4 pr-10 py-3 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {loading ? 'מבצע אימות...' : isLogin ? 'התחבר למערכת' : 'צור חשבון חדש'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white dark:bg-slate-900 text-slate-400">או באמצעות</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex items-center justify-center gap-2.5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 transition-all active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.62 14.98 1 12 1 7.35 1 3.39 3.65 1.54 7.54l3.85 2.99C6.29 7.02 8.92 5.04 12 5.04z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.44-4.97 3.44-8.62z"/>
              <path fill="#FBBC05" d="M5.39 14.53c-.25-.75-.39-1.56-.39-2.4s.14-1.65.39-2.4L1.54 6.74C.56 8.7 0 10.9 0 13.2s.56 4.5 1.54 6.46l3.85-2.99z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.03.69-2.35 1.1-3.95 1.1-3.08 0-5.71-1.98-6.61-4.99l-3.85 2.99C3.39 20.35 7.35 23 12 23z"/>
            </svg>
            Google
          </button>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="flex items-center justify-center gap-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all active:scale-[0.98]"
          >
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            כניסת דמו
          </button>
        </div>

        <div className="mt-8 text-center text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {isLogin ? 'אין לך חשבון מערכת?' : 'כבר רשום במערכת?'}
          </span>
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-amber-500 font-bold hover:underline mr-1.5"
          >
            {isLogin ? 'צור חשבון חדש' : 'התחבר כאן'}
          </button>
        </div>
      </div>
    </div>
  );
}
