// 校验 renzi-data.js：格式、字词匹配、跨段重复
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'renzi-data.js'), 'utf8');
const window = {};
eval(src);
const bands = window.RENZI_BANDS;
const seen = new Map();
let bad = [], dup = [], total = 0;
for (const b of bands) {
  for (const entry of b.chars) {
    total++;
    const parts = entry.split(' ');
    const [ch, py, word] = parts;
    if (parts.length !== 3 || !ch || ch.length !== 1 || !py || py.includes('…') || !word || word.includes('…')) {
      bad.push(`[${b.id}] ${entry}`);
      continue;
    }
    if (!word.includes(ch)) bad.push(`[${b.id}] 词不含字: ${entry}`);
    if (seen.has(ch)) dup.push(`${ch}: ${seen.get(ch)} 与 ${b.id}`);
    else seen.set(ch, b.id);
  }
}
console.log(`总条数: ${total}, 唯一字数: ${seen.size}`);
for (const b of bands) console.log(`  ${b.id} ${b.grade}: ${b.chars.length}`);
if (bad.length) { console.log(`\n格式问题 ${bad.length}:`); bad.forEach(x => console.log('  ' + x)); }
if (dup.length) { console.log(`\n重复字 ${dup.length}:`); dup.forEach(x => console.log('  ' + x)); }
if (!bad.length && !dup.length) console.log('\n全部通过 ✓');
