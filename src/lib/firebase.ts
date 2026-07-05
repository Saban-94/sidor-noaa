import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  limit 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore specifying the databaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Seeding standard SBN Logistics data if database is empty
export async function seedInitialDataIfNeeded() {
  try {
    // 1. Seed Dictionary
    const dictRef = collection(db, 'dictionary');
    const dictSnap = await getDocs(dictRef);
    if (dictSnap.empty) {
      console.log('Seeding dictionary data...');
      const sampleDictionary = [
        { sku: "CEM-PORT-50", name: 'מלט פורטלנד 50 ק"ג (SBN)', qty_per_pallet: 40, requires_bag: "לא", requires_pallet: "כן" },
        { sku: "SAND-BAG-1T", name: 'בלה חול מחצבה מעורב 1 טון', qty_per_pallet: 1, requires_bag: "כן", requires_pallet: "לא" },
        { sku: "BLK-10-STD", name: 'בלוק בטון 10 תקני (אקוסטי)', qty_per_pallet: 120, requires_bag: "לא", requires_pallet: "כן" },
        { sku: "GYP-PLASTER", name: 'טיח גבס משופר שק לבן', qty_per_pallet: 50, requires_bag: "לא", requires_pallet: "כן" },
        { sku: "GRAVEL-B-1T", name: 'בלה חצץ שומשום לריצוף', qty_per_pallet: 1, requires_bag: "כן", requires_pallet: "לא" }
      ];
      for (const item of sampleDictionary) {
        await addDoc(dictRef, item);
      }
    }

    // 2. Seed Customers
    const custRef = collection(db, 'customers');
    const custSnap = await getDocs(custRef);
    if (custSnap.empty) {
      console.log('Seeding customers data...');
      const sampleCustomers = [
        { name: 'סולל בונה בע"מ', phone: '03-1234567', email: 'orders@solelboneh.co.il', address: 'דרך מנחם בגין 121, תל אביב', balance: 154200, unreturned_pallets: 12, unreturned_bags: 0 },
        { name: 'דניה סיבוס', phone: '09-8765432', email: 'logistics@denya.co.il', address: 'אזור התעשייה פולג, נתניה', balance: -35000, unreturned_pallets: 45, unreturned_bags: 18 },
        { name: 'קבוצת אשטרום', phone: '04-9998888', email: 'sbn-orders@ashtrom.co.il', address: 'חיפה, דרך יפו 45', balance: 92000, unreturned_pallets: 8, unreturned_bags: 2 },
        { name: 'יוסי אברהמי חברה לבנין', phone: '08-6543210', email: 'yossi@abrahami-group.com', address: 'שדרות התמרים 100, אילת', balance: 124000, unreturned_pallets: 0, unreturned_bags: 0 }
      ];
      for (const cust of sampleCustomers) {
        await addDoc(custRef, cust);
      }
    }

    // 3. Seed Orders
    const ordRef = collection(db, 'orders');
    const ordSnap = await getDocs(ordRef);
    if (ordSnap.empty) {
      console.log('Seeding orders data...');
      const now = new Date();
      
      const sampleOrders = [
        {
          timestamp: new Date(now.getTime() - 1000 * 60 * 15).toISOString(), // 15 mins ago
          order_number: "SBN-90110",
          customer_name: 'סולל בונה בע"מ',
          warehouse: 'מחסן מרכז (רמלה)',
          items_string: 'מלט פורטלנד 50 ק"ג x 40 שקים (1 משטח)',
          deposit_status: 'OK',
          pallet_status: 'OK',
          status: 'בדרך',
          rejection_reason: '',
          total_amount: 1400
        },
        {
          timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(), // 30 mins ago
          order_number: "SBN-90109",
          customer_name: 'דניה סיבוס',
          warehouse: 'מחסן צפון (חיפה)',
          items_string: 'בלה חול מחצבה 1 טון x 8 בלות',
          deposit_status: '❌',
          pallet_status: 'OK',
          status: 'בטיפול',
          rejection_reason: 'חסר אישור פיקדון ל-8 בלות (עלות: 400 ₪)',
          total_amount: 3200
        },
        {
          timestamp: new Date(now.getTime() - 1000 * 60 * 50).toISOString(), // 50 mins ago
          order_number: "SBN-90108",
          customer_name: 'קבוצת אשטרום',
          warehouse: 'מחסן דרום (אשדוד)',
          items_string: 'בלוק בטון 10 תקני x 240 יחידות (2 משטחים)',
          deposit_status: 'OK',
          pallet_status: '❌',
          status: 'ממתין',
          rejection_reason: 'לקוח לא הביא 2 משטחים ריקים חלופיים',
          total_amount: 4800
        },
        {
          timestamp: new Date(now.getTime() - 1000 * 60 * 120).toISOString(), // 2 hours ago
          order_number: "SBN-90107",
          customer_name: 'יוסי אברהמי חברה לבנין',
          warehouse: 'מחסן מרכז (רמלה)',
          items_string: 'טיח גבס משופר x 50 שקים (1 משטח)',
          deposit_status: 'OK',
          pallet_status: 'OK',
          status: 'נמסר',
          rejection_reason: '',
          total_amount: 2100
        }
      ];
      for (const ord of sampleOrders) {
        await addDoc(ordRef, ord);
      }
    }
  } catch (error) {
    console.error('Error seeding Firestore collections:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, 'seeding');
    } catch (err) {
      // Don't crash startup during seeding, but log detailed diagnostics
    }
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { app };
