import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { 
  Send, 
  Bot, 
  HelpCircle, 
  Sparkles, 
  AlertTriangle, 
  Layers, 
  ClipboardCheck, 
  CheckCircle,
  Clock,
  Terminal,
  Eraser
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function NoaChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'noa',
      text: `שלום לך. כאן נועה, מנהלת חדר הבקרה הלוגיסטי הארצי של <strong>סבן חומרי בניין (SBN)</strong>. <br/>
      אני עוקבת כאן אחרי הזרמת ההזמנות מ-Firestore, חובות משטחים, והתחייבויות פיקדון בלות בחיבור רציף.<br/><br/>
      שלא נתעכב, המשאיות צריכות לצאת לדרך! מה ברצונך לבדוק כרגע? 
      תוכל לשאול אותי על סיווג חריגות בלות, חישוב משקלים למשטח מלט, או לערוך סיכום מצב נוכחי של הלקוחות.`,
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Quick Action Pills
  const quickPills = [
    { label: '🔍 בדקי חריגות פיקדון', prompt: 'האם יש חריגות פיקדון של בלות או משטחים כרגע? הציגי טבלה של מי שמעוכב' },
    { label: '📦 חישוב משטחי מלט', prompt: 'כמה שקי מלט פורטלנד 50קג נכנסים ב-5 משטחים? מה המשקל הכולל?' },
    { label: '⚠️ חוקי משטחים ובלות', prompt: 'מהם חוקי הערבון הפיקדוני עבור בלות ומשטחי עץ ב-SBN?' },
    { label: '📊 סיכום לקוח - דניה סיבוס', prompt: 'הציגי סיכום מצב לוגיסטי וחובות משטחים עבור לקוח "דניה סיבוס"' }
  ];

  // Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || loading) return;

    // Create user message
    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputText('');
    setLoading(true);

    try {
      // Send messages array to server API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] })
      });

      if (!response.ok) {
        throw new Error('שגיאה בתקשורת עם השרת');
      }

      const data = await response.json();
      
      const noaMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'noa',
        text: data.text,
        timestamp: new Date().toISOString()
      };

      setMessages((prev) => [...prev, noaMsg]);
    } catch (err: any) {
      console.error(err);
      // Fail gracefully with direct operational response
      const errMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'noa',
        text: `חל עיכוב קשר עם השרת. כרגע לא הצלחתי לחשב פנייה זו, אך תהיה סמוך ובטוח שאני עדיין פוקחת עין על המערכת! בדוק את החיבור לרשת ונסה שוב.`,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm("האם לאפס את היסטוריית חדר הבקרה עם נועה?")) {
      setMessages([
        {
          id: 'init-1',
          sender: 'noa',
          text: 'שיחת חדר הבקרה אותחלה בהצלחה. ספק לי נתונים, או קרא לי למיין חריגות ב-Firestore!',
          timestamp: new Date().toISOString()
        }
      ]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px] bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm text-right" dir="rtl">
      
      {/* Chat Header */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20 shadow-inner relative">
            <Bot className="w-5 h-5 text-blue-600" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">נועה AI - מנהלת חדר בקרה</h3>
              <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">STRICT PERSONA</span>
            </div>
            <p className="text-[10px] text-slate-400">חדר בקרה ארצי SBN • מסונכרנת ל-Firestore ויחסי המרה</p>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
          title="אפס חדר בקרה"
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/20 dark:bg-slate-950/20 custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isNoa = m.sender === 'noa';
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex gap-3.5 max-w-[85%] ${isNoa ? 'mr-0 ml-auto' : 'mr-auto ml-0 flex-row-reverse'}`}
              >
                {/* Avatar Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                  isNoa 
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                    : 'bg-slate-800 text-slate-100 border-slate-700 dark:bg-slate-100 dark:text-slate-900'
                }`}>
                  {isNoa ? <Bot className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className="space-y-1">
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                    isNoa 
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm' 
                      : 'bg-amber-500 text-white border-amber-600 font-medium'
                  }`}>
                    {/* Safe HTML rendering for tables / summaries */}
                    {isNoa ? (
                      <div 
                        className="prose prose-slate dark:prose-invert max-w-none text-xs break-words space-y-2"
                        dangerouslySetInnerHTML={{ __html: m.text }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    )}
                  </div>
                  
                  {/* Time */}
                  <span className={`text-[9px] text-slate-400 block ${isNoa ? 'text-right' : 'text-left'}`}>
                    {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {loading && (
          <div className="flex gap-3.5 max-w-[80%] mr-0 ml-auto">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20 shrink-0">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-[10px] text-slate-400 font-medium mr-1">נועה מחשבת נתונים וחובות משטחים...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Pills Selection */}
      <div className="px-4 py-2 border-t border-slate-200/50 dark:border-slate-800/50 flex gap-2 overflow-x-auto bg-slate-50/40 dark:bg-slate-950/10 custom-scrollbar">
        {quickPills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(pill.prompt)}
            disabled={loading}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-[10px] font-bold shrink-0 shadow-sm hover:border-blue-500/50 transition-all cursor-pointer"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="שאל את נועה על פיקדונות, משטחים, או נתוני דמו..."
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={loading}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={loading || !inputText.trim()}
            className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-lg shadow-blue-500/15"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
