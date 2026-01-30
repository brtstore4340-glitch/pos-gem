import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  
  
  {
    // Node/CommonJS files: allow require/module/exports/process
    files: [
      "**/vite.config.js",
      "**/tailwind.config.js",
      "**/*.config.js",
      "pos-gem/functions/**/*.js",
      "pos-gem/functions/src/**/*.js",
      "shared/**/*.js"
    ],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        process: "readonly"
      }
    }
  },
{
    // Ignore generated / vendor / backup snapshots (not source-of-truth)
    ignores: [
      "**/.backup-*/**",
      "**/.backup-eslint-*/**",
      "**/.backup-eslint-fix*/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      // Vendor/minified legacy files (eslint explodes on them)
      "src/toggle/**",
      "src/toggle/jquery.js"
    ],
  },
{ ignores: ['dist', 'node_modules', '.backup-eslint-parsing-*', 'boots-grab-print', 'functions', '.firebase', '**/*.min.*'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // ✅ เป้าหมาย: เอา warnings ออกทั้งหมด (ตามที่คุณขอ)
      'no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
