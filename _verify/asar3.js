
const fs=require('fs');
const s=fs.readFileSync('D:\\ProfessionalSoftware\\agent\\dsh\\dsh\\resources\\app.asar').toString('latin1');
const i=s.indexOf('{key:`shell.overlay`');
console.log('idx', i);
console.log(s.slice(i, i+2200).replace(/[^\x09\x0a\x20-\x7e]/g,' '));
