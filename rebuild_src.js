// file: rebuild_src.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.join(__dirname, 'src');

console.log("🧹 Cleaning old src folder...");
if (fs.existsSync(srcPath)) {
    fs.rmSync(srcPath, { recursive: true, force: true });
}
fs.mkdirSync(srcPath);
fs.mkdirSync(path.join(srcPath, 'components'));
fs.mkdirSync(path.join(srcPath, 'utils'));

console.log("🏗️ Rebuilding files...");

// 1. main.jsx
fs.writeFileSync(path.join(srcPath, 'main.jsx'), `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`.trim());

// 2. App.jsx (ระบุ .jsx ใน import ให้ชัดเจนเพื่อกันพลาด)
fs.writeFileSync(path.join(srcPath, 'App.jsx'), `
import React from 'react'
import DemoUI from './components/DemoUI.jsx'

function App() {
  return (
    <div>
      <DemoUI />
    </div>
  )
}

export default App`.trim());

// 3. index.css
fs.writeFileSync(path.join(srcPath, 'index.css'), `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Noto+Sans+Thai:wght@300;400;500;600&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply font-sans text-google-text bg-slate-50 antialiased;
  }
}
@layer components {
  .glass-panel {
    @apply bg-white/70 backdrop-blur-md border border-white/20 shadow-sm;
  }
  .btn-primary {
    @apply bg-google-blue text-white px-4 py-2 rounded-lg hover:bg-google-blue-hover transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 font-medium;
  }
  .btn-ghost {
    @apply bg-transparent text-google-blue hover:bg-google-blue-light px-4 py-2 rounded-lg transition-all duration-200;
  }
}`.trim());

// 4. utils/cn.js
fs.writeFileSync(path.join(srcPath, 'utils', 'cn.js'), `
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}`.trim());

// 5. components/DemoUI.jsx
fs.writeFileSync(path.join(srcPath, 'components', 'DemoUI.jsx'), `
import React from 'react';
import { ShoppingCart, Search, Menu } from 'lucide-react';
import { cn } from '../utils/cn';

export default function DemoUI() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-google-text">รายการขาย</h1>
          <button className="btn-ghost p-2"><Menu size={20} /></button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-google-subtext" size={18} />
          <input type="text" placeholder="Scan..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-google-gray border-none focus:ring-2 focus:ring-google-blue/50 outline-none" />
        </div>
        <div className="space-y-3 mb-6">
          <div className="flex justify-between p-3 rounded-lg hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-google-blue-light">
            <div><div className="font-medium">Singha Water</div><div className="text-sm text-google-subtext">x 2</div></div>
            <div className="font-semibold text-google-blue">฿14.00</div>
          </div>
        </div>
        <button className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-lg">
          <ShoppingCart size={20} /> Checkout (฿14.00)
        </button>
      </div>
    </div>
  );
}`.trim());

// --- Verification Step ---
console.log("🔍 Verifying files...");
const requiredFiles = [
    'main.jsx',
    'App.jsx',
    'index.css',
    'utils/cn.js',
    'components/DemoUI.jsx'
];

let hasError = false;
requiredFiles.forEach(f => {
    if (fs.existsSync(path.join(srcPath, f))) {
        console.log(`✅ Found: src/${f}`);
    } else {
        console.error(`❌ MISSING: src/${f}`);
        hasError = true;
    }
});

if (!hasError) {
    console.log("\n✨ Success! All files are in place. Now run: npm run dev");
} else {
    console.log("\n⚠️ Some files are missing. Please check permissions.");
}