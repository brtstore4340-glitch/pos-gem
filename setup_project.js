// file: setup_project.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 Starting Project Restoration...");

// 1. Define Helper to write files ensuring directories exist
const writeFile = (filePath, content) => {
  const absolutePath = path.join(__dirname, filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }

  fs.writeFileSync(absolutePath, content.trim(), "utf8");
  console.log(`✅ Created/Updated: ${filePath}`);
};

// 2. Define File Contents
const files = {
  // --- Configs ---
  "vite.config.js": `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
  "tailwind.config.js": `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'Inter', 'sans-serif'],
      },
      colors: {
        google: {
          blue: '#1a73e8',
          'blue-hover': '#1557b0',
          'blue-light': '#e8f0fe',
          gray: '#f1f3f4',
          text: '#202124',
          subtext: '#5f6368',
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
`,
  "postcss.config.js": `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
  // --- Entry Points ---
  "index.html": `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>POS System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  "src/main.jsx": `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
  "src/App.jsx": `
import React from 'react'
import DemoUI from './components/DemoUI'

function App() {
  return (
    <div>
      <DemoUI />
    </div>
  )
}

export default App
`,
  // --- Styles ---
  "src/index.css": `
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
    @apply bg-google-blue text-white px-4 py-2 rounded-lg 
           hover:bg-google-blue-hover transition-all duration-200 
           shadow-sm hover:shadow-md active:scale-95 font-medium;
  }

  .btn-ghost {
    @apply bg-transparent text-google-blue hover:bg-google-blue-light 
           px-4 py-2 rounded-lg transition-all duration-200;
  }
}
`,
  // --- Components & Utils ---
  "src/utils/cn.js": `
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
`,
  "src/components/DemoUI.jsx": `
import React from 'react';
import { ShoppingCart, Search, Menu } from 'lucide-react';
import { cn } from '../utils/cn';

export default function DemoUI() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-google-text">
            รายการขาย
          </h1>
          <button className="btn-ghost p-2">
            <Menu size={20} />
          </button>
        </div>

        {/* Input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-google-subtext" size={18} />
          <input 
            type="text" 
            placeholder="สแกนบาร์โค้ด หรือค้นหา..." 
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-google-gray border-none focus:ring-2 focus:ring-google-blue/50 outline-none transition-all"
          />
        </div>

        {/* List Item */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between p-3 rounded-lg hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-google-blue-light">
            <div>
              <div className="font-medium">น้ำดื่มตราสิงห์ 600ml</div>
              <div className="text-sm text-google-subtext">x 2</div>
            </div>
            <div className="font-semibold text-google-blue">฿14.00</div>
          </div>
        </div>

        {/* Button */}
        <button className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-lg">
          <ShoppingCart size={20} />
          ชำระเงิน (฿14.00)
        </button>

      </div>
    </div>
  );
}
`,
};

// 3. Execution Loop
Object.entries(files).forEach(([name, content]) => {
  try {
    writeFile(name, content);
  } catch (e) {
    console.error(`❌ Error writing ${name}:`, e);
  }
});

console.log("\n✨ Restoration Complete! Now run: npm run dev");
