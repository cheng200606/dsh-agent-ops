const { chromium } = require('playwright');
const TOKEN = process.env.DSH_TOKEN;
const URL = 'http://127.0.0.1:32781/?token=' + TOKEN;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function dismiss(page){ for(const l of ['继续','继续使用','知道了']){ const b=page.locator('button',{hasText:l}); if(await b.count()>0){ await b.first().click({timeout:3000}).catch(()=>{}); await sleep(400);} } }
(async()=>{
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const ctx = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await ctx.newPage();
  await page.goto(URL,{waitUntil:'domcontentloaded'}); await sleep(9000); await dismiss(page);
  const newBtn = page.locator('button',{hasText:'新会话'}).first();
  if(await newBtn.count()>0){ await newBtn.click({timeout:5000}).catch(()=>{}); await sleep(3000); }
  await dismiss(page);
  const hdrBtns = await page.evaluate(()=>{ const h=document.querySelector('[class*=headerActions]'); if(!h) return 'NO_HEADER_ACTIONS'; return [...h.querySelectorAll('button')].map(b=>({aria:b.getAttribute('aria-label'),title:b.getAttribute('title'),cls:b.className,txt:b.innerText.slice(0,30)})); });
  console.log('HEADER_BUTTONS '+JSON.stringify(hdrBtns));
  const allBadge = await page.evaluate(()=>[...document.querySelectorAll('.ao-badge')].map(b=>({aria:b.getAttribute('aria-label'),title:b.getAttribute('title')})));
  console.log('AO_BADGES '+JSON.stringify(allBadge));
  await browser.close();
})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});