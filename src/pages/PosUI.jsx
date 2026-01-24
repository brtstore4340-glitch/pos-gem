// src/pages/PosUI.jsx
import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  ScanBarcode,
  Trash2,
  Loader2,
  UploadCloud,
  User,
  FileText,
  LayoutGrid,
  Settings,
  Box,
  Monitor,
  Package,
  Percent,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useCart } from '../hooks/useCart';
import { useScanListener } from '../hooks/useScanListener';
import ReceiptModal from './ReceiptModal';
import ProductLookupModal from './ProductLookupModal';
import DailyReportModal from './DailyReportModal';
import PosUploadModal from './PosUploadModal';
import NeuClock from '../components/NeuClock';
import { posService } from '../services/posService';
import { useTheme } from '../context/ThemeContext';

export default function PosUI({ isDarkMode: externalDarkMode }) {
  const theme = useTheme();
  const {
    cartItems,
    addToCart: originalAddToCart,
    decreaseItem,
    removeFromCart,
    clearCart,
    summary,
    lastScanned,
    isLoading,
    error,
    updateBillDiscount,
    billDiscount,
    addCoupon,
    removeCoupon,
    coupons,
    updateAllowance,
    allowance,
    topup,
  } = useCart();

  const [lastOrder, setLastOrder] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isVoidMode, setIsVoidMode] = useState(false);
  const [nextQty, setNextQty] = useState(1);

  const isDarkMode = externalDarkMode ?? theme?.isDark ?? false;

  // Navigation State
  const [activeTab, setActiveTab] = useState('POS');

  // Modal States
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Discount modal states
  const [activeTabDiscount, setActiveTabDiscount] = useState('discount');

  // Coupon input
  const [couponInput, setCouponInput] = useState({ type: '', value: '', code: '' });
  const [showCouponInput, setShowCouponInput] = useState(false);

  const navItemStyle = (isActive) =>
    cn(
      'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 cursor-pointer select-none shrink-0 btn-press shadow-orange-500/20',
      isActive
        ? 'bg-[#0B2A97] text-white'
        : isDarkMode
          ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    );

  const lastItemDetail = lastScanned
    ? cartItems.find((i) => i.sku === lastScanned || i.id === lastScanned)
    : null;

  const handleScanAction = async (skuOrItem) => {
    if (showCouponInput) {
      setCouponInput((prev) => ({
        ...prev,
        code: typeof skuOrItem === 'string' ? skuOrItem : skuOrItem.sku,
      }));
      return;
    }

    const quantityToApply = nextQty;

    if (isVoidMode) {
      const sku = typeof skuOrItem === 'string' ? skuOrItem : skuOrItem.sku || skuOrItem.id;
      decreaseItem(sku);
      setShowDropdown(false);
      setInputValue('');
      if (nextQty !== 1) setNextQty(1);
      return;
    }

    if (typeof skuOrItem === 'string') {
      try {
        const item = await posService.scanItem(skuOrItem);
        await originalAddToCart(item, quantityToApply);
      } catch (e) {
        console.error(e);
      }
    } else {
      await originalAddToCart(skuOrItem, quantityToApply);
    }

    if (nextQty !== 1) setNextQty(1);
    setShowDropdown(false);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    const orderData = {
      items: [...cartItems],
      summary,
      cashier: 'Staff #01',
      device: 'POS-Web',
      adjustments: { billDiscount, coupons, allowance, topup },
    };

    setIsSaving(true);
    try {
      const orderId = await posService.createOrder(orderData);
      setLastOrder({ ...orderData, id: orderId, timestamp: new Date().toISOString() });
      clearCart();
    } catch (err) {
      alert('Error: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const { inputRef, inputValue, setInputValue, handleInputKeyDown, handleInputChange } =
    useScanListener(handleScanAction, !lastOrder ? handleCheckout : undefined);

  const onInputChangeWrapper = (e) => {
    const val = e.target.value;
    if (val.endsWith('*')) {
      const numberPart = val.slice(0, -1);
      if (/^\d+$/.test(numberPart)) {
        const qty = parseInt(numberPart, 10);
        if (qty > 0) {
          setNextQty(qty);
          setInputValue('');
        } else {
          alert('จำนวนต้องมากกว่า 0');
          setInputValue('');
        }
      } else {
        setInpu
