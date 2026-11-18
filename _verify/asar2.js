
const fs=require('fs');
const buf=fs.readFileSync('D:\\ProfessionalSoftware\\agent\\dsh\\dsh\\resources\\app.asar');
const s=buf.toString('latin1');
let i=-1;
while((i=s.indexOf('shell.overlay', i+1))!==-1){
  console.log('=== at '+i+' ===');
  console.log(s.slice(Math.max(0,i-700), i+500).replace(/[^\x09\x0a\x20-\x7e]/g,' '));
}
