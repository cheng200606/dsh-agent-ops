
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
  if (await newBtn.count() > 0) { await newBtn.click({ timeout: 5000 }).catch(() => {}); await sleep(2500); }
  await dismiss(page);

  // main panel 运行台
  const panel = page.locator('button[aria-label="运行台"]').first();
  if (await panel.count() > 0) { await panel.click({ timeout: 5000 }).catch(() => {}); await sleep(2000); }
  const pills = await page.evaluate(() => [...document.querySelectorAll('.ao-pill')].map(e => e.innerText.replace(/\n/g,' ')));
  console.log('PILLS ' + JSON.stringify(pills));
  const envText = await page.evaluate(() => { const el = document.querySelector('.ao-content'); return el ? el.innerText.replace(/\n+/g,' | ').slice(0,200) : null; });
  console.log('ENV_PAGE ' + JSON.stringify(envText));

  // 群聊页发一句
  const chatBtn = page.locator('.ao-navitem', { hasText: '群聊' }).first();
  if (await chatBtn.count() > 0) { await chatBtn.click({ timeout: 5000 }).catch(() => {}); await sleep(800); }
  const input = page.locator('.ao-input').first();
  if (await input.count() > 0 && !(await input.isDisabled())) {
    await input.click({ timeout: 5000 }).catch(() => {});
    await input.type('probe-one', { delay: 5 });
    await page.locator('.ao-send').first().click({ timeout: 5000 }).catch(e => console.log('sendfail ' + e.message));
    await sleep(3500);
  }
  const mainMsgs = await page.evaluate(() => [...document.querySelectorAll('.ao-msg')].map(e => e.innerText.replace(/\n/g,' / ')));
  console.log('MAIN_MSGS ' + JSON.stringify(mainMsgs));

  // 打开右侧栏 ops tab（session 作用域，走 useProjection）
  const badge = page.locator('button[aria-label="打开 Agent Ops 运行台"]').first();
  console.log('HAS_BADGE ' + (await badge.count() > 0));
  if (await badge.count() > 0) {
    await badge.click({ timeout: 5000 }).catch(e => console.log('badgefail ' + e.message));
    await sleep(2500);
    const navs = await page.evaluate(() => [...document.querySelectorAll('.ao-navitem')].map(e => e.innerText.trim()));
    console.log('TAB_NAV ' + JSON.stringify(navs));
    // 找到 tab 内的群聊 nav（可能是最后一个 .ao-navitem）
    const allChat = page.locator('.ao-navitem', { hasText: '群聊' });
    const n = await allChat.count();
    if (n > 0) { await allChat.nth(n-1).click({ timeout: 5000 }).catch(() => {}); await sleep(1200); }
    const tabMsgs = await page.evaluate(() => [...document.querySelectorAll('.ao-msg')].map(e => e.innerText.replace(/\n/g,' / ')));
    console.log('TAB_MSGS ' + JSON.stringify(tabMsgs));
    const tabText = await page.evaluate(() => { const els=[...document.querySelectorAll('.ao-content')]; return els.map(el=>el.innerText.replace(/\n+/g,' | ').slice(0,260)); });
    console.log('TAB_CONTENT ' + JSON.stringify(tabText));
    await page.screenshot({ path: 'D:/ProfessionalSoftware/Project/dsh-bots/dist/shots/60-probe-tab.png' });
  }
  console.log('ERRORS ' + JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.log('FATAL ' + e.message); process.exit(1); });
