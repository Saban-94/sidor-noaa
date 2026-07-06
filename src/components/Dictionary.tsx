import React, { useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DictionaryItem } from '../types';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Check, 
  HelpCircle, 
  AlertCircle,
  Package,
  Layers,
  ShoppingBag
} from 'lucide-react';

export default function Dictionary() {
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Create / Edit modal states
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DictionaryItem | null>(null);
  
  // Form states
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [qtyPerPallet, setQtyPerPallet] = useState(40);
  const [requiresBag, setRequiresBag] = useState<'כן' | 'לא'>('לא');
  const [requiresPallet, setRequiresPallet] = useState<'כן' | 'לא'>('כן');

  useEffect(() => {
    const q = collection(db, 'dictionary');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DictionaryItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DictionaryItem);
      });
      setItems(list);
      setLoading(false);
    }, (err) => {
      console.error("Error reading dictionary:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setSku('');
    setName('');
    setQtyPerPallet(40);
    setRequiresBag('לא');
    setRequiresPallet('כן');
    setShowModal(true);
  };

  const openEditModal = (item: DictionaryItem) => {
    setEditingItem(item);
    setSku(item.sku);
    setName(item.name);
    setQtyPerPallet(item.qty_per_pallet);
    setRequiresBag(item.requires_bag);
    setRequiresPallet(item.requires_pallet);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) {
      alert("נא למלא את כל השדות החיוניים");
      return;
    }

    const payload = {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      qty_per_pallet: Number(qtyPerPallet),
      requires_bag: requiresBag,
      requires_pallet: requiresPallet
    };

    try {
      if (editingItem) {
        const itemRef = doc(db, 'dictionary', editingItem.id);
        await updateDoc(itemRef, payload);
      } else {
        await addDoc(collection(db, 'dictionary'), payload);
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error saving dictionary item:", err);
      alert("שגיאה בשמירת הפריט במאגר");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("האם למחוק פריט זה ממילון הלוגיסטיקה?")) {
      try {
        await deleteDoc(doc(db, 'dictionary', id));
      } catch (err) {
        console.error("Error deleting dictionary item:", err);
      }
    }
  };

  const filteredItems = items.filter(i => {
    const searchVal = (search || '').toLowerCase();
    const itemSku = (i?.sku || '').toLowerCase();
    const itemName = (i?.name || '').toLowerCase();
    return itemSku.includes(searchVal) || itemName.includes(searchVal);
  });

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            ניהול מילון לוגיסטי (מק"טים)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            הגדרת מק"טים, קיבולת פריקה למשטח עץ ודרישות פיקדון לבלות (שקי ענק) המשמשים את מנגנון האזהרה של חדר הבקרה
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          הוסף מק"ט חדש
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="חפש לפי קוד מק״ט או שם מוצר..."
          className="w-full pr-10 pl-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid view of Dictionary */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200/60">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400">טוען הגדרות מילון לוגיסטי...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center p-16 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200/60 text-slate-500 dark:text-slate-400 space-y-2">
          <Package className="w-10 h-10 mx-auto opacity-35" />
          <h3 className="font-bold text-sm">המילון ריק</h3>
          <p className="text-xs text-slate-400">הקלק על "הוסף מק"ט חדש" כדי להזין חומר בניין ראשון</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="p-5 bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between group hover:shadow-md transition-all duration-200">
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="font-mono text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                    {item.sku}
                  </span>
                  
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                      title="ערוך מוצר"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors cursor-pointer"
                      title="מחק מוצר"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm group-hover:text-amber-500 transition-colors">
                  {item.name}
                </h3>

                {/* Details layout */}
                <div className="space-y-2 mt-4 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/30 p-2 rounded-lg">
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      קיבולת משטח עץ:
                    </span>
                    <span className="font-bold font-mono">{item.qty_per_pallet} שקים / יחידות</span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/30 p-2 rounded-lg">
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      דרישת פיקדון בלות (שקי ענק):
                    </span>
                    <span className={`font-extrabold px-2 py-0.5 rounded text-[10px] ${
                      item.requires_bag === 'כן' 
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' 
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {item.requires_bag === 'כן' ? 'כן (חובה!)' : 'לא'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/30 p-2 rounded-lg">
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      דרישת החלפת משטח:
                    </span>
                    <span className={`font-extrabold px-2 py-0.5 rounded text-[10px] ${
                      item.requires_pallet === 'כן' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' 
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {item.requires_pallet === 'כן' ? 'כן (משטח עץ חלופי)' : 'לא'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-right">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                {editingItem ? 'עריכת פריט במילון' : 'הוספת מוצר חדש למילון הלוגיסטי'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">קוד מק״ט (SKU)</label>
                  <input
                    type="text"
                    required
                    placeholder="CEM-PORT"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">שם החומר / מוצר בניין</label>
                  <input
                    type="text"
                    required
                    placeholder="לדוגמא: מלט פורטלנד מחוזק 50 ק״ג"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">כמות פריקה למשטח (שקים / בלות למשטח אחד)</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  value={qtyPerPallet}
                  onChange={(e) => setQtyPerPallet(Number(e.target.value))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">מצריך פיקדון שק (בלה)?</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                    value={requiresBag}
                    onChange={(e) => setRequiresBag(e.target.value as any)}
                  >
                    <option value="לא">לא (פריקת שקים קטנים)</option>
                    <option value="כן">כן (בלת ענק - מצריך פיקדון)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">מצריך החלפת משטח עץ?</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                    value={requiresPallet}
                    onChange={(e) => setRequiresPallet(e.target.value as any)}
                  >
                    <option value="כן">כן (משטח עץ תקני SBN)</option>
                    <option value="לא">לא (פריקה ישירה בלה / בתפזורת)</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  {editingItem ? 'עדכן פריט' : 'שמור במילון'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
