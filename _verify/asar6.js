
const fs=require('fs');
const s=fs.readFileSync('D:\\ProfessionalSoftware\\agent\\dsh\\dsh\\resources\\app.asar').toString('latin1');
for (const key of ['conversation.session.header.actions','shell.overlay']) {
  const i=s.indexOf('{key:`'+key+'`');
  const seg=s.slice(i, i+3000);
  const m=seg.match(/standardProps:\[((?:[^\]\\]|\\.)*)\]/);
  const has=seg.includes('useProjection');
  console.log(key+' hasUseProjection='+has);
  if(m) console.log('  props snippet:', m[1].replace(/`/g,'').split(',').filter(x=>/useProjection|sessionId|useChat/.test(x)).join(' | '));
}
