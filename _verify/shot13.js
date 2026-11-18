
const { chromium } = require('playwright');
const TOKEN = process.env.DSH_TOKEN;
const URL = 'http://127.0.0.1:32781/?token=' + TOKEN;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function dismiss(page) {
  for (const label of ['继续', '继续使用', '知道了']) {
    const b = page.locator('button', { hasText: label });
    if (await b.count() > 0) { await b.first().click({ timeout: 3000 }).catch(() => {}); await sleep(400); }
  }
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(9000);
  await dismiss(page);
  const newBtn = page.locator('button', { hasText: '新会话' }).first();
  if (await newBtn.count() > 0) { await newBtn.click({ timeout: 5000 }).catch(() => {}); await sleep(3000); }
  await dismiss(page);

  const badge = page.locator('button[aria-label="打开 Agent Ops 运行台"]').first();
  console.log('HAS_BADGE ' + (await badge.count() > 0));
  if (await badge.count() === 0) { console.log('ERRORS ' + JSON.stringify(errors)); await browser.close(); return; }
  await badge.click({ timeout: 5000 });
  await sleep(2500);
  const navs = await page.evaluate(() => [...document.querySelectorAll('.ao-navitem')].map(e => e.innerText.trim()));
  console.log('TAB_NAV ' + JSON.stringify(navs));
  const chatBtns = page.locator('.ao-navitem', { hasText: '群聊' });
  const n = await chatBtns.count();
  if (n > 0) { await chatBtns.nth(n-1).click({ timeout: 5000 }); await sleep(1200); }
  const before = await page.evaluate(() => { const els=[...document.querySelectorAll('.ao-content')]; return els.map(el=>el.innerText.replace(/\n+/g,' | ').slice(0,240)); });
  console.log('TAB_BEFORE ' + JSON.stringify(before));
  const inputs = page.locator('.ao-input');
  const ic = await inputs.count();
  console.log('INPUTS ' + ic);
  if (ic > 0) {
    const input = inputs.nth(ic-1);
    const dis = await input.isDisabled();
    console.log('LAST_INPUT_DISABLED ' + dis);
    if (!dis) {
      await input.click();
      await input.type('probe-two');
      const sends = page.locator('.ao-send');
      const sc = await sends.count();
      await sends.nth(sc-1).click();
      await sleep(3500);
      const after = await page.evaluate(() => { const els=[...document.querySelectorAll('.ao-content')]; return els.map(el=>el.innerText.replace(/\n+/g,' | ').slice(0,400)); });
      console.log('TAB_AFTER ' + JSON.stringify(after));
      const msgs = await page.evaluate(() => [...document.querySelectorAll('.ao-msg')].map(e => e.innerText.replace(/\n/g,' / ')));
      console.log('TAB_MSGS ' + JSON.stringify(msgs));
    }
  }
  await page.screenshot({ path: 'D:/ProfessionalSoftware/Project/dsh-bots/dist/shots/61-tab-chat.png' });
  console.log('ERRORS ' + JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.log('FATAL ' + e.message); process.exit(1); });
