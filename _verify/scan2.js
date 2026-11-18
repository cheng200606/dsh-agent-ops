
const fs=require('fs'); const zlib=require('zlib');
const p='C:\\Users\\Lenovo\\.dsh\\sessions\\--D-ProfessionalSoftware-Project-dsh-bots--\\session-3db315a7-8977-4af2-a932-b21569623a84\\session.v4.jsonl.zstd';
const buf=fs.readFileSync(p);
console.log('size', buf.length, 'magic', buf.slice(0,4).toString('hex'));
const out=zlib.zstdDecompressSync(buf);
console.log('out', out.length);
console.log(out.toString('utf8').slice(0,600));
