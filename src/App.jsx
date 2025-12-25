import React, { useState } from 'react';
import PosUI from './components/DemoUI';
import AdminSettings from './components/AdminSettings';

function App() {
  const [view, setView] = useState('pos'); // 'pos' | 'admin'

  return (
    <div>
      {view === 'pos' ? (
        <div className="relative">
          <PosUI onAdminSettings={() => setView('admin')} />
        </div>
      ) : (
        <AdminSettings onBack={() => setView('pos')} />
      )}
    </div>
  )
}

export default App
