export interface Order {
  id: string;
  timestamp: string; // ISO String or Firestore timestamp representation
  order_number: string;
  customer_name: string;
  warehouse: string;
  items_string: string;
  deposit_status: 'OK' | '❌' | 'חלקית'; // Bag deposits
  pallet_status: 'OK' | '❌' | 'חלקית';  // Pallet status
  rejection_reason?: string;
  status: 'ממתין' | 'בטיפול' | 'בדרך' | 'נמסר' | 'בוטל';
  total_amount?: number;
}

export interface DictionaryItem {
  id: string;
  sku: string;
  name: string;
  qty_per_pallet: number;
  requires_bag: 'כן' | 'לא';
  requires_pallet: 'כן' | 'לא';
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance?: number; // Financial balance if any
  unreturned_pallets: number;
  unreturned_bags: number;
}

export interface Message {
  id: string;
  sender: 'user' | 'noa';
  text: string;
  timestamp: string;
}

export interface AccessibilityPreferences {
  fontSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
  reduceMotion: boolean;
  soundAlerts: boolean;
}
