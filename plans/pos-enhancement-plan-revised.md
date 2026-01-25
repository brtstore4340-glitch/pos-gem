# POS System Enhancement Plan (Revised)

**Golden Version Enhancement - Safe, Incremental Approach**

## 📋 Executive Summary

This revised plan addresses the critical feedback on the original enhancement plan, focusing on:

1. **Single source of truth** for data normalization (server-side only)
2. **Safe incremental rollout** with feature flags and guardrails
3. **No duplicate normalization** between client and server
4. **CSS-first mobile layout** to avoid JS resize listener issues
5. **Backward compatibility** maintained throughout all phases

---

## 🎯 Core Improvements Over Original Plan

### ✅ What We're Keeping

- Phase-based approach (Data → UI → UX → Responsive)
- Backward compatibility emphasis
- Server-side promotion calculation as core
- Comprehensive test checklist

### ⚠️ Critical Changes

#### 1. **Single Source of Truth**

**Problem**: Original plan had normalization in both Cloud Functions AND `posService.js`, risking inconsistent results.

**Solution**:

- Phase 1: Normalize ONLY in Cloud Function
- Client: Display what server returns (minimal transformation)

#### 2. **Smart Key Normalization**

**Problem**: Long lists of field variants (`'REG PRICE'`, `'RegPrice'`, `'regPrice_print'`) are brittle.

**Solution**: Implement `normalizeKey()` function:

```javascript
function normalizeKey(key) {
  return key
    .trim()
    .toUpperCase()
    .replace(/[_\s]+/g, " ") // Normalize separators
    .replace(/[()]/g, ""); // Remove parentheses
}

const FIELD_MAP = {
  "DESCRIPTION PRINT": "name",
  "REG PRICE": "unitPrice",
  "DEAL PRICE": "dealPrice",
  "DEAL QTY": "dealQty",
  METHOD: "method",
  // Add mappings as discovered
};
```

#### 3. **Fix Spread Operator Order**

**Problem**: `{ sku, name, price, ...d }` allows `...d` to overwrite normalized values.

**Solution**:

```javascript
// ❌ BAD - d can overwrite sku/name/price
results.push({ sku, name, price, ...d });

// ✅ GOOD - normalized values always win
results.push({ ...d, sku, name, price });
```

#### 4. **Reliable Badge Method Detection**

**Problem**: `item.originalItem?.method` is unreliable if server doesn't return `originalItem`.

**Solution**:

```javascript
// ❌ BAD
backgroundColor: item.originalItem?.method === "8" ? blue : orange;

// ✅ GOOD
backgroundColor: String(item.method) === "8" ? blue : orange;
```

#### 5. **CSS-First Mobile Layout**

**Problem**: JS resize listeners cause re-renders and edge cases.

**Solution**: Use Tailwind breakpoints:

```jsx
{
  /* Desktop - always visible on md+ */
}
<div className="hidden md:flex">...</div>;

{
  /* Mobile - only visible below md */
}
<div className="md:hidden">...</div>;
```

#### 6. **Method 8 Definition Clarity**

**Problem**: Assumption about `dealQty = N` needs verification.

**Solution**:

- Document both interpretations
- Add unit tests for both scenarios
- Confirm with actual data

---

## 🏗️ Revised Implementation Plan

### Phase 0: Guardrails (NEW - Safety First)

**Goal**: Add safety nets before making any changes

**Duration**: 1 day

**Files to Create/Modify**:

- `functions/src/config/featureFlags.js` (NEW)
- `functions/src/services/cartService.js` (add logging)

**Implementation**:

1. **Feature Flags**:

```javascript
// functions/src/config/featureFlags.js
export const FEATURE_FLAGS = {
  FIELD_MAPPING_V2: process.env.ENABLE_FIELD_MAPPING_V2 === "true",
  SEARCH_UX_V2: process.env.ENABLE_SEARCH_UX_V2 === "true",
  MOBILE_TABS: process.env.ENABLE_MOBILE_TABS === "true",
};
```

