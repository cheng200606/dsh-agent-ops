
const fs=require('fs');
const buf=fs.readFileSync('D:\\ProfessionalSoftware\\agent\\dsh\\dsh\\resources\\app.asar');
const s=buf.toString('latin1');
for (const needle of ['shell.overlay','shell.bottom','shell.leading']) {
  let i=-1, n=0, first=null;
  while ((i=s.indexOf(needle,i+1))!==-1 && n<4) { n++; if(first===null) first=i; }
  console.log(needle+' count='+n);
}
// look for slot registration patterns near shell.overlay
const idx=s.indexOf("name:'shell.overlay'");
console.log("name:'shell.overlay' at", idx);
if(idx>0) console.log(s.slice(idx-400, idx+400).replace(/[^\x20-\x7e]/g,' '));
