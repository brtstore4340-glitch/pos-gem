const path = require('path');
const { pathToFileURL } = require('url');

const entry = process.argv[2];
const timeoutMs = Number(process.argv[3] || 10000);

console.log('[load-test] entry=', entry);
console.log('[load-test] timeoutMs=', timeoutMs);

const start = Date.now();
let fired = false;

function done(code, msg) {
  if (fired) return;
  fired = true;
  const dur = Date.now() - start;
  console.log('[load-test] durationMs=', dur);
  if (msg) console.log(msg);
  process.exit(code);
}

setTimeout(() => done(124, '[load-test] TIMEOUT importing entry'), timeoutMs);

(async () => {
  try {
    // Always use file URL to avoid path issues
    const url = pathToFileURL(path.resolve(entry)).href;
    await import(url);
    done(0, '[load-test] OK imported');
  } catch (e) {
    console.error('[load-test] IMPORT ERROR');
    console.error(e && e.stack ? e.stack : e);
    done(2, '[load-test] FAILED import');
  }
})();