2. **Unmapped Key Logging** (non-spam):

```javascript
const unmappedKeys = new Set();

function logUnmappedKey(key) {
  if (!unmappedKeys.has(key) && FEATURE_FLAGS.FIELD_MAPPING_V2) {
    unmappedKeys.add(key);
    console.warn(`[Field Mapping] Unmapped key detected: "${key}"`);
  }
}
```

3. **Monitoring Setup**:

- Cloud Function execution logs
- Error rate dashboard
- Field mapping coverage metric

**Testing Checklist**:

- [ ] Feature flags toggle correctly
- [ ] Logging doesn't spam production
- [ ] Monitoring dashboard shows metrics

---

### Phase 1: Server-Side Field Mapping (Single Source of Truth)

**Goal**: All normalization happens in Cloud Function only

**Duration**: 2-3 days

**Files to Modify**:

- `functions/src/services/cartService.js` - `normalizeItem()`
- `functions/src/utils/fieldMapper.js` (NEW)

**Implementation**:

1. **Key Normalization Utility**:

```javascript
// functions/src/utils/fieldMapper.js
export function normalizeKey(key) {
  if (!key) return "";
  return String(key)
    .trim()
    .toUpperCase()
    .replace(/[_\s]+/g, " ")
    .replace(/[()]/g, "");
}

export const FIELD_MAP = {
  // Name variations
  "DESCRIPTION PRINT": "name",
  PRODUCTDESC: "name",
  DESC: "name",

  // Price variations
  "REG PRICE": "unitPrice",
  REGPRICE: "unitPrice",
  SELLPRICE: "unitPrice",
  "UNIT PRICE": "unitPrice",

  // Method variations
  METHOD: "method",
  "METHOD PRINT": "method",
  "METHOD MAINT": "method",

  // Deal Qty variations
  "DEAL QTY": "dealQty",
  DEALQTY: "dealQty",
  "DEALQTY PRINT": "dealQty",

  // Deal Price variations
  "DEAL PRICE": "dealPrice",
  DEALPRICE: "dealPrice",
  "DEALPRICE PRINT": "dealPrice",
};

export function mapField(item, targetField) {
  // Try direct access first
  if (
    item[targetField] !== undefined &&
    item[targetField] !== null &&
    item[targetField] !== ""
  ) {
    return item[targetField];
  }

  // Try mapped keys
  for (const [rawKey, mappedField] of Object.entries(FIELD_MAP)) {
    if (mappedField === targetField) {
      const normalizedKey = normalizeKey(rawKey);

      // Check original keys that normalize to this
      for (const originalKey of Object.keys(item)) {
        if (normalizeKey(originalKey) === normalizedKey) {
          const value = item[originalKey];
          if (value !== undefined && value !== null && value !== "") {
            return value;
          }
        }
      }
    }
  }

  return undefined;
}
```

2. **Enhanced normalizeItem()** with type safety:

```javascript
// functions/src/services/cartService.js
import {
  mapField,
  normalizeKey,
  logUnmappedKey,
} from "../utils/fieldMapper.js";

const normalizeItem = (item) => {
  // Helper to safely parse numbers
  const safeParseFloat = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const safeParseInt = (val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : num;
  };

  // Log unmapped keys for monitoring
  if (FEATURE_FLAGS.FIELD_MAPPING_V2) {
    Object.keys(item).forEach((key) => {
      const normalized = normalizeKey(key);
      if (!FIELD_MAP[normalized]) {
        logUnmappedKey(key);
      }
    });
  }

  return {
    id: item.id || item.sku || mapField(item, "id") || mapField(item, "sku"),
    sku: item.sku || item.id || mapField(item, "sku") || mapField(item, "id"),

    name: mapField(item, "name") || "Unknown Product",

    qty: safeParseInt(item.qty || 1),

    unitPrice: safeParseFloat(mapField(item, "unitPrice")),

    method: String(mapField(item, "method") || "0").trim(),

    dealQty: safeParseInt(mapField(item, "dealQty")),

    dealPrice: safeParseFloat(mapField(item, "dealPrice")),

    barcode: mapField(item, "barcode") || "",

    manualDiscountPercent: safeParseFloat(item.manualDiscountPercent || 0),

    // Keep original for debugging (if flag enabled)
    ...(FEATURE_FLAGS.FIELD_MAPPING_V2 ? { _original: item } : {}),
  };
};
```

