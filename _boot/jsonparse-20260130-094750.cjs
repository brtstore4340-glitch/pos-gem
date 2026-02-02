const fs = require('fs');
const p = process.argv[2];
const s = fs.readFileSync(p,'utf8');
try {
  JSON.parse(s);
  console.log('OK: JSON.parse succeeded');
} catch (e) {
  console.log('FAIL: JSON.parse failed');
  console.log(String(e.message));
  const m = /position (\d+)/.exec(String(e.message));
  if (m) {
    const pos = Number(m[1]);
    console.log('POS=' + pos);
    const start = Math.max(0, pos - 120);
    const end = Math.min(s.length, pos + 120);
    console.log('CONTEXT_START=' + start);
    console.log('CONTEXT_END=' + end);
    console.log(s.slice(start, end).replace(/\r/g,'').replace(/\n/g,'\\n'));
  }
  process.exit(1);
}
