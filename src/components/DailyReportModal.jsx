import React, { useState, useEffect } from 'react';
import { X, Calendar, Printer, Search, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { posService } from '../services/posService';
import { cn } from '../utils/cn';
import JsBarcode from 'jsbarcode';

export default function DailyReportModal({ onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [summary, setSummary] = useState({ totalSales: 0, totalVoid: 0, count: 0, totalItems: 0, totalDiscount: 0 });

  // Filter States (Default to Today)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');

  useEffect(() => { loadData(); }, []);

  // Generate barcodes
  useEffect(() => {
    if (orders.length > 0) {
      orders.forEach((order) => {
        order.items?.forEach((item, index) => {
          try {
            const barcodeValue = item.barcode || item.sku || 'N/A';
            if (barcodeValue && barcodeValue !== 'N/A') {
              const canvas = document.getElementById(`barcode-${order.id}-${index}`);
              if (canvas) {
                JsBarcode(canvas, barcodeValue, {
                  format: 'CODE128', width: 1, height: 20, displayValue: false, margin: 0
                });
              }
            }
          } catch (err) { console.error('Barcode error:', err); }
        });
      });
    }
  }, [orders]);

  const loadData = async () => {
    setLoading(true);
    setExpandedRow(null);
    try {
        const start = new Date(`${selectedDate}T${startTime}:00`);
        const end = new Date(`${selectedDate}T${endTime}:59`);
        const data = await posService.getSalesReport(start, end);
        setOrders(data || []);
        
        // --- Calculate Summary ---
        const validOrders = (data || []).filter(o => o.status !== 'void');
        const totalSales = validOrders.reduce((sum, o) => sum + (Number(o.summary?.subtotal) || 0), 0);
        const totalItems = validOrders.reduce((sum, o) => sum + (Number(o.summary?.totalItems) || 0), 0);
        
        const totalDiscount = validOrders.reduce((sum, o) => {
            const billDiscount = o.items?.reduce((isum, item) => {
                const price = Number(item.price) || 0;
                const qty = Number(item.qty) || 0;
                const normalTotal = price * qty;
                const soldTotal = (item.calculatedTotal !== undefined) ? Number(item.calculatedTotal) : normalTotal;
                return isum + (normalTotal - soldTotal);
            }, 0) || 0;
            return sum + billDiscount + (Number(o.summary?.discount) || 0);
        }, 0);
        
        setSummary({ totalSales, totalVoid: 0, count: validOrders.length, totalItems, totalDiscount });
    } catch (err) { console.error("Report Error:", err); } finally { setLoading(false); }
  };

  const handleVoid = async (orderId) => {
    if (!window.confirm('ยืนยันการยกเลิกบิลนี้?')) return;
    try { await posService.voidInvoice(orderId, 'User Cancelled'); loadData(); } catch (e) { alert(e.message); }
  };

  const toggleRow = (id) => { setExpandedRow(expandedRow === id ? null : id); };
  const handlePrint = () => { window.print(); };

  return (
    <>
      {/* 🟢 PRINT STYLING & FONT */}
      <style>{`
        #print-section { display: none; }
        @media print {
          @page { margin: 0.5cm; size: A4 portrait; }
          body * { visibility: hidden; }
          #print-section, #print-section * { 
            visibility: visible !important; 
            color: black !important;
            font-family: 'Kanit', sans-serif !important;
          }
          #print-section { 
            display: block !important; 
            position: fixed; left: 0; top: 0; width: 100%; height: 100%; 
            background: white !important; z-index: 99999; 
          }
          .modal-overlay { display: none !important; }
        }
      `}</style>

      {/* --- SCREEN VIEW --- */}
      <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden font-sans">
        <div className="bg-white w-[95vw] h-[95vh] max-w-7xl rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
          
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 shrink-0">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-800 rounded-xl"><Calendar size={28} /></div>
                <div><h2 className="text-2xl font-bold font-kanit">รายงานยอดขาย</h2><p className="text-slate-400 text-sm">Summary Sales Report</p></div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full"><X size={24} /></button>
            </div>

            {/* Filters */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
               <div className="flex flex-wrap items-end gap-4">
                   <div>
                       <label className="text-xs text-slate-400 mb-1 block font-bold">วันที่ (Date)</label>
                       <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm h-10"/>
                   </div>
                   <div>
                       <label className="text-xs text-slate-400 mb-1 block font-bold">เริ่ม (Start)</label>
                       <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm h-10"/>
                   </div>
                   <div>
                       <label className="text-xs text-slate-400 mb-1 block font-bold">ถึง (End)</label>
                       <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm h-10"/>
                   </div>
                   <button onClick={loadData} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white px-6 h-10 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                       {loading ? '...' : <><Search size={16} /> ค้นหา</>}
                   </button>
                   <div className="flex-1 text-right">
                       <button onClick={handlePrint} disabled={orders.length === 0} className="bg-white text-slate-900 hover:bg-slate-100 border border-slate-200 px-6 h-10 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition-all shadow-sm">
                           <Printer size={16} /> พิมพ์รายงาน
                       </button>
                   </div>
               </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 bg-slate-50 border-b border-slate-200 shrink-0">
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-xs font-bold mb-1">จำนวนบิล</div><div className="text-2xl font-bold text-slate-800">{summary.count}</div></div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-xs font-bold mb-1">รายการขาย</div><div className="text-2xl font-bold text-slate-800">{summary.totalItems}</div></div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-xs font-bold mb-1">ยอดขายรวม</div><div className="text-2xl font-bold text-blue-600">฿{(summary.totalSales + summary.totalDiscount).toLocaleString()}</div></div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="text-slate-500 text-xs font-bold mb-1">ส่วนลดรวม</div><div className="text-2xl font-bold text-red-500">-฿{summary.totalDiscount.toLocaleString()}</div></div>
             <div className="bg-white p-4 rounded-xl border border-green-200 bg-green-50 shadow-sm"><div className="text-green-700 text-xs font-bold mb-1">ยอดสุทธิ (Net)</div><div className="text-2xl font-bold text-green-700">฿{summary.totalSales.toLocaleString()}</div></div>
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
                        <tr className={cn("hover:bg-slate-50 cursor-pointer transition-colors", expandedRow === order.id && "bg-blue-50/50")} onClick={() => toggleRow(order.id)}>
                          <td className="p-4 text-center">{expandedRow === order.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</td>
                          <td className="p-4 text-slate-600">{order.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="p-4 font-mono font-medium">{order.id.slice(0, 8)}...</td>
                          <td className="p-4 text-center"><span className="bg-slate-100 px-2 py-1 rounded-full text-xs font-bold">{order.summary?.totalItems}</span></td>
                          <td className="p-4 text-right font-bold text-slate-800">฿{(order.summary?.subtotal || 0).toLocaleString()}</td>
                          <td className="p-4 text-center">{order.status === 'void' ? <span className="text-red-600 font-bold text-xs bg-red-100 px-2 py-1 rounded">ยกเลิก</span> : <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded">สำเร็จ</span>}</td>
                          <td className="p-4 text-center">{order.status !== 'void' && <button onClick={(e) => { e.stopPropagation(); handleVoid(order.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>}</td>
                        </tr>
                        {expandedRow === order.id && (
                          <tr>
                            <td colSpan="7" className="p-0">
                              <div className="bg-slate-50 p-4 border-b border-slate-100 shadow-inner">
                                <div className="bg-white rounded border border-slate-200 overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                      <tr>
                                        <th className="p-2 text-left w-32">รหัสสินค้า</th>
                                        <th className="p-2 text-left w-32">บาร์โค้ด</th>
                                        <th className="p-2 text-left">ชื่อสินค้า</th>
                                        <th className="p-2 text-right">ราคา</th>
                                        <th className="p-2 text-center">จำนวน</th>
                                        <th className="p-2 text-right text-red-500">ส่วนลด</th>
                                        <th className="p-2 text-right">รวม</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {order.items?.map((item, i) => {
                                         const normalTotal = (item.price * item.qty);
                                         const finalTotal = item.calculatedTotal !== undefined ? item.calculatedTotal : normalTotal;
                                         const discount = normalTotal - finalTotal;
                                         return (
                                            <tr key={i} className="hover:bg-slate-50">
                                              <td className="p-2 font-mono text-slate-500">{item.sku}</td>
                                              <td className="p-2 font-mono text-slate-500">{item.barcode || '-'}</td>
                                              <td className="p-2 font-medium">{item.name}</td>
                                              <td className="p-2 text-right">{(item.price || 0).toLocaleString()}</td>
                                              <td className="p-2 text-center font-bold">{item.qty}</td>
                                              <td className="p-2 text-right text-red-500">{discount > 0 ? `-${discount.toLocaleString()}` : '-'}</td>
                                              <td className="p-2 text-right font-bold">{finalTotal.toLocaleString()}</td>
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

      {/* --- PRINT LAYOUT (MODERN MINIMAL) --- */}
      <div id="print-section">
         <div className="text-center mb-6 pb-4 border-b border-black">
            <h1 className="text-2xl font-bold mb-1 tracking-tight">รายงานสรุปยอดขาย (Daily Sales Report)</h1>
            <p className="text-sm text-gray-600">วันที่: {new Date(selectedDate).toLocaleDateString('th-TH')} | ช่วงเวลา: {startTime} - {endTime}</p>
         </div>

         {/* Print Summary Box */}
         <div className="flex justify-between items-center mb-6 border border-gray-300 rounded-lg p-3 bg-gray-50 text-sm">
            <div><strong>บิลทั้งหมด:</strong> {summary.count}</div>
            <div><strong>จำนวนชิ้น:</strong> {summary.totalItems}</div>
            <div><strong>ยอดรวม:</strong> ฿{(summary.totalSales + summary.totalDiscount).toLocaleString()}</div>
            <div className="text-red-600"><strong>ส่วนลด:</strong> -฿{summary.totalDiscount.toLocaleString()}</div>
            <div className="font-bold text-lg"><strong>สุทธิ:</strong> ฿{summary.totalSales.toLocaleString()}</div>
         </div>

         <table className="w-full text-xs border-collapse">
            <thead>
               <tr className="border-b-2 border-black text-gray-700">
                  <th className="text-left p-2 w-16">เวลา</th>
                  <th className="text-left p-2 w-24">เลขที่บิล</th>
                  <th className="text-left p-2">รายละเอียดสินค้า</th>
                  <th className="text-right p-2 w-24">ยอดรวม (Net)</th>
               </tr>
            </thead>
            <tbody>
               {orders.map((order) => (
                   <tr key={order.id} className="border-b border-gray-200">
                      <td className="p-2 align-top text-gray-500 pt-3">{order.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-2 align-top font-mono text-[10px] text-gray-500 pt-3">{order.id.slice(0, 8)}</td>
                      <td className="p-2 pt-3">
                          {order.items.map((item, i) => {
                             const normalTotal = (item.price || 0) * (item.qty || 0);
                             const finalTotal = item.calculatedTotal !== undefined ? Number(item.calculatedTotal) : normalTotal;
                             const itemDiscount = normalTotal - finalTotal;

                             return (
                                <div key={i} className="mb-3 flex items-start justify-between group">
                                   <div className="flex gap-3">
                                      <div className="w-[50px] flex-shrink-0">
                                         {(item.barcode && item.barcode !== '-') ? (
                                           <canvas id={`barcode-${order.id}-${i}`} className="w-full h-[20px] opacity-80"></canvas>
                                         ) : (
                                           <div className="text-[9px] text-gray-300 font-mono">{item.sku}</div>
                                         )}
                                      </div>
                                      <div>
                                         <div className="font-bold text-sm text-black">{item.name}</div>
                                         <div className="text-gray-500 text-[10px]">
                                            {item.qty} x ฿{(item.price || 0).toLocaleString()}
                                            {itemDiscount > 0 && <span className="text-red-600 ml-2 bg-red-50 px-1 rounded">ส่วนลด -฿{itemDiscount.toLocaleString()}</span>}
                                         </div>
                                      </div>
                                   </div>
                                   <div className="text-right font-medium">
                                       ฿{finalTotal.toLocaleString()}
                                   </div>
                                </div>
                             );
                          })}
                      </td>
                      <td className="p-2 align-top text-right font-bold pt-3 text-sm">
                          ฿{(order.summary?.subtotal || 0).toLocaleString()}
                          {order.status === 'void' && <div className="text-red-600 text-[10px] border border-red-600 inline-block px-1 rounded mt-1">VOID</div>}
                      </td>
                   </tr>
               ))}
            </tbody>
            <tfoot>
               <tr className="border-t-2 border-black">
                  <td colSpan="3" className="p-2 text-right text-gray-600">ยอดรวมก่อนส่วนลด</td>
                  <td className="p-2 text-right">฿{(summary.totalSales + summary.totalDiscount).toLocaleString()}</td>
               </tr>
               <tr>
                  <td colSpan="3" className="p-2 text-right text-red-600">ส่วนลดท้ายบิล/รายการ</td>
                  <td className="p-2 text-right text-red-600">-฿{summary.totalDiscount.toLocaleString()}</td>
               </tr>
               <tr className="bg-gray-100 font-bold text-base">
                  <td colSpan="3" className="p-3 text-right">ยอดขายสุทธิ (Grand Total)</td>
                  <td className="p-3 text-right">฿{summary.totalSales.toLocaleString()}</td>
               </tr>
            </tfoot>
         </table>
         <div className="mt-8 text-center text-[10px] text-gray-400">Software by Store 4340 | Printed at {new Date().toLocaleString('th-TH')}</div>
      </div>
    </>
  );
}
