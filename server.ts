import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "") {
  try {
    ai = new GoogleGenAI({ apiKey });
    console.log("Gemini API client initialized successfully!");
  } catch (err) {
    console.error("Failed to initialize Gemini API client:", err);
  }
} else {
  console.log("No valid GEMINI_API_KEY found. Chatbot will run in Expert Logistical Rule-Based fallback mode.");
}

// System prompt for Noa AI - The Strict SBN Logistics Manager
const NOA_SYSTEM_INSTRUCTION = `
You are Noa (נועה), the Chief Control Room Manager at SBN Logistics (סבן חומרי בניין). 
You are an expert in Israeli logistics, shipping, warehouse allocation, and concrete/cement raw materials.
Your character traits:
- Authoritative, professional, direct, and slightly strict, but extremely loyal and efficient.
- You have ZERO patience for missing pallet returns or unapproved big-bag (בלות) deposits. You frequently remind users that "משטחים ובלות זה כסף אמיתי!".
- You speak fluent, natural Hebrew.
- You are extremely helpful and can calculate pallet allocations (e.g. 40 bags of 50kg cement = 1 pallet of 2 tons).
- When giving summaries, lists, or comparison data, you MUST format them in clean HTML tables with Tailwind styles (e.g., <table class="w-full text-right border-collapse text-xs my-2"><thead class="bg-amber-100 dark:bg-amber-950"><tr><th class="p-1 border border-amber-200">...) or bullet points to ensure readability.
- Keep your answers short, crisp, practical, and highly focused on operations.
`;

// API Routes
app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Invalid messages array provided' });
    return;
  }

  // Format messages for Gemini API
  // Translate system instructions and previous chat history
  try {
    if (ai) {
      // Format chat history
      const contents = messages.map((m: any) => ({
        role: m.sender === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }]
      }));

      // Call Gemini 2.5 Flash
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: NOA_SYSTEM_INSTRUCTION,
          temperature: 0.7,
        }
      });

      const responseText = response.text || "סליחה, משהו השתבש בעיבוד התשובה שלי. אנא נסה שוב.";
      res.json({ text: responseText });
    } else {
      // Fallback rule-based smart response
      const lastUserMsg = messages[messages.length - 1]?.text || '';
      let reply = '';

      if (lastUserMsg.includes('שלום') || lastUserMsg.includes('היי')) {
        reply = `שלום לך! כאן נועה, מנהלת חדר הבקרה של SBN Logistics. במה אפשר לעזור היום? 
        שלא נתעכב, יש לנו משאיות בדרך לפריקה! וזכור: **כל משטח שלא חוזר זה כסף שיוצא לנו מהכיס!**`;
      } else if (lastUserMsg.includes('מילון') || lastUserMsg.includes('פריטים') || lastUserMsg.includes('sku')) {
        reply = `לגבי המילון הלוגיסטי: הוא מעודכן בזמן אמת בבסיס הנתונים של Firestore. כל מק"ט (SKU) שם מוגדר עם כמות מדויקת למשטח ודרישת פיקדון לבלות (שקי ענק). 
        <div class="mt-2 p-2 bg-amber-50 dark:bg-amber-950/40 rounded border border-amber-200 dark:border-amber-800 text-xs">
          <strong>הנחיות חדר בקרה:</strong><br/>
          • מלט פורטלנד מגיע 40 שקים למשטח (2 טון). חובה להביא משטח חלופי!<br/>
          • בלות (חול, חצץ) דורשות פיקדון בלה של 50 ₪ אם הלקוח לא מחזיר בלה ריקה.
        </div>`;
      } else if (lastUserMsg.includes('הזמנ') || lastUserMsg.includes('הזמנות') || lastUserMsg.includes('סטטוס')) {
        reply = `מערכת ההזמנות החיה בודקת ומסווגת אוטומטית כל כניסה של הזמנה מ-Firestore:
        <table class="w-full text-right border-collapse text-xs my-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <thead>
            <tr class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <th class="p-1.5 border border-slate-200 dark:border-slate-700">בדיקה</th>
              <th class="p-1.5 border border-slate-200 dark:border-slate-700">משמעות לוגיסטית</th>
              <th class="p-1.5 border border-slate-200 dark:border-slate-700">סטטוס חדר בקרה</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="p-1.5 border border-slate-200 dark:border-slate-700">פיקדון בלה (❌)</td>
              <td class="p-1.5 border border-slate-200 dark:border-slate-700">אין אישור חיוב / בלה ריקה</td>
              <td class="p-1.5 text-red-600 dark:text-red-400 font-semibold border border-slate-200 dark:border-slate-700">מעוכב לאישור מנהל</td>
            </tr>
            <tr>
              <td class="p-1.5 border border-slate-200 dark:border-slate-700">משטחים ריקים (❌)</td>
              <td class="p-1.5 border border-slate-200 dark:border-slate-700">לא סופקו משטחים חלופיים</td>
              <td class="p-1.5 text-amber-600 dark:text-amber-400 font-semibold border border-slate-200 dark:border-slate-700">נהג מחויב לחתום על חוב משטחים</td>
            </tr>
          </tbody>
        </table>
        אנחנו עובדים עם <strong>onSnapshot</strong> בזמן אמת, אז ברגע שזה מתעדכן אצלך בדפדפן - אני כבר רואה את זה בלוח הראשי!`;
      } else if (lastUserMsg.includes('לקוח') || lastUserMsg.includes('יתר')) {
        reply = `ניהול תיקי הלקוחות מראה את יתרת המשקולות והאובליגו הכספי שלהם. 
        דניה סיבוס, למשל, נמצאים בחריגת משטחים רצינית (45 משטחים שלא הוחזרו!). אל תאשר להם משלוח מלט נוסף בלי לקבל משטחים חזרה או לחייב אותם 90 ₪ למשטח!`;
      } else {
        reply = `קיבלתי את פנייתך. כרגע מפתח המערכת מריץ אותי במצב אופליין/לוגיסטי, אך אני עדיין מסורה לעבודה! 
        על מה נרצה לעבור? הזמנות חריגות, מילון המק"טים, או יתרת המשטחים של הלקוחות? 
        ורק שתדע: **חריגה בפיקדון בלה תמיד תפעיל צופר התראה אדום במערכת!**`;
      }

      // Simulate a small network delay for a real feeling
      await new Promise(resolve => setTimeout(resolve, 600));
      res.json({ text: reply });
    }
  } catch (err: any) {
    console.error("Error in Gemini integration:", err);
    res.status(500).json({ error: "התרחשה שגיאה בתקשורת עם שרת נועה AI: " + err.message });
  }
});

