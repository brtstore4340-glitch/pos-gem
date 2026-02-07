#!/usr/bin/env node

/**
 * Project helper entrypoint.
 *
 * Usage:
 *   node index.js
 */

const commands = [
  { name: 'dev', description: 'Start the Vite development server.' },
  { name: 'build', description: 'Create a production build.' },
  { name: 'preview', description: 'Preview the production build locally.' },
  { name: 'lint', description: 'Run ESLint checks.' },
];

function printHelp() {
  console.log('boots-pos-gemini');
  console.log('Available npm scripts:');

  for (const command of commands) {
    console.log(`  - npm run ${command.name.padEnd(7)} ${command.description}`);
  }
}

printHelp();
