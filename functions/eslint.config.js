const globals = require("globals");
const js = require("@eslint/js");

module.exports = [
  {
    ignores: ["node_modules/**", "lib/**", ".eslintrc.cjs"],
  },
  {
    // CJS files in root
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        "require": "readonly",
        "module": "readonly",
        "exports": "writable"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-empty": "warn",
      "no-undef": "error"
    }
  },
  {
    // ESM files in src
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    }
  }
];
