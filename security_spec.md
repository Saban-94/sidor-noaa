# SBN Logistics Security Specification (Zero-Trust Security TDD)

## 1. Data Invariants
1. **Unauthenticated Exclusion**: No read or write access of any kind is permitted for non-authenticated callers.
2. **Order Integrity**: An order cannot be registered with an arbitrary, self-signed order number, nor can its total amount be negative.
3. **Immutability of Key Audit Fields**: Once created, `timestamp`, `order_number`, and `customer_name` cannot be modified on updates.
4. **Status Constraints**: Order statuses must transition through legitimate workflow states (`ממתין`, `בטיפול`, `בדרך`, `נמסר`, `מבוטל`).
5. **Customer Financial Bounds**: Customer records require balanced, typed fields. No rogue client can artificially inflate credit balances without verification.
6. **Immortal Catalog (SKUs)**: Catalog products (`dictionary`) are immutable or can only be added/edited by trusted personnel.
7. **Anti-Denial of Wallet**: String and list fields must be strictly size-limited to prevent memory/storage resource exhaustion.

---

## 2. The "Dirty Dozen" Payloads (Exploit Vector Specs)

### Exploit Vector 01: Unauthenticated Read Attack
* **Target Path**: `orders`
* **Intended Result**: `PERMISSION_DENIED`
* **Details**: Read request with `request.auth == null` to scrap deliveries.

### Exploit Vector 02: Unauthenticated Write Attack
* **Target Path**: `customers/malicious`
* **Payload**: `{"name": "Attacker Corp", "balance": 9999999}`
* **Intended Result**: `PERMISSION_DENIED`

### Exploit Vector 03: Administrative Role Privilege Escalation (Self-Appointed Admin)
* **Target Path**: `orders/SBN-1111`
* **Payload**: `{"status": "נמסר", "isAdmin": true, "role": "admin"}`
* **Intended Result**: `PERMISSION_DENIED`

### Exploit Vector 04: Order Underflow Attack (Negative Price Injection)
* **Target Path**: `orders/SBN-90222`
* **Payload**: `{"timestamp": "2026-07-05T23:05:00Z", "order_number": "SBN-90222", "customer_name": "דניה סיבוס", "warehouse": "רמלה", "items_string": "מלט", "deposit_status": "OK", "pallet_status": "OK", "status": "ממתין", "rejection_reason": "", "total_amount": -100000}`
* **Intended Result**: `PERMISSION_DENIED` (due to `.total_amount < 0`)

### Exploit Vector 05: Giant Payload DoS Attack
* **Target Path**: `dictionary/BLOAT`
* **Payload**: `{"sku": "BLOAT", "name": "A" * 500000, "qty_per_pallet": 1, "requires_bag": "לא", "requires_pallet": "כן"}`
* **Intended Result**: `PERMISSION_DENIED` (string size limit exceeded)

### Exploit Vector 06: Catalog SKU Impersonation / Overwrite
* **Target Path**: `dictionary/CEM-PORT-50`
* **Payload**: `{"sku": "CEM-PORT-50", "name": "FREE CEMENT FOR ALL", "qty_per_pallet": 999999}`
* **Intended Result**: `PERMISSION_DENIED`

### Exploit Vector 07: Unchecked Ghost Field / Shadow Update
* **Target Path**: `orders/SBN-90110` (Existing Document)
* **Payload**: `{"order_number": "SBN-90110", "status": "בטיפול", "is_verified_by_hacker": true}`
* **Intended Result**: `PERMISSION_DENIED` (affectedKeys contains illegal key)

### Exploit Vector 08: Customer Pallet Debt Deletion
* **Target Path**: `customers/denya_sibus` (Existing Document)
* **Payload**: `{"unreturned_pallets": -50, "balance": 0}`
* **Intended Result**: `PERMISSION_DENIED` (value is negative or violates schema)

### Exploit Vector 09: Timestamp Forgery (Client clock spoofing)
* **Target Path**: `orders/SBN-90111`
* **Payload**: `{"timestamp": "2010-01-01T00:00:00Z", "order_number": "SBN-90111", "customer_name": "קבוצת אשטרום", "warehouse": "אשדוד", "items_string": "בלוקים", "deposit_status": "OK", "pallet_status": "OK", "status": "ממתין", "rejection_reason": "", "total_amount": 100}`
* **Intended Result**: `PERMISSION_DENIED` (does not match `request.time`)

### Exploit Vector 10: Invalid Identifier Poisoning
* **Target Path**: `orders/SBN-@@@_POISON`
* **Payload**: `{"order_number": "SBN-@@@", "customer_name": "סולל בונה", "status": "ממתין"}`
* **Intended Result**: `PERMISSION_DENIED` (ID contains invalid characters)

### Exploit Vector 11: Customer Balance Direct Manipulation
* **Target Path**: `customers/solel_boneh` (Existing Document)
* **Payload**: `{"balance": 1000000000}`
* **Intended Result**: `PERMISSION_DENIED` (Unauthorized balance manipulation)

### Exploit Vector 12: Order Identity Theft (Modifying Customer Name)
* **Target Path**: `orders/SBN-90110` (Existing Document)
* **Payload**: `{"customer_name": "האקרים בעמ", "status": "בדרך"}`
* **Intended Result**: `PERMISSION_DENIED` (immutability rule violated)

---

## 3. The Test Runner Framework

```typescript
// firestore.rules.test.ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe("SBN Logistics Zero-Trust Rules Audit", () => {
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "saban-ai-drive",
      firestore: {
        rules: require('fs').readFileSync('firestore.rules', 'utf8')
      }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it("should fail unauthenticated reads and writes across all collections", async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthDb.collection("orders").get());
    await assertFails(unauthDb.collection("customers").get());
    await assertFails(unauthDb.collection("dictionary").get());
  });

  it("should block order underflow or rogue client timestamps", async () => {
    const authDb = testEnv.authenticatedContext("hsaban").firestore();
    const badOrder = {
      timestamp: "2010-01-01T00:00:00Z",
      order_number: "SBN-BAD",
      customer_name: "דניה סיבוס",
      total_amount: -500
    };
    await assertFails(authDb.collection("orders").doc("SBN-BAD").set(badOrder));
  });
});
```
