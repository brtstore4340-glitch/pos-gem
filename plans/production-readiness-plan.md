# Boots POS - Production Readiness Plan

**Project:** Boots-POS Gemini  
**Date:** 2025-12-31  
**Status:** Pre-Production  
**Target:** Production Deployment

---

## Executive Summary

This plan outlines the steps required to make the Boots POS system production-ready. The system currently has a functional foundation with:
- ✅ Cloud Functions backend (scanItem, calculateOrder implemented)
- ✅ React frontend with POS UI
- ✅ Firebase integration configured
- ✅ Basic cart calculation logic
- ✅ Thai language support (Noto Sans Thai)
- ✅ Theme support (light/dark mode)

**Critical Gaps:**
- ❌ No authentication/authorization
- ❌ No Firestore security rules
- ❌ No error handling strategy
- ❌ No testing infrastructure
- ❌ No monitoring/logging
- ❌ No CI/CD pipeline

---

## Phase 1: Security & Authentication (Priority: CRITICAL)

### 1.1 Environment Configuration

**Status:** ❌ Missing

**Files to Create:**
```
.env.example
.env.local (template for developers)
.env.production (for deployment)
```

**Required Variables:**
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Application
VITE_APP_ENV=production
VITE_STORE_ID=4340
VITE_ENABLE_DEBUG=false

# Cloud Functions
FIREBASE_FUNCTIONS_REGION=asia-southeast1
```

**Action Items:**
1. Create [`config/firebase.env.example`](config/firebase.env.example)
2. Add `.env*` to [`.gitignore`](.gitignore) (already done in pos-gem)
3. Document environment setup in README
4. Create secure secret management for production

---

### 1.2 Firestore Security Rules

**Status:** ❌ Missing Critical File

**File to Create:** [`firestore.rules`](firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper Functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    function isAdmin() {
      return isAuthenticated() && getUserRole() == 'admin';
    }
    
    function isManager() {
      return isAuthenticated() && (getUserRole() == 'manager' || isAdmin());
    }
    
    function isCashier() {
      return isAuthenticated() && (getUserRole() == 'cashier' || isManager());
    }
    
    // Users Collection - Profile data
    match /users/{userId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow write: if isAdmin();
    }
    
    // Products - Read only for authenticated, write for admins
    match /products/{productId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
      allow create: if isAdmin();
      allow delete: if false; // Never allow deletion, use status flag
    }
    
    // Invoices - Cashiers can create, admins can modify
    match /invoices/{invoiceId} {
      allow read: if isAuthenticated();
      allow create: if isCashier();
      allow update: if isManager() || 
                       (isCashier() && resource.data.status == 'draft');
      allow delete: if false; // Never delete, use void status
    }
    
    // Upload Metadata - Admin only
    match /uploadMetadata/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // App Settings - Admin only
    match /appSettings/{setting} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // Stock Ledger - Read for authenticated, write for system
    match /stockLedger/{ledgerId} {
      allow read: if isAuthenticated();
      allow create: if isCashier(); // Via functions only
      allow update, delete: if false;
    }
    
    // Daily Reports - Read by authenticated, create by system
    match /dailyReports/{reportId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Action Items:**
1. Create [`firestore.rules`](firestore.rules) with above content
2. Test rules locally with Firebase Emulator
3. Deploy rules: `firebase deploy --only firestore:rules`
4. Create test suite for security rules

---

### 1.3 Firebase Authentication Setup

**Status:** ⚠️ Partial (stub exists in [`src/services/authService.js`](src/services/authService.js))

**Create:** [`src/context/AuthContext.jsx`](src/context/AuthContext.jsx)

```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (!userDoc.exists()) {
            throw new Error('User profile not found');
          }
          
          const profile = userDoc.data();
          
          setUser(firebaseUser);
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: profile.role || 'cashier',
            storeId: profile.storeId || '4340',
            displayName: profile.displayName || firebaseUser.email,
            permissions: profile.permissions || {},
          });
        } else {
          setUser(null);
          setUserData(null);
        }
      } catch (err) {
        console.error('Auth state error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const hasPermission = (permission) => {
    if (!userData) return false;
    if (userData.role === 'admin') return true;
    return userData.permissions[permission] === true;
  };

  const value = {
    user,
    userData,
    loading,
    error,
    signIn,
    signOut,
    resetPassword,
    hasPermission,
    isAdmin: userData?.role === 'admin',
    isManager: userData?.role === 'manager' || userData?.role === 'admin',
    isCashier: !!userData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

### 1.4 Login UI Components

**Create:** [`src/pages/LoginPage.jsx`](src/pages/LoginPage.jsx)

```jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/pos';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await signIn(email, password);
    
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ / Login failed');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-boots-base to-boots-hover px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-boots-base mb-2">
            Boots POS
          </h1>
          <p className="text-boots-subtext">
            ระบบจุดขาย / Point of Sale System
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              อีเมล / Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-boots-base focus:border-transparent"
              placeholder="employee@boots.com"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              รหัสผ่าน / Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-boots-base focus:border-transparent"
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-boots-base text-white py-3 rounded-lg font-medium hover:bg-boots-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ / Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-boots-subtext">
            Store ID: 4340
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

### 1.5 Protected Routes

**Create:** [`src/components/ProtectedRoute.jsx`](src/components/ProtectedRoute.jsx)

```jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requiredRole, requiredPermission }) {
  const { user, userData, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-boots-base mx-auto mb-4"></div>
          <p className="text-boots-subtext">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirement
  if (requiredRole) {
    const roleHierarchy = { admin: 3, manager: 2, cashier: 1 };
    const userLevel = roleHierarchy[userData?.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">
              Access Denied
            </h2>
            <p className="text-boots-subtext">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      );
    }
  }

  // Check specific permission
  if (requiredPermission && !userData?.permissions?.[requiredPermission]) {
    if (userData?.role !== 'admin') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">
              Permission Required
            </h2>
            <p className="text-boots-subtext">
              You need specific permission to access this feature.
            </p>
          </div>
        </div>
      );
    }
  }

  return children;
}
```

---

### 1.6 Update App.jsx with Auth

**Modify:** [`src/App.jsx`](src/App.jsx)

Add AuthProvider wrapper and protected routes:

```jsx
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="app-main">
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <HomePage />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/pos" element={
                <ProtectedRoute>
                  <Layout>
                    <PosUI />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/admin" element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <AdminSettings />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<Navigate to="/pos" replace />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

