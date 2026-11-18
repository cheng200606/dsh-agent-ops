
const fs=require('fs');
const s=fs.readFileSync('D:\\ProfessionalSoftware\\agent\\dsh\\dsh\\resources\\app.asar').toString('latin1');
for (const key of ['sidebar.right.pane.tab']) {
  const i=s.indexOf('{key:`'+key+'`');
  if(i<0){console.log('miss',key);continue;}
  const seg=s.slice(i, i+1400).replace(/[^\x09\x0a\x20-\x7e]/g,' ');
  console.log('=== '+key+' ===');
  console.log(seg);
}
// which slots declare useProjection in standardProps
const marks=[...s.matchAll(/standardProps:\[`([^`]*useProjection[^`]*)`/g)];
console.log('slots declaring useProjection:', marks.length);
const idxs=[...s.matchAll(/\{key:`([a-zA-Z0-9_.\-]+)`/g)];
let count=0;
for(const m of idxs){ const start=m.index; const seg=s.slice(start, start+1600);
  if(seg.includes('useProjection')) { console.log('  ->', m[1]); count++; if(count>15) break; } }
