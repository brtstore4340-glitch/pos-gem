import { X, Printer, CheckCircle } from 'lucide-react';

export default function ReceiptModal({ order, onClose }) {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-area, #receipt-area * { visibility: visible !important; }
          #receipt-area { 
            position: absolute !important; top: 0 !important; left: 0 !important; 
            width: 100% !important; height: auto !important; 
            background: white !important; display: block !important; padding: 20px; 
          }
          .fixed.inset-0 { background: none !important; backdrop-filter: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="bg-white w-full max-w-[380px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Actions (Non-printable) */}
        <div className="bg-slate-100 p-3 flex justify-between items-center border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
            <CheckCircle size={16} /> บันทึกสำเร็จ
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600" title="Print"><Printer size={18} /></button>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600" title="Close"><X size={18} /></button>
          </div>
        </div>

        {/* Receipt Content (Printable Area) */}
        <div className="p-6 overflow-y-auto font-mono text-sm bg-white" id="receipt-area">
          
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <img src="https://store.boots.co.th/images/boots-logo.png" alt="Boots" className="h-6 mx-auto mb-2 grayscale opacity-80" />
            <div className="font-bold text-lg text-slate-800">BOOTS RETAIL (THAILAND)</div>
            <div className="text-xs text-slate-500">TAX ID: 0105548105xxx</div>
            <div className="text-xs text-slate-500">Grand 5 Sukhumvit</div>
            <div className="text-xs text-slate-500 mt-2">POS ID: #01 &bull; CASHIER: STAFF</div>
            <div className="text-xs text-slate-400 mt-1">{new Date().toLocaleString('th-TH')}</div>
          </div>

          {/* Divider */}
          <div className="border-b border-dashed border-slate-300 my-4"></div>

          {/* Items */}
          <div className="space-y-2 mb-4">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <div className="text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.qty} x {item.price.toLocaleString()}</div>
                </div>
                <div className="text-slate-800 font-medium">
                  {(item.price * item.qty).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-b border-dashed border-slate-300 my-4"></div>

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-500 text-xs">
              <span>Subtotal (Excl. VAT)</span>
              <span>{(order.summary.subtotal / 1.07).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-xs">
              <span>VAT (7%)</span>
              <span>{(order.summary.subtotal - (order.summary.subtotal / 1.07)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>

            {/* Discount Breakdown */}
            {order.adjustments?.coupons?.length > 0 && (
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Coupons</span>
                <span className="text-red-600">-{order.adjustments.coupons.reduce((a,c)=>a+c.couponValue,0).toLocaleString()}</span>
              </div>
            )}
            {order.adjustments?.allowance > 0 && (
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Allowance</span>
                <span className="text-red-600">-{Number(order.adjustments.allowance).toLocaleString()}</span>
              </div>
            )}
            {order.adjustments?.topup > 0 && (
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Topup Discount</span>
                <span className="text-red-600">-{Number(order.adjustments.topup).toLocaleString()}</span>
              </div>
            )}
            {order.adjustments?.billDiscount?.amount > 0 && (
               <div className="flex justify-between text-slate-500 text-xs">
                <span>Bill Discount ({order.adjustments.billDiscount.percent}%)</span>
                <span className="text-red-600">-{Number(order.adjustments.billDiscount.amount).toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-800 font-bold text-lg mt-2">
              <span>TOTAL (Net)</span>
              <span>฿{(order.summary.netTotal || order.summary.subtotal).toLocaleString()}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-slate-400">
            <div>THANK YOU FOR SHOPPING WITH US</div>
            <div className="mt-1">** www.boots.co.th **</div>
            <div className="mt-4 barcode font-serif tracking-widest text-slate-300">
              ||| || ||| || ||| |||| ||
            </div>
          </div>

        </div>

        {/* Footer Action (Non-printable) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 print:hidden">
          <button onClick={onClose} className="w-full bg-slate-800 text-white py-3 rounded-lg font-medium hover:bg-slate-700 transition-colors">
            New Transaction (Enter)
          </button>
        </div>

      </div>
    </div>
    </>
  );
}

