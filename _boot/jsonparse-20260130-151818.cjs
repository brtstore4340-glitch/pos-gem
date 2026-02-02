const fs = require('fs');
const p = process.argv[2];
const s = fs.readFileSync(p,'utf8');
try { JSON.parse(s); console.log('OK'); }
catch(e){
  console.log('FAIL');
  console.log(String(e.message));
  const m=/position (\d+)/.exec(String(e.message));
  if(m){ console.log('POS=' + m[1]); }
  process.exit(1);
}
