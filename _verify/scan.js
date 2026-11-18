
const fs=require('fs'); const zlib=require('zlib'); const path=require('path');
const dir='C:\\Users\\Lenovo\\.dsh\\sessions\\--D-ProfessionalSoftware-Project-dsh-bots--';
for (const name of fs.readdirSync(dir)) {
  const p=path.join(dir,name,'session.v4.jsonl.zstd');
  if(!fs.existsSync(p)) continue;
  try{
    const buf=zlib.zstdDecompressSync(fs.readFileSync(p));
    const txt=buf.toString('utf8');
    const asked=(txt.match(/approval\/asked/g)||[]).length;
    const decided=(txt.match(/approval\/decided/g)||[]).length;
    const fenced=(txt.match(/AGENT_OPS_FENCED/g)||[]).length;
    const tools=(txt.match(/"type":"tool\/call"/g)||[]).length;
    console.log(name+'|asked='+asked+'|decided='+decided+'|fenced='+fenced+'|toolcall='+tools+'|bytes='+txt.length);
  }catch(e){ console.log(name+'|ERR '+e.message); }
}