---

### 1.7 User Management Firestore Structure

**Collection:** `users`

```javascript
// Document structure for users/{userId}
{
  uid: "firebase_auth_uid",
  email: "cashier@boots.com",
  displayName: "Cashier #01",
  role: "cashier", // admin | manager | cashier
  storeId: "4340",
  permissions: {
    canVoid: false,
    canDiscount: false,
    maxDiscountPercent: 0,
    canViewReports: false,
    canManageInventory: false,
    canManageUsers: false
  },
  isActive: true,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastLogin: Timestamp,
  createdBy: "admin_user_id"
}
```

**Seed Script:** Create [`scripts/seed-users.js`](scripts/seed-users.js)

---

### 1.8 Enhanced Cloud Functions Auth

**Modify:** [`functions/src/controllers/posController.js`](functions/src/controllers/posController.js)

Add role checking to all functions:

```javascript
const { getUserRole, hasPermission } = require('../middleware/auth');

exports.voidBill = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  // Check role
  const userRole = await getUserRole(context.auth.uid);
  if (userRole !== 'admin' && userRole !== 'manager') {
    throw new functions.https.HttpsError(
      'permission-denied', 
      'Only managers and admins can void transactions'
    );
  }

  const { orderId, reason } = data;
  // ... void logic
});
```

---

## Phase 2: Error Handling & Validation (Priority: HIGH)

### 2.1 Input Validation for Cloud Functions

**Create:** [`functions/src/utils/validation.js`](functions/src/utils/validation.js)

```javascript
const functions = require('firebase-functions');

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

const validators = {
  isRequired: (value, fieldName) => {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }
  },

  isString: (value, fieldName) => {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName);
    }
  },

  isNumber: (value, fieldName) => {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
    }
  },

  isPositive: (value, fieldName) => {
    if (value <= 0) {
      throw new ValidationError(`${fieldName} must be positive`, fieldName);
    }
  },

  isArray: (value, fieldName) => {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an array`, fieldName);
    }
  },

  isValidSKU: (sku) => {
    validators.isRequired(sku, 'sku');
    validators.isString(sku, 'sku');
    if (sku.length < 3 || sku.length > 50) {
      throw new ValidationError('SKU must be between 3 and 50 characters', 'sku');
    }
  },

  isValidOrderItems: (items) => {
    validators.isRequired(items, 'items');
    validators.isArray(items, 'items');
    
    if (items.length === 0) {
      throw new ValidationError('Order must contain at least one item', 'items');
    }

    items.forEach((item, index) => {
      if (!item.sku) {
        throw new ValidationError(`Item at index ${index} missing SKU`, `items[${index}].sku`);
      }
      if (typeof item.qty !== 'number' || item.qty <= 0) {
        throw new ValidationError(`Invalid quantity for item ${item.sku}`, `items[${index}].qty`);
      }
    });
  }
};

