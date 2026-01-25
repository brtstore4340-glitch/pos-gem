import React, { useState } from "react";
import ReceiptModal from "./ReceiptModal";
import ProductLookupModal from "./ProductLookupModal";
import DailyReportModal from "./DailyReportModal";

const PosTabContent = () => {
  const [lastOrder, setLastOrder] = useState(null);
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [showReport, setShowReport] = useState(false);

  return (
    <div className="h-full w-full bg-slate-100 p-4 font-sans flex gap-4 overflow-hidden">
      {lastOrder && (
        <ReceiptModal order={lastOrder} onClose={() => setLastOrder(null)} />
      )}
      {showProductLookup && (
        <ProductLookupModal onClose={() => setShowProductLookup(false)} />
      )}
      {showReport && <DailyReportModal onClose={() => setShowReport(false)} />}

      <div className="flex flex-col items-center justify-center w-full h-full text-slate-500">
        <p className="text-lg font-semibold">POS workspace</p>
        <p className="text-sm">Add the full tab experience here.</p>
      </div>
    </div>
  );
};

export default PosTabContent;