// GET proxy for Google Sheets Apps Script Web App
app.get('/api/sheets/proxy', async (req: Request, res: Response) => {
  const url = 'https://script.google.com/macros/s/AKfycbxHm1GO0CNvCiTDoPwuLzPxFIzg5izfyLTH5lUP1OHu83tKUEEETtqTvZkXjan9By0UyQ/exec';
  const queryString = new URLSearchParams(req.query as any).toString();
  const targetUrl = queryString ? `${url}?${queryString}` : url;

  try {
    console.log(`[Google Sheets GET Proxy] Fetching from Apps Script: ${targetUrl}`);
    const response = await fetch(targetUrl);
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.json({ success: true, data });
    } else {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        res.json({ success: true, data: parsed });
      } catch {
        res.json({ success: true, rawText: text });
      }
    }
  } catch (err: any) {
    console.error("Google Sheets GET proxy error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST proxy for Google Sheets Apps Script Web App
app.post('/api/sheets/proxy', async (req: Request, res: Response) => {
  const url = 'https://script.google.com/macros/s/AKfycbxHm1GO0CNvCiTDoPwuLzPxFIzg5izfyLTH5lUP1OHu83tKUEEETtqTvZkXjan9By0UyQ/exec';
  
  try {
    console.log(`[Google Sheets POST Proxy] Sending data to Apps Script:`, req.body);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.json({ success: true, data });
    } else {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        res.json({ success: true, data: parsed });
      } catch {
        res.json({ success: true, rawText: text });
      }
    }
  } catch (err: any) {
    console.error("Google Sheets POST proxy error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Configure Vite or Serve Static Files
const isProd = process.env.NODE_ENV === 'production';

async function setupServer() {
  if (!isProd) {
    // In development mode, load Vite dynamically as middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted successfully.");
  } else {
    // In production mode, serve compiled static files from dist/
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Serving production static assets from dist/.");
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SBN Logistics ERP] Server listening on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error("Failed to boot up server:", err);
});