module.exports = { validators, ValidationError };
```

---

### 2.2 Error Boundary Components

**Create:** [`src/components/ErrorBoundary.jsx`](src/components/ErrorBoundary.jsx)

Already exists but needs enhancement:

```jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log to error tracking service
    console.error('Error caught by boundary:', error, errorInfo);
    
    // TODO: Send to Sentry or Firebase Crashlytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-4">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">
                เกิดข้อผิดพลาด / Something went wrong
              </h2>
              <p className="text-boots-subtext mb-4">
                กรุณาลองใหม่อีกครั้ง หรือติดต่อฝ่ายสนับสนุน
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 p-4 bg-gray-100 rounded text-sm">
                <summary className="cursor-pointer font-medium">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-boots-base text-white py-2 rounded hover:bg-boots-hover transition-colors"
              >
                ลองอีกครั้ง / Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600 transition-colors"
              >
                กลับหน้าหลัก / Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

### 2.3 Comprehensive Logging Strategy

**Create:** [`functions/src/utils/logger.js`](functions/src/utils/logger.js)

```javascript
const functions = require('firebase-functions');

class Logger {
  constructor(context = 'general') {
    this.context = context;
  }

  _formatMessage(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...data
    };
  }

  info(message, data) {
    console.log(JSON.stringify(this._formatMessage('INFO', message, data)));
  }

  warn(message, data) {
    console.warn(JSON.stringify(this._formatMessage('WARN', message, data)));
  }

  error(message, error, data) {
    console.error(JSON.stringify(this._formatMessage('ERROR', message, {
      ...data,
      error: error.message,
      stack: error.stack
    })));
  }

  debug(message, data) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify(this._formatMessage('DEBUG', message, data)));
    }
  }
}

module.exports = Logger;
```

---

### 2.4 Rate Limiting

**Create:** [`functions/src/middleware/rateLimit.js`](functions/src/middleware/rateLimit.js)

```javascript
const admin = require('firebase-admin');

const rateLimitStore = new Map();

async function rateLimit(context, limits = { maxRequests: 100, windowMs: 60000 }) {
  if (!context.auth) return true; // Skip for unauthenticated

  const userId = context.auth.uid;
  const now = Date.now();
  const windowStart = now - limits.windowMs;

  // Clean old entries
  if (rateLimitStore.has(userId)) {
    const userRequests = rateLimitStore.get(userId)
      .filter(timestamp => timestamp > windowStart);
    rateLimitStore.set(userId, userRequests);
  } else {
    rateLimitStore.set(userId, []);
  }

  const requests = rateLimitStore.get(userId);

  if (requests.length >= limits.maxRequests) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Too many requests. Please try again later.'
    );
  }

  requests.push(now);
  return true;
}

module.exports = { rateLimit };
```

---

## Phase 3: Testing Infrastructure (Priority: HIGH)

### 3.1 Testing Setup

**Install Dependencies:**
```bash
# Frontend testing
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom

# Backend testing  
cd functions
npm install --save-dev jest firebase-functions-test
```

**Configure Vitest:** Create [`vitest.config.js`](vitest.config.js)

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
      ]
    }
  }
});
```

---

### 3.2 Unit Tests for Cart Service

**Create:** [`functions/src/services/cartService.test.js`](functions/src/services/cartService.test.js)

```javascript
const { calculateCartSummary } = require('./cartService');

