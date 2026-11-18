
const fs=require('fs');
const s=fs.readFileSync('D:\\ProfessionalSoftware\\agent\\dsh\\dsh\\resources\\app.asar').toString('latin1');
for (const needle of ['locale.register(','bind(namespace','locale.bind']) {
  const idx=[]; let i=-1;
  while((i=s.indexOf(needle,i+1))!==-1 && idx.length<3) idx.push(i);
  console.log('### '+needle+' hits='+idx.length);
  for(const j of idx) console.log(s.slice(Math.max(0,j-300), j+300).replace(/[^\x09\x0a\x20-\x7e]/g,' '), '\n---');
}
