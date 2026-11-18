const { chromium } = require('playwright');
const TOKEN = process.env.DSH_TOKEN;
const URL = 'http://127.0.0.1:32781/?token=' + TOKEN;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function dismiss(page){ for(const l of ['继续','继续使用','知道了']){ const b=page.locator('button',{hasText:l}); if(await b.count()>0){ await b.first().click({timeout:3000}).catch(()=>{}); await sleep(400);} } }
(async()=>{
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const ctx = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await ctx.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push('[pageerror] '+e.message)); page.on('console',m=>{if(m.type()==='error')errors.push('[console] '+m.text())});
  await page.goto(URL,{waitUntil:'domcontentloaded'}); await sleep(9000); await dismiss(page);
  const newBtn = page.locator('button',{hasText:'新会话'}).first();
  if(await newBtn.count()>0){ await newBtn.click({timeout:5000}).catch(()=>{}); await sleep(3000); }
  await dismiss(page);
  // badge in NORMAL conversation view (no 运行台 panel opened)
  const badge = page.locator('button[aria-label="打开 Agent Ops 运行台"]').first();
  console.log('BADGE_IN_CONVERSATION '+(await badge.count()>0));
  // check conversation header exists at all
  const hdr = await page.evaluate(()=>{ const els=[...document.querySelectorAll('[class*=header]')]; return els.slice(0,5).map(e=>e.className); });
  console.log('HEADERS '+JSON.stringify(hdr));
  await page.screenshot({path:'D:/ProfessionalSoftware/Project/dsh-bots/dist/shots/62-conversation-badge.png'});
  console.log('ERRORS '+JSON.stringify(errors));
  await browser.close();
})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});