describe('calculateCartSummary', () => {
  describe('Promotion Method 8 (Buy N Get 1 Free)', () => {
    it('should calculate buy 1 get 1 free correctly', () => {
      const items = [{
        sku: 'TEST001',
        qty: 2,
        unitPrice: 100,
        method: '8',
        dealQty: 2
      }];

      const result = calculateCartSummary(items);
      
      expect(result.items[0].calculatedTotal).toBe(100); // Pay for 1, get 1 free
      expect(result.items[0].promoDiscount).toBe(-100);
      expect(result.items[0].badgeText).toBe('ซื้อ 1 แถม 1');
    });

    it('should handle buy 3 get 1 free with 6 items', () => {
      const items = [{
        sku: 'TEST002',
        qty: 6,
        unitPrice: 50,
        method: '8',
        dealQty: 3
      }];

      const result = calculateCartSummary(items);
      
      // 6 items = 2 groups of 3, pay for 4 items
      expect(result.items[0].calculatedTotal).toBe(200); // 4 * 50
      expect(result.summary.totalItems).toBe(6);
    });
  });

  describe('Promotion Method 9 (Bundle Price)', () => {
    it('should calculate bundle pricing correctly', () => {
      const items = [{
        sku: 'TEST003',
        qty: 4,
        unitPrice: 30,
        method: '9',
        dealQty: 2,
        dealPrice: 50
      }];

      const result = calculateCartSummary(items);
      
      // 4 items = 2 bundles at 50 each = 100
      expect(result.items[0].calculatedTotal).toBe(100);
      expect(result.items[0].promoDiscount).toBe(-20); // Save 20 (120-100)
    });

    it('should handle remainder items at regular price', () => {
      const items = [{
        sku: 'TEST004',
        qty: 5,
        unitPrice: 30,
        method: '9',
        dealQty: 2,
        dealPrice: 50
      }];

      const result = calculateCartSummary(items);
      
      // 2 bundles (4 items) + 1 regular = (2*50) + 30 = 130
      expect(result.items[0].calculatedTotal).toBe(130);
    });
  });

  describe('VAT Calculation', () => {
    it('should calculate 7% VAT correctly', () => {
      const items = [{
        sku: 'TEST005',
        qty: 1,
        unitPrice: 107,
        method: '0'
      }];

      const result = calculateCartSummary(items);
      
      expect(result.summary.grandTotal).toBe(107);
      expect(result.summary.vatTotal).toBeCloseTo(7, 2);
      expect(result.summary.netTotal).toBeCloseTo(100, 2);
    });
  });

  describe('Bill Discount', () => {
    it('should apply bill-wide discount correctly', () => {
      const items = [{
        sku: 'TEST006',
        qty: 1,
        unitPrice: 100,
        method: '0'
      }];

      const result = calculateCartSummary(items, 10); // 10% discount
      
      expect(result.summary.billDiscountAmount).toBe(-10);
      expect(result.summary.grandTotal).toBe(90);
    });
  });
});
```

---

### 3.3 Integration Tests

**Create:** [`functions/test/integration/posController.test.js`](functions/test/integration/posController.test.js)

```javascript
const test = require('firebase-functions-test')();
const admin = require('firebase-admin');

describe('POS Controller Integration', () => {
  let scanItem, calculateOrder;

  beforeAll(() => {
    const controller = require('../../src/controllers/posController');
    scanItem = test.wrap(controller.scanItem);
    calculateOrder = test.wrap(controller.calculateOrder);
  });

  afterAll(() => {
    test.cleanup();
  });

  describe('scanItem', () => {
    it('should reject unauthenticated requests', async () => {
      await expect(
        scanItem({ sku: 'TEST001' })
      ).rejects.toThrow('unauthenticated');
    });

    it('should return product data for valid SKU', async () => {
      const result = await scanItem(
        { sku: 'TEST001' },
        { auth: { uid: 'test-user' } }
      );

      expect(result).toHaveProperty('sku');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('price');
    });
  });
});
```

---

### 3.4 E2E Test Setup

**Create:** [`e2e/pos-workflow.spec.js`](e2e/pos-workflow.spec.js)

```javascript
// Using Playwright or Cypress
describe('POS Complete Workflow', () => {
  it('should complete a full sale transaction', () => {
    // 1. Login
    cy.visit('/login');
    cy.get('input[type="email"]').type('cashier@boots.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    // 2. Navigate to POS
    cy.url().should('include', '/pos');
    
    // 3. Scan items
    cy.get('#scanner-input').type('7531745{enter}');
    cy.get('.cart-items').should('contain', '7531745');
    
    // 4. Checkout
    cy.get('#checkout-button').click();
    cy.get('#payment-amount').type('200');
    cy.get('#confirm-payment').click();
    
    // 5. Verify receipt
    cy.get('.receipt-modal').should('be.visible');
    cy.get('.receipt-total').should('contain', '฿');
  });
});
```

---

## Phase 4: Performance & Optimization (Priority: MEDIUM)

### 4.1 Caching Strategy

**Modify:** [`src/services/posService.js`](src/services/posService.js)

Add product caching:

```javascript
// Simple in-memory cache
const productCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const posService = {
  scanItem: async (keyword) => {
    const cacheKey = `product:${keyword}`;
    const cached = productCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const scanItemFn = httpsCallable(functions, 'scanItem');
    const result = await scanItemFn({ sku: keyword });
    
    productCache.set(cacheKey, {
      data: result.data,
      timestamp: Date.now()
    });
    
    return result.data;
  },
  
  // Clear cache on demand
  clearCache: () => {
    productCache.clear();
  }
};
```

---

### 4.2 Code Splitting

**Modify:** [`src/App.jsx`](src/App.jsx)

```jsx
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const PosUI = lazy(() => import('./components/PosUI'));
const AdminSettings = lazy(() => import('./components/AdminSettings'));
const DailyReportModal = lazy(() => import('./components/DailyReportModal'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* ... routes */}
      </Routes>
    </Suspense>
  );
}
```

---

### 4.3 Service Worker for Offline

**Create:** [`public/sw.js`](public/sw.js)

```javascript
const CACHE_NAME = 'boots-pos-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/index.css',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