3. **Unit Tests**:

```javascript
// functions/src/services/__tests__/fieldMapper.test.js
describe("normalizeKey", () => {
  test("handles spaces in field names", () => {
    expect(normalizeKey("REG PRICE")).toBe("REGPRICE");
    expect(normalizeKey("DESCRIPTION (PRINT)")).toBe("DESCRIPTIONPRINT");
  });

  test("handles underscores", () => {
    expect(normalizeKey("reg_price_print")).toBe("REGPRICEPRINT");
  });

  test("handles mixed case", () => {
    expect(normalizeKey("RegPrice")).toBe("REGPRICE");
  });
});

describe("mapField", () => {
  test("maps DESCRIPTION (PRINT) to name", () => {
    const item = { "DESCRIPTION (PRINT)": "Test Product" };
    expect(mapField(item, "name")).toBe("Test Product");
  });

  test("maps REG PRICE to unitPrice", () => {
    const item = { "REG PRICE": "299.50" };
    expect(mapField(item, "unitPrice")).toBe("299.50");
  });

  test("prioritizes standard fields", () => {
    const item = {
      name: "Standard Name",
      "DESCRIPTION (PRINT)": "Print Name",
    };
    expect(mapField(item, "name")).toBe("Standard Name");
  });
});
```

**Testing Checklist**:

- [ ] Unit tests pass for all field variants
- [ ] `DESCRIPTION (PRINT)` maps correctly
- [ ] `REG PRICE` maps correctly
- [ ] `DEAL PRICE` and `DEAL QTY` map correctly
- [ ] Type safety: invalid numbers become 0
- [ ] Backward compatibility: old field names still work
- [ ] **NO UI changes in this phase**

---

### Phase 2: Client-Side Data Alignment (Not Normalization)

**Goal**: Client displays server data without duplicate normalization

**Duration**: 1-2 days

**Files to Modify**:

- `src/services/posService.js` - `searchProducts()`, `scanItem()`

**Implementation**:

1. **Fix spread operator order**:

```javascript
// src/services/posService.js
searchProducts: async (keyword) => {
  const results = [];
  const querySnapshot = await getDocs(q);

  querySnapshot.forEach((doc) => {
    const d = doc.data();
    if (d.ProductStatus?.startsWith("0")) {
      // ✅ GOOD: Spread d first, then override with essentials
      results.push({
        ...d, // All fields from database
        // Override/ensure these key fields are present
        sku: d.GridProductCode || d.ProductCode || doc.id,
        id: doc.id,
        // Server will normalize these when calculating cart
        method: d.method_print || d.method_maint || d.method || "0",
        dealQty: d.dealQty_print || d.dealQty_maint || d.dealQty || 0,
        dealPrice: d.dealPrice_print || d.dealPrice_maint || d.dealPrice || 0,
      });
    }
  });

  return results;
};
```

2. **Minimal client-side mapping** (only for display):

```javascript
// src/services/posService.js
scanItem: async (sku) => {
  const doc = await getDoc(docRef);
  if (!doc.exists()) throw new Error("Product not found");

  const d = doc.data();

  // Return raw data with minimal structure
  // Server will normalize when adding to cart
  return {
    ...d,
    sku: d.GridProductCode || d.ProductCode || sku,
    id: doc.id,
    name:
      d.ProductDesc ||
      d.description_print ||
      d["DESCRIPTION (PRINT)"] ||
      "Unknown",
    price: Number(d.SellPrice || d.regPrice_print || d["REG PRICE"] || 0),
    method: d.method_print || d.method_maint || d.method || "0",
    dealQty: d.dealQty_print || d.dealQty_maint || d.dealQty || 0,
    dealPrice: d.dealPrice_print || d.dealPrice_maint || d.dealPrice || 0,
  };
};
```

**Key Principle**: Client provides "good enough" data for display. Server normalizes for calculations.

**Testing Checklist**:

- [ ] Search returns products with all fields
- [ ] Scan returns product with method/dealQty/dealPrice
- [ ] Cart calculation handled by server
- [ ] No duplicate normalization logic
- [ ] **Still no UI changes**

---

### Phase 3: Badge Color Differentiation

**Goal**: Method 8 shows blue, others show orange

**Duration**: 1 day

**Files to Modify**:

- `src/components/PosUI.jsx` - Badge rendering (Lines ~318, ~390)

**Implementation**:

```jsx
{
  /* In cart item display */
}
{
  item.badgeText && (
    <span
      className="text-[9px] text-white px-1.5 py-0.5 rounded font-bold"
      style={{
        backgroundColor: String(item.method) === "8" ? "#184290" : "#f97316",
      }}
    >
      {item.badgeText}
    </span>
  );
}
```

**Fallback for missing badgeText**:

```jsx
{
  item.badgeText ? (
    <span
      className="text-[9px] text-white px-1.5 py-0.5 rounded font-bold"
      style={{
        backgroundColor: String(item.method) === "8" ? "#184290" : "#f97316",
      }}
    >
      {item.badgeText}
    </span>
  ) : (
    // Fallback: show method number if badge text missing
    item.method &&
    String(item.method) !== "0" && (
      <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">
        Method {item.method}
      </span>
    )
  );
}
```

**Testing Checklist**:

- [ ] Method 8 items show blue badges (#184290)
- [ ] Method 1 items show orange badges (#f97316)
- [ ] Method 9 items show orange badges
- [ ] Fallback shows when badgeText is missing
- [ ] Badge text displays correctly in Thai

---

### Phase 4: Search UX Enhancement (Separate Component)

**Goal**: Google-style search with keyboard navigation, minimal impact on existing code

**Duration**: 2-3 days

**Files to Create/Modify**:

- `src/components/SearchBox.jsx` (NEW - separate component)
- `src/components/PosUI.jsx` (replace inline search with SearchBox)

**Implementation**:

1. **Create SearchBox Component**:

```jsx
// src/components/SearchBox.jsx
import React, { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "../utils/cn";

export default function SearchBox({
  onSelect,
  onSearch,
  disabled,
  placeholder = "ค้นหาสินค้า หรือ สแกนบาร์โค้ด...",
  isDarkMode = false,
}) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (inputValue.length >= 2) {
        setIsLoading(true);
        const results = await onSearch(inputValue);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
        setIsLoading(false);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, onSearch]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        break;

      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;

      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelect = (item) => {
    onSelect(item);
    setInputValue("");
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setInputValue("");
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 size={24} className="animate-spin text-blue-600" />
          ) : (
            <Search
              size={24}
              className={cn(
                "transition-colors",
                isDarkMode
                  ? "text-slate-400"
                  : "text-slate-400 group-focus-within:text-blue-600",
              )}
            />
          )}
        </div>

        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          type="text"
          placeholder={placeholder}
          autoComplete="off"
          aria-label="Search products"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-activedescendant={
            selectedIndex >= 0 ? `result-${selectedIndex}` : undefined
          }
          className={cn(
            "w-full pl-14 pr-12 py-4 rounded-2xl border-2 outline-none transition-all text-lg font-medium",
            "shadow-lg hover:shadow-xl",
            "placeholder:text-slate-400 placeholder:font-normal",
            "focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 focus:shadow-2xl",
            isDarkMode
              ? "bg-slate-900 border-slate-700 text-white"
              : "bg-white border-slate-200 text-slate-800",
          )}
        />

        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Clear search"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          className={cn(
            "absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl border overflow-hidden z-50 max-h-[400px] overflow-y-auto",
            "animate-in fade-in slide-in-from-top-2 duration-200",
            isDarkMode
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200",
          )}
        >
          {suggestions.map((item, index) => (
            <div
              key={item.sku}
              id={`result-${index}`}
              role="option"
              aria-selected={selectedIndex === index}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "p-4 border-b cursor-pointer flex justify-between items-center transition-colors",
                selectedIndex === index
                  ? "bg-blue-50 border-l-4 border-l-blue-600 dark:bg-blue-900/20"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700",
                isDarkMode ? "border-slate-700" : "border-slate-50",
              )}
            >
              <div>
                <div
                  className={cn(
                    "font-bold",
                    isDarkMode ? "text-white" : "text-slate-800",
                  )}
                >
                  {item.name}
                </div>
                <div className="text-xs text-slate-400">SKU: {item.sku}</div>
                {item.badgeText && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1 inline-block">
                    {item.badgeText}
                  </span>
                )}
              </div>
              <div className="text-blue-600 font-bold text-lg">
                ฿{item.price?.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

2. **Use SearchBox in PosUI**:

```jsx
// src/components/PosUI.jsx
import SearchBox from "./SearchBox";

// In render:
<SearchBox
  onSelect={handleScanAction}
  onSearch={posService.searchProducts}
  disabled={isLoading || lastOrder || isSaving}
  isDarkMode={isDarkMode}
  placeholder="ค้นหาสินค้า หรือ สแกนบาร์โค้ด..."
/>;
```

**Accessibility Features**:

- ARIA labels for screen readers
- `aria-activedescendant` for keyboard navigation
- `role="listbox"` and `role="option"`
- Keyboard shortcuts documented

**Testing Checklist**:

- [ ] Arrow Down/Up navigate suggestions
- [ ] Enter selects highlighted item
- [ ] Escape closes dropdown
- [ ] Mouse hover updates selection
- [ ] Clear button works
- [ ] Screen reader compatible
- [ ] Google-style appearance achieved

---

### Phase 5: Mobile Layout (CSS Breakpoints)

**Goal**: Tab-based mobile navigation without touching desktop layout

**Duration**: 2 days

**Files to Modify**:

- `src/components/PosUI.jsx` - Add responsive layout

**Implementation**:

```jsx
// src/components/PosUI.jsx
const [mobileTab, setMobileTab] = useState("scan");

return (
  <div className="h-screen w-full flex flex-col overflow-hidden">
    {/* Modals (unchanged) */}

    {/* DESKTOP LAYOUT - Hidden on mobile, shown on md+ */}
    <div className="hidden md:flex gap-4 p-4 flex-1 overflow-hidden">
      {/* Left Side - Scan Section */}
      <div className="w-[35%] max-w-[450px] flex flex-col gap-4">
        {/* Existing scan UI */}
      </div>

      {/* Right Side - Cart Section */}
      <div className="flex-1 flex flex-col">{/* Existing cart UI */}</div>
    </div>

    {/* MOBILE LAYOUT - Shown on mobile, hidden on md+ */}
    <div className="md:hidden flex flex-col flex-1 overflow-hidden">
      {/* Tab Content Area */}
      <div className="flex-1 overflow-hidden p-4">
        {mobileTab === "scan" ? (
          <div className="h-full flex flex-col gap-4">
            {/* Search Box */}
            <SearchBox {...searchProps} />

            {/* Last Scanned Monitor */}
            <div className="flex-1 bg-white rounded-2xl p-6">
              {/* Last scanned item display */}
            </div>
          </div>
        ) : (
          <div className="h-full bg-white rounded-2xl flex flex-col">
            {/* Cart Header */}
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">ตะกร้า</h2>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Cart items list */}
            </div>

            {/* Checkout Footer */}
            <div className="p-4 bg-slate-900 text-white">
              {/* Total and checkout button */}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation */}
      <div className="bg-white border-t border-slate-200 p-3 flex gap-2 shadow-lg safe-area-inset-bottom">
        <button
          onClick={() => setMobileTab("scan")}
          className={cn(
            "flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
            mobileTab === "scan"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-100 text-slate-600",
          )}
        >
          <ScanBarcode size={20} />
          <span>สแกน</span>
        </button>

        <button
          onClick={() => setMobileTab("cart")}
          className={cn(
            "flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all relative",
            mobileTab === "cart"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-100 text-slate-600",
          )}
        >
          <ShoppingCart size={20} />
          <span>ตะกร้า</span>
          {cartItems.length > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {cartItems.length}
            </div>
          )}
        </button>
      </div>
    </div>
  </div>
);
```

**Key Benefits**:

- ✅ Desktop layout completely untouched
- ✅ No JS resize listeners (pure CSS breakpoints)
- ✅ Mobile-first rendering
- ✅ Safe area insets for notched devices

**Testing Checklist**:

- [ ] Desktop shows two-column layout (unchanged)
- [ ] Mobile shows tab navigation
- [ ] Tabs switch smoothly
- [ ] Cart badge shows item count
- [ ] Works on iPhone notch devices
- [ ] No layout shift on resize

---

## 🧪 Comprehensive Testing Strategy

### Phase 0 Tests

```javascript
describe("Feature Flags", () => {
  test("toggles FIELD_MAPPING_V2", () => {
    process.env.ENABLE_FIELD_MAPPING_V2 = "true";
    expect(FEATURE_FLAGS.FIELD_MAPPING_V2).toBe(true);
  });
});

describe("Logging", () => {
  test("logs unmapped key only once", () => {
    logUnmappedKey("UNKNOWN_FIELD");
    logUnmappedKey("UNKNOWN_FIELD");
    // Should only log once
  });
});
```

### Phase 1 Tests

```javascript
describe("normalizeKey", () => {
  test("handles DESCRIPTION (PRINT)", () => {
    expect(normalizeKey("DESCRIPTION (PRINT)")).toBe("DESCRIPTIONPRINT");
  });

  test("handles REG PRICE", () => {
    expect(normalizeKey("REG PRICE")).toBe("REGPRICE");
  });

  test("handles mixed formats", () => {
    expect(normalizeKey("reg_price_print")).toBe("REGPRICEPRINT");
    expect(normalizeKey("RegPrice")).toBe("REGPRICE");
  });
});

describe("mapField", () => {
  test("prioritizes standard fields", () => {
    const item = {
      name: "Standard",
      "DESCRIPTION (PRINT)": "Print",
    };
    expect(mapField(item, "name")).toBe("Standard");
  });

  test("falls back to mapped fields", () => {
    const item = { "REG PRICE": "299" };
    expect(mapField(item, "unitPrice")).toBe("299");
  });
});

describe("Type Safety", () => {
  test("converts NaN to 0", () => {
    const item = normalizeItem({ "REG PRICE": "invalid" });
    expect(item.unitPrice).toBe(0);
  });

  test("converts empty string to 0", () => {
    const item = normalizeItem({ dealQty: "" });
    expect(item.dealQty).toBe(0);
  });
});
```

### Phase 2 Tests

```javascript
describe("searchProducts spread order", () => {
  test("normalized values override raw data", () => {
    // Mock Firestore data
    const mockData = {
      GridProductCode: "ORIGINAL_SKU",
      sku: "SHOULD_BE_OVERRIDDEN",
    };

    const result = { ...mockData, sku: "CORRECT_SKU" };
    expect(result.sku).toBe("CORRECT_SKU");
  });
});
```

### Phase 3 Tests

```javascript
describe("Badge Colors", () => {
  test("Method 8 uses blue", () => {
    const item = { method: "8", badgeText: "ซื้อ 3 แถม 1" };
    const color = String(item.method) === "8" ? "#184290" : "#f97316";
    expect(color).toBe("#184290");
  });

  test("Method 1 uses orange", () => {
    const item = { method: "1", badgeText: "ราคาพิเศษ" };
    const color = String(item.method) === "8" ? "#184290" : "#f97316";
    expect(color).toBe("#f97316");
  });
});
```

### Method 8 Calculation Tests (Both Interpretations)

```javascript
describe("Method 8: Buy N Get 1 Free", () => {
  describe("Interpretation A: dealQty = N (buy N, get 1 free)", () => {
    test("Buy 3 Get 1: 3 items = pay 2", () => {
      const item = { qty: 3, unitPrice: 100, method: "8", dealQty: 3 };
      const freeItems = Math.floor(3 / 3); // 1
      const paidItems = 3 - freeItems; // 2
      const total = paidItems * 100; // 200
      expect(total).toBe(200);
    });

    test("Buy 3 Get 1: 6 items = pay 4", () => {
      const item = { qty: 6, unitPrice: 100, method: "8", dealQty: 3 };
      const freeItems = Math.floor(6 / 3); // 2
      const paidItems = 6 - freeItems; // 4
      const total = paidItems * 100; // 400
      expect(total).toBe(400);
    });
  });

  describe("Interpretation B: dealQty = N+1 (total items)", () => {
    test("Buy 3 Get 1: dealQty=4, 4 items = pay 3", () => {
      const item = { qty: 4, unitPrice: 100, method: "8", dealQty: 4 };
      const sets = Math.floor(4 / 4); // 1 set
      const remainder = 4 % 4; // 0
      const total = sets * 3 * 100 + remainder * 100; // 300
      expect(total).toBe(300);
    });
  });
});
```

---

## 📝 Documentation

### Field Mapping Strategy Document

Create `docs/field-mapping-strategy.md`:

```markdown
# Field Mapping Strategy

## Philosophy

**Single Source of Truth**: All field normalization happens in Cloud Function (`functions/src/services/cartService.js`)

**Client Responsibility**: Display data only, minimal transformation

## Key Normalization Algorithm

1. Trim whitespace
2. Convert to UPPERCASE
3. Replace `_` and multiple spaces with single space
4. Remove parentheses `()`

## Mapping Dictionary

| Normalized Key   | Target Field | Priority |
| ---------------- | ------------ | -------- |
| DESCRIPTIONPRINT | name         | 1        |
| REGPRICE         | unitPrice    | 1        |
| METHOD           | method       | 1        |
| DEALQTY          | dealQty      | 1        |
| DEALPRICE        | dealPrice    | 1        |

## Adding New Mappings

When a new unmapped field is detected in logs:

1. Normalize the key using `normalizeKey()`
2. Add to `FIELD_MAP` dictionary
3. Add unit test
4. Deploy to Cloud Function
5. Monitor for 24 hours
```

### Promotion Formulas Documentation

Create `docs/promotion-formulas-verified.md`:

```markdown
# Promotion Calculation Formulas (Verified)

## Method 8: Buy N Get 1 Free

### Current Implementation (Interpretation A)

**Assumption**: `dealQty` = N (number of items to buy)

**Formula**:
```

freeItems = floor(quantity ÷ dealQty)
paidItems = quantity - freeItems
total = paidItems × unitPrice

```

**Example** (dealQty=3, "Buy 3 Get 1"):
- Quantity 3: Pay for 2 = ฿200
- Quantity 6: Pay for 4 = ฿400

### Alternative Interpretation B (Document for verification)

**Assumption**: `dealQty` = N+1 (total items including free)

**Formula**:
```

completeSets = floor(quantity ÷ dealQty)
remainder = quantity % dealQty
total = (completeSets × (dealQty-1) × unitPrice) + (remainder × unitPrice)

```

**Example** (dealQty=4, "Buy 3 Get 1"):
- Quantity 4: Pay for 3 = ฿300
- Quantity 8: Pay for 6 = ฿600

### ⚠️ Action Required

Verify with actual data which interpretation is correct:
- [ ] Check sample products with Method 8
- [ ] Confirm dealQty values in database
- [ ] Test with cashier feedback
- [ ] Update implementation if needed
```

---

## 🚀 Safe Deployment Strategy

### Phase 0: Guardrails

1. Deploy feature flags (all OFF)
2. Deploy logging (monitoring only)
3. Monitor for 1 day
4. **Rollback**: None needed (no behavior change)

### Phase 1: Server-Side Normalization

1. Deploy Cloud Function with flag OFF
2. Enable flag for 10% of requests
3. Monitor error rates and field coverage
4. Gradually increase to 100% over 3 days
5. **Rollback**: Set flag to false

### Phase 2: Client Alignment

1. Deploy client changes
2. Test with sample products
3. Monitor search/scan operations
4. **Rollback**: Revert posService.js

### Phase 3: Badge Colors

1. Deploy CSS changes
2. A/B test with staff
3. Collect feedback
4. **Rollback**: CSS-only, instant revert

### Phase 4: Search UX

1. Deploy SearchBox component
2. Feature flag for SearchUX_V2
3. Test with cashiers
4. **Rollback**: Revert to inline search

### Phase 5: Mobile Layout

1. Deploy responsive layout
2. Test on physical devices
3. Monitor mobile metrics
4. **Rollback**: CSS media query adjustment

---

## 📊 Success Metrics

### Data Accuracy (Phase 1-2)

- Field mapping coverage: > 99%
- Calculation errors: 0%
- Unmapped keys: < 5 unique keys/week

### User Experience (Phase 3-4)

- Badge visibility: > 95% staff recognition
- Search speed: < 300ms response
- Keyboard nav adoption: > 30% after 1 week

### Mobile Experience (Phase 5)

- Mobile checkout success: > 95%
- Tab switch performance: < 100ms
- Mobile page load: < 2s

---

## 🎯 Acceptance Criteria

### Phase 0

- [x] Feature flags toggle correctly
- [x] Logging doesn't spam production
- [x] Monitoring dashboard operational

### Phase 1

- [ ] `DESCRIPTION (PRINT)` maps to name
- [ ] `REG PRICE` maps to unitPrice
- [ ] `DEAL PRICE` / `DEAL QTY` map correctly
- [ ] NaN values become 0
- [ ] Backward compatibility maintained
- [ ] No UI touched

### Phase 2

- [ ] Spread operator in correct order
- [ ] Search returns enriched data
- [ ] Scan returns method/dealQty/dealPrice
- [ ] No duplicate normalization

### Phase 3

- [ ] Method 8 = blue (#184290)
- [ ] Other methods = orange (#f97316)
- [ ] Fallback for missing badgeText

### Phase 4

- [ ] Keyboard navigation works
- [ ] ARIA labels present
- [ ] Google-style appearance
- [ ] Separate component (not inline)

### Phase 5

- [ ] Desktop untouched
- [ ] Mobile shows tabs
- [ ] CSS breakpoints only
- [ ] Safe area insets

---

## 📅 Revised Timeline

**Week 1:**

- Day 1: Phase 0 (Guardrails)
- Day 2-3: Phase 1 (Server normalization)
- Day 4: Phase 2 (Client alignment)
- Day 5: Testing & monitoring

**Week 2:**

- Day 1: Phase 3 (Badge colors)
- Day 2-3: Phase 4 (Search UX)
- Day 4-5: Phase 5 (Mobile layout)

**Week 3:**

- Day 1-2: Integration testing
- Day 3-5: User training & monitoring

---

## 🎓 Team Communication

### Before Implementation

- Review this plan with team
- Confirm Method 8 interpretation with stakeholders
- Set up monitoring dashboards
- Prepare rollback procedures

### During Implementation

- Daily standup on progress
- Immediate communication of issues
- Feature flag status updates
- Error log reviews

### After Implementation

- Knowledge transfer sessions
- Documentation handoff
- Celebration of success! 🎉

---

_End of Revised Enhancement Plan_
