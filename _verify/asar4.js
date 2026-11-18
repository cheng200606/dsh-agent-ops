
const fs=require('fs');
const s=fs.readFileSync('D:\\ProfessionalSoftware\\agent\\dsh\\dsh\\resources\\app.asar').toString('latin1');
let idx=[], i=-1;
while((i=s.indexOf('useProjection', i+1))!==-1) idx.push(i);
console.log('useProjection occurrences', idx.length);
for (const j of idx.slice(0,6)) {
  console.log('--- '+j+' ---');
  console.log(s.slice(Math.max(0,j-450), j+250).replace(/[^\x09\x0a\x20-\x7e]/g,' '));
}