---

## Phase 5: Monitoring & Logging (Priority: MEDIUM)

### 5.1 Firebase Performance Monitoring

**Add to:** [`src/lib/firebase.js`](src/lib/firebase.js)

```javascript
import { getPerformance } from 'firebase/performance';

const perf = getPerformance(app);

// Custom traces
export const trace = (name) => perf.trace(name);
```

---

### 5.2 Error Tracking with Sentry (Optional)

**Install:**
```bash
npm install @sentry/react @sentry/tracing
```

**Configure:** [`src/main.jsx`](src/main.jsx)

```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_APP_ENV,
  tracesSampleRate: 0.1,
});
```

---

### 5.3 Health Check Endpoint

**Create:** [`functions/src/controllers/healthController.js`](functions/src/controllers/healthController.js)

```javascript
exports.health = functions.https.onRequest((req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: require('../../package.json').version
  });
});
```

---

## Phase 6: Documentation (Priority: MEDIUM)

### 6.1 API Documentation

**Create:** [`docs/api/README.md`](docs/api/README.md)

Document all Cloud Functions with:
- Endpoint URL
- Authentication requirements
- Request/Response schemas
- Example usage
- Error codes

---

### 6.2 User Manual

**Create:** [`docs/user-manual.md`](docs/user-manual.md)

- Login procedures
- Daily operations
- Scanning items
- Handling returns
- End-of-day reports
- Troubleshooting

---

### 6.3 Deployment Guide

**Create:** [`docs/deployment.md`](docs/deployment.md)

Step-by-step deployment procedures.

---

## Phase 7: CI/CD Pipeline (Priority: LOW)

### 7.1 GitHub Actions

**Create:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: |
          npm ci
          cd functions && npm ci
          
      - name: Run tests
        run: |
          npm test
          cd functions && npm test
          
      - name: Build
        run: npm run build
        
      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only hosting,functions
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

---

## Phase 8: Final Verification (Priority: CRITICAL)

### 8.1 Security Audit Checklist

- [ ] Firestore rules tested and deployed
- [ ] All environment variables secured
- [ ] Authentication enforced on all routes
- [ ] Input validation on all endpoints
- [ ] XSS protection implemented
- [ ] CSRF tokens where needed
- [ ] Rate limiting active
- [ ] Sensitive data encrypted

---

### 8.2 Load Testing

Use tools like:
- Artillery
- k6
- JMeter

Test scenarios:
- 100 concurrent users scanning items
- Peak hour transaction loads
- Database query performance

---

### 8.3 Production Deployment Checklist

- [ ] Environment variables configured
- [ ] Firebase project set to production
- [ ] Security rules deployed
- [ ] Cloud Functions deployed
- [ ] Monitoring enabled
- [ ] Backup strategy in place
- [ ] Rollback plan documented
- [ ] Support team trained
- [ ] User credentials created
- [ ] Initial data seeded

---

## Success Criteria

The system is production-ready when:

1. ✅ **Security**: All auth and security measures implemented
2. ✅ **Reliability**: Error handling covers all scenarios
3. ✅ **Performance**: Response times < 1s for 95% of requests
4. ✅ **Testing**: >80% code coverage, all critical paths tested
5. ✅ **Monitoring**: Logging and alerting operational
6. ✅ **Documentation**: Complete for users and developers
7. ✅ **Deployment**: Automated pipeline functional
8. ✅ **Compliance**: Data protection and audit trails in place

---

## Timeline Estimate

- **Phase 1 (Security):** 2-3 weeks
- **Phase 2 (Error Handling):** 1 week
- **Phase 3 (Testing):** 2 weeks
- **Phase 4 (Performance):** 1 week
- **Phase 5 (Monitoring):** 1 week
- **Phase 6 (Documentation):** 1 week
- **Phase 7 (CI/CD):** 1 week
- **Phase 8 (Verification):** 1 week

**Total:** 10-11 weeks for full production readiness

---

## Next Steps

1. Review and approve this plan
2. Set up development/staging/production environments
3. Begin Phase 1: Security & Authentication
4. Conduct weekly reviews and adjust priorities
5. Document progress and blockers

---

**Last Updated:** 2025-12-31  
**Status:** Draft - Pending Review
