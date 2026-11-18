const { chromium } = require('playwright');
const TOKEN = process.env.DSH_TOKEN;
const URL = 'http://127.0.0.1:32781/?token=' + TOKEN;
const SHOTS = 'D:/ProfessionalSoftware/Project/dsh-bots/dist/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function dismiss(page) {
  for (const label of ['继续', '继续使用', '知道了']) {
    const b = page.locator('button', { hasText: label });
    if (await b.count() > 0) { await b.first().click({ timeout: 3000 }).catch(() => {}); await sleep(500); }
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

  const input = page.locator('[contenteditable="true"], textarea').first();
  await input.click({ timeout: 15000 });
  await input.type('用 pwsh 工具执行 echo toast-check，只执行不要解释。', { delay: 3 });
  await page.keyboard.press('Enter');
  console.log('sent');

  // 等审批卡出现，但不点它 —— 此时 pending>0，通知条应弹
  let toastSeen = null, badgeSeen = null, pills = null;
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    const t = await page.evaluate(() => { const el = document.querySelector('.ao-toast'); return el ? el.innerText.replace(/\n/g, ' | ') : null; });
    if (t && !toastSeen) { toastSeen = t; console.log('TOAST_AT i=' + i + ' ' + JSON.stringify(t)); await page.screenshot({ path: SHOTS + '33-toast.png' }); }
    const bd = await page.evaluate(() => { const el = document.querySelector('.ao-badge'); return el ? { text: el.innerText.trim(), title: el.getAttribute('title'), cls: el.className } : null; });
    if (bd && bd.text && !badgeSeen) { badgeSeen = bd; console.log('BADGE_AT i=' + i + ' ' + JSON.stringify(bd)); }
    const hasApproval = await page.locator('button', { hasText: /^允许一次$/ }).count();
    if (hasApproval > 0) { console.log('approval card present at i=' + i); break; }
    if (toastSeen && i > 20) break;
  }
  await page.screenshot({ path: SHOTS + '34-toast-final.png' });

  // 顺带确认点击通知条会打开 ops tab
  if (toastSeen) {
    const before = await page.locator('.ao-ws').count();
    await page.locator('.ao-toast').first().click({ timeout: 5000 }).catch(e => console.log('toast click fail ' + e.message));
    await sleep(2500);
    const after = await page.locator('.ao-ws').count();
    console.log('OPS_TAB_BEFORE ' + before + ' AFTER ' + after);
    const p = await page.evaluate(() => [...document.querySelectorAll('.ao-pill')].map(e => e.innerText.replace(/\n/g, ':')));
    const c = await page.evaluate(() => [...document.querySelectorAll('.ao-card')].map(e => e.innerText.split('\n')[0] + ' / ' + (e.innerText.split('\n')[1] || '')));
    console.log('PILLS_PENDING ' + JSON.stringify(p));
    console.log('CARDS_PENDING ' + JSON.stringify(c));
    await page.screenshot({ path: SHOTS + '35-pending-inbox.png' });
  }

  // 收尾：批准掉，让会话结束
  const ok = page.locator('button', { hasText: /^允许一次$/ });
  if (await ok.count() > 0) { await ok.first().click({ timeout: 5000 }).catch(() => {}); }
  await sleep(3000);
  console.log('ERRORS ' + JSON.stringify(errors, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });