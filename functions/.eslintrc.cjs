module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  extends: ["eslint:recommended"],
  ignorePatterns: ["node_modules/**"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script"
  },
  rules: {
    // Allow legacy CommonJS (require/module/exports) without no-undef
    "no-undef": "error",

    // Legacy code usually triggers these; keep signal but do not block deploy
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "no-empty": "warn"
  }
};
