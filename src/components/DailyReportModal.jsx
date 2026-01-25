import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Calendar,
  Printer,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { posService } from "../services/posService";
import { cn } from "../utils/cn";
import JsBarcode from "jsbarcode";

export default function DailyReportModal({ onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalVoid: 0,
    count: 0,
    totalItems: 0,
    totalDiscount: 0,
  });

  // Filter States (Default to Bangkok Today)
  const getBangkokDate = () => {
    // Returns YYYY-MM-DD in Bangkok timezone
    const d = new Date().toLocaleString("en-CA", { timeZone: "Asia/Bangkok" });
    return d.split(",")[0];
  };

  const [selectedDate, setSelectedDate] = useState(getBangkokDate());
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate barcodes (optimized with cleanup)
  useEffect(() => {
    if (orders.length === 0) return;

    // Debounce to prevent excessive re-renders
    const timer = setTimeout(() => {
      orders.forEach((order) => {
        order.items?.forEach((item, index) => {
          try {
            const barcodeValue = item.barcode || item.sku;
            if (!barcodeValue || barcodeValue === "-") return;

            const canvasId = `barcode-${order.id}-${index}`;
            const canvas = document.getElementById(canvasId);

            if (canvas && canvas.getContext) {
              // Clear previous barcode
              const ctx = canvas.getContext("2d");
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // Generate new barcode
              JsBarcode(canvas, barcodeValue, {
                format: "CODE128",
                width: 1,
                height: 20,
                displayValue: false,
                margin: 0,
                background: "transparent",
              });
            }
          } catch (err) {
            console.error(
              `Barcode generation failed for ${item.sku}:`,
              err.message,
            );
          }
        });
      });
    }, 100); // 100ms debounce

    // Cleanup
    return () => clearTimeout(timer);
  }, [orders]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setExpandedRow(null);
    try {
      // Validate date inputs
      if (!selectedDate || !startTime || !endTime) {
        throw new Error("กรุณาระบุวันที่และเวลาให้ครบถ้วน");
      }

      const start = new Date(`${selectedDate}T${startTime}:00`);
      const end = new Date(`${selectedDate}T${endTime}:59`);

      // Validate date objects
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("รูปแบบวันที่หรือเวลาไม่ถูกต้อง");
      }

      if (start > end) {
        throw new Error("เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด");
      }

      const data = await posService.getSalesReport(start, end);

      // Validate response data
      if (!Array.isArray(data)) {
        console.warn("Invalid data format received:", data);
        setOrders([]);
        setSummary({
          totalSales: 0,
          totalVoid: 0,
          count: 0,
          totalItems: 0,
          totalDiscount: 0,
        });
        return;
      }

      setOrders(data);

      // --- Calculate Summary with validation ---
      const validOrders = data.filter(
        (o) => o && o.status !== "void" && o.summary,
      );

      const totalSales = validOrders.reduce((sum, o) => {
        const subtotal = Number(o.summary?.subtotal);
        return sum + (isNaN(subtotal) ? 0 : subtotal);
      }, 0);

      const totalItems = validOrders.reduce((sum, o) => {
        const items = Number(o.summary?.totalItems);
        return sum + (isNaN(items) ? 0 : items);
      }, 0);

      const totalDiscount = validOrders.reduce((sum, o) => {
        const billDiscount = (o.items || []).reduce((isum, item) => {
          const price = Number(item.price) || 0;
          const qty = Number(item.qty) || 0;
          const normalTotal = price * qty;
          const soldTotal =
            item.calculatedTotal !== undefined
              ? Number(item.calculatedTotal) || 0
              : normalTotal;
          return isum + Math.max(0, normalTotal - soldTotal); // Prevent negative discounts
        }, 0);
        const orderDiscount = Number(o.summary?.discount) || 0;
        return sum + billDiscount + orderDiscount;
      }, 0);

      setSummary({
        totalSales: Math.max(0, totalSales),
        totalVoid: 0,
        count: validOrders.length,
        totalItems: Math.max(0, totalItems),
        totalDiscount: Math.max(0, totalDiscount),
      });
    } catch (err) {
      console.error("Report Error:", err);
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
      setOrders([]);
      setSummary({
        totalSales: 0,
        totalVoid: 0,
        count: 0,
        totalItems: 0,
        totalDiscount: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, startTime, endTime]);

  const handleVoid = async (orderId) => {
    if (!window.confirm("ยืนยันการยกเลิกบิลนี้?")) return;
    try {
      await posService.voidInvoice(orderId, "User Cancelled");
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* 🟢 PRINT STYLING - NOTO SANS THAI */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
        
        #print-section { display: none; }
        
        @media print {
          @page { 
            margin: 1.5cm 1cm; 
            size: A4 portrait; 
          }
          
          body * { 
            visibility: hidden; 
          }
          
          #print-section, #print-section * { 
            visibility: visible !important; 
            color: #1a1a1a !important;
            font-family: 'Noto Sans Thai', sans-serif !important;
          }
          
          #print-section { 
            display: block !important; 
            position: fixed; 
            left: 0; 
            top: 0; 
            width: 100%; 
            height: 100%; 
            background: white !important; 
            z-index: 99999;
            padding: 20px 30px;
          }
          
          .modal-overlay { 
            display: none !important; 
          }
          
          /* Print-specific styling */
          .print-header {
            border-bottom: 3px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          
          .print-summary-box {
            background: #f8fafc !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 20px;
          }
          
          .print-table th {
            background: #f1f5f9 !important;
            font-weight: 600;
            padding: 10px 8px;
          }
          
          .print-table td {
            padding: 8px;
          }
          
          .print-barcode {
            opacity: 0.7;
          }
          
          .print-footer-total {
            background: #f8fafc !important;
            font-weight: 700;
          }
        }
      `}</style>

      {/* --- SCREEN VIEW --- */}
      <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden font-sans">
        <div className="bg-white w-[95vw] h-[95vh] max-w-7xl rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 shrink-0">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-800 rounded-xl">
                  <Calendar size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold font-kanit">
                    รายงานยอดขาย
                  </h2>
                  <p className="text-slate-400 text-sm">Summary Sales Report</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-full"
              >
                <X size={24} />
              </button>
            </div>

            {/* Filters */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block font-bold">
                    วันที่ (Date)
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block font-bold">
                    เริ่ม (Start)
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block font-bold">
                    ถึง (End)
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm h-10"
                  />
                </div>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 h-10 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                >
                  {loading ? (
                    "..."
                  ) : (
                    <>
                      <Search size={16} /> ค้นหา
                    </>
                  )}
                </button>
                <div className="flex-1 text-right">
                  <button
                    onClick={handlePrint}
                    disabled={orders.length === 0}
                    className="bg-white text-slate-900 hover:bg-slate-100 border border-slate-200 px-6 h-10 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition-all shadow-sm"
                  >
                    <Printer size={16} /> พิมพ์รายงาน
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold mb-1">
                จำนวนบิล
              </div>
              <div className="text-2xl font-bold text-slate-800">
                {summary.count}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold mb-1">
                รายการขาย
              </div>
              <div className="text-2xl font-bold text-slate-800">
                {summary.totalItems}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold mb-1">
                ยอดขายรวม
              </div>
              <div className="text-2xl font-bold text-blue-600">
                ฿{(summary.totalSales + summary.totalDiscount).toLocaleString()}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-bold mb-1">
                ส่วนลดรวม
              </div>
              <div className="text-2xl font-bold text-red-500">
                -฿{summary.totalDiscount.toLocaleString()}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-green-200 bg-green-50 shadow-sm">
              <div className="text-green-700 text-xs font-bold mb-1">
                ยอดสุทธิ (Net)
              </div>
              <div className="text-2xl font-bold text-green-700">
                ฿{summary.totalSales.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-4 w-10"></th>
                    <th className="p-4">เวลา</th>
                    <th className="p-4">เลขที่บิล</th>
                    <th className="p-4 text-center">สินค้า</th>
                    <th className="p-4 text-right">ยอดรวม</th>
                    <th className="p-4 text-center">สถานะ</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <React.Fragment key={order.id}>
                      <tr
                        className={cn(
                          "hover:bg-slate-50 cursor-pointer transition-colors",
                          expandedRow === order.id && "bg-blue-50/50",
                        )}
                        onClick={() => toggleRow(order.id)}
                      >
                        <td className="p-4 text-center">
                          {expandedRow === order.id ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </td>
                        <td className="p-4 text-slate-600">
                          {order.timestamp.toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-4 font-mono font-medium">
                          {order.id.slice(0, 8)}...
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-slate-100 px-2 py-1 rounded-full text-xs font-bold">
                            {order.summary?.totalItems}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-800">
                          ฿{(order.summary?.subtotal || 0).toLocaleString()}
                        </td>
                        <td className="p-4 text-center">
                          {order.status === "void" ? (
                            <span className="text-red-600 font-bold text-xs bg-red-100 px-2 py-1 rounded">
                              ยกเลิก
                            </span>
                          ) : (
                            <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded">
                              สำเร็จ
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {order.status !== "void" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVoid(order.id);
                              }}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedRow === order.id && (
                        <tr>
                          <td colSpan="7" className="p-0">
                            <div className="bg-slate-50 p-4 border-b border-slate-100 shadow-inner">
                              <div className="bg-white rounded border border-slate-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                    <tr>
                                      <th className="p-2 text-left w-32">
                                        รหัสสินค้า
                                      </th>
                                      <th className="p-2 text-left w-32">
                                        บาร์โค้ด
                                      </th>
                                      <th className="p-2 text-left">
                                        ชื่อสินค้า
                                      </th>
                                      <th className="p-2 text-right">ราคา</th>
                                      <th className="p-2 text-center">จำนวน</th>
                                      <th className="p-2 text-right text-red-500">
                                        ส่วนลด
                                      </th>
                                      <th className="p-2 text-right">รวม</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {order.items?.map((item, i) => {
                                      const normalTotal = item.price * item.qty;
                                      const finalTotal =
                                        item.calculatedTotal !== undefined
                                          ? item.calculatedTotal
                                          : normalTotal;
                                      const discount = normalTotal - finalTotal;
                                      return (
                                        <tr
                                          key={i}
                                          className="hover:bg-slate-50"
                                        >
                                          <td className="p-2 font-mono text-slate-500">
                                            {item.sku}
                                          </td>
                                          <td className="p-2 font-mono text-slate-500">
                                            {item.barcode || "-"}
                                          </td>
                                          <td className="p-2 font-medium">
                                            {item.name ||
                                              item.ProductDesc ||
                                              item.sku}
                                          </td>
                                          <td className="p-2 text-right">
                                            {(item.price || 0).toLocaleString()}
                                          </td>
                                          <td className="p-2 text-center font-bold">
                                            {item.qty}
                                          </td>
                                          <td className="p-2 text-right text-red-500">
                                            {discount > 0
                                              ? `-${discount.toLocaleString()}`
                                              : "-"}
                                          </td>
                                          <td className="p-2 text-right font-bold">
                                            {finalTotal.toLocaleString()}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* --- PRINT LAYOUT (MODERN DESIGN - NOTO SANS THAI) --- */}
      <div id="print-section" role="article" aria-label="Daily Sales Report">
        {/* Header */}
        <div className="print-header text-center" role="banner">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: "#2563eb", letterSpacing: "-0.5px" }}
          >
            รายงานสรุปยอดขาย
          </h1>
          <p
            className="text-sm"
            style={{ color: "#64748b", fontWeight: "400" }}
          >
            Daily Sales Report
          </p>
          <p
            className="text-xs mt-2"
            style={{ color: "#94a3b8" }}
            aria-label={`Report date: ${new Date(selectedDate).toLocaleDateString("th-TH")} from ${startTime} to ${endTime}`}
          >
            วันที่:{" "}
            {new Date(selectedDate).toLocaleDateString("th-TH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            | ช่วงเวลา: {startTime} - {endTime}
          </p>
        </div>

        {/* Summary Box */}
        <div className="print-summary-box">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "16px",
              fontSize: "11px",
            }}
          >
            <div>
              <div
                style={{
                  color: "#64748b",
                  marginBottom: "4px",
                  fontWeight: "500",
                }}
              >
                จำนวนบิล
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#1e293b",
                }}
              >
                {summary.count}
              </div>
            </div>
            <div>
              <div
                style={{
                  color: "#64748b",
                  marginBottom: "4px",
                  fontWeight: "500",
                }}
              >
                รายการสินค้า
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#1e293b",
                }}
              >
                {summary.totalItems}
              </div>
            </div>
            <div>
              <div
                style={{
                  color: "#64748b",
                  marginBottom: "4px",
                  fontWeight: "500",
                }}
              >
                ยอดขายรวม
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#2563eb",
                }}
              >
                ฿{(summary.totalSales + summary.totalDiscount).toLocaleString()}
              </div>
            </div>
            <div>
              <div
                style={{
                  color: "#64748b",
                  marginBottom: "4px",
                  fontWeight: "500",
                }}
              >
                ส่วนลด
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#dc2626",
                }}
              >
                -฿{summary.totalDiscount.toLocaleString()}
              </div>
            </div>
            <div
              style={{ borderLeft: "2px solid #cbd5e1", paddingLeft: "16px" }}
            >
              <div
                style={{
                  color: "#64748b",
                  marginBottom: "4px",
                  fontWeight: "500",
                }}
              >
                ยอดสุทธิ
              </div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "#059669",
                }}
              >
                ฿{summary.totalSales.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <table
          className="print-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "11px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #cbd5e1" }}>
              <th
                style={{ textAlign: "left", width: "60px", color: "#475569" }}
              >
                เวลา
              </th>
              <th
                style={{ textAlign: "left", width: "80px", color: "#475569" }}
              >
                เลขที่บิล
              </th>
              <th style={{ textAlign: "left", color: "#475569" }}>
                รายละเอียดสินค้า
              </th>
              <th
                style={{ textAlign: "right", width: "100px", color: "#475569" }}
              >
                ยอดสุทธิ
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td
                  style={{
                    verticalAlign: "top",
                    paddingTop: "12px",
                    color: "#64748b",
                    fontSize: "10px",
                  }}
                >
                  {order.timestamp.toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td style={{ verticalAlign: "top", paddingTop: "12px" }}>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "9px",
                      color: "#94a3b8",
                    }}
                  >
                    {order.id.slice(0, 8)}
                  </div>
                </td>
                <td style={{ paddingTop: "12px", paddingBottom: "12px" }}>
                  {order.items.map((item, i) => {
                    const normalTotal = (item.price || 0) * (item.qty || 0);
                    const finalTotal =
                      item.calculatedTotal !== undefined
                        ? Number(item.calculatedTotal)
                        : normalTotal;
                    const itemDiscount = normalTotal - finalTotal;

                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom:
                            i < order.items.length - 1 ? "10px" : "0",
                          paddingBottom:
                            i < order.items.length - 1 ? "10px" : "0",
                          borderBottom:
                            i < order.items.length - 1
                              ? "1px dashed #e2e8f0"
                              : "none",
                        }}
                      >
                        <div style={{ display: "flex", gap: "12px", flex: 1 }}>
                          {/* Barcode */}
                          <div style={{ width: "55px", flexShrink: 0 }}>
                            {item.barcode && item.barcode !== "-" ? (
                              <canvas
                                id={`barcode-${order.id}-${i}`}
                                className="print-barcode"
                                style={{ width: "100%", height: "22px" }}
                              ></canvas>
                            ) : (
                              <div
                                style={{
                                  fontSize: "8px",
                                  color: "#cbd5e1",
                                  fontFamily: "monospace",
                                  textAlign: "center",
                                  padding: "4px 0",
                                }}
                              >
                                {item.sku}
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontWeight: "600",
                                color: "#1e293b",
                                marginBottom: "3px",
                                fontSize: "11px",
                              }}
                            >
                              {item.name || item.ProductDesc || item.sku}
                            </div>
                            <div
                              style={{
                                fontSize: "9px",
                                color: "#64748b",
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                              }}
                            >
                              <span>จำนวน: {item.qty}</span>
                              <span>×</span>
                              <span>฿{(item.price || 0).toLocaleString()}</span>
                              {itemDiscount > 0 && (
                                <span
                                  style={{
                                    color: "#dc2626",
                                    background: "#fee2e2",
                                    padding: "2px 6px",
                                    borderRadius: "3px",
                                    fontSize: "8px",
                                    fontWeight: "600",
                                  }}
                                >
                                  ส่วนลด -฿{itemDiscount.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Item Total */}
                          <div
                            style={{
                              textAlign: "right",
                              fontWeight: "600",
                              color: "#334155",
                              fontSize: "11px",
                              minWidth: "70px",
                            }}
                          >
                            ฿{finalTotal.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </td>
                <td
                  style={{
                    verticalAlign: "top",
                    textAlign: "right",
                    paddingTop: "12px",
                    fontWeight: "700",
                    fontSize: "12px",
                    color: "#1e293b",
                  }}
                >
                  ฿{(order.summary?.subtotal || 0).toLocaleString()}
                  {order.status === "void" && (
                    <div
                      style={{
                        fontSize: "8px",
                        color: "#dc2626",
                        border: "1px solid #dc2626",
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        marginTop: "4px",
                        fontWeight: "600",
                      }}
                    >
                      VOID
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #cbd5e1" }}>
              <td
                colSpan="3"
                style={{
                  textAlign: "right",
                  padding: "10px 8px",
                  color: "#64748b",
                  fontSize: "11px",
                  fontWeight: "500",
                }}
              >
                ยอดรวมก่อนหักส่วนลด
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "10px 8px",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                ฿{(summary.totalSales + summary.totalDiscount).toLocaleString()}
              </td>
            </tr>
            <tr>
              <td
                colSpan="3"
                style={{
                  textAlign: "right",
                  padding: "8px",
                  color: "#dc2626",
                  fontSize: "11px",
                  fontWeight: "500",
                }}
              >
                หักส่วนลดทั้งหมด
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "8px",
                  color: "#dc2626",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                -฿{summary.totalDiscount.toLocaleString()}
              </td>
            </tr>
            <tr
              className="print-footer-total"
              style={{ borderTop: "2px solid #2563eb" }}
            >
              <td
                colSpan="3"
                style={{
                  textAlign: "right",
                  padding: "12px 8px",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#1e293b",
                }}
              >
                ยอดขายสุทธิทั้งสิ้น (Grand Total)
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "12px 8px",
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#059669",
                }}
              >
                ฿{summary.totalSales.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div
          style={{
            marginTop: "30px",
            paddingTop: "15px",
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
            fontSize: "9px",
            color: "#94a3b8",
          }}
        >
          <div>Boots POS System | Store 4340</div>
          <div style={{ marginTop: "4px" }}>
            พิมพ์เมื่อ:{" "}
            {new Date().toLocaleString("th-TH", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
    </>
  );
}
