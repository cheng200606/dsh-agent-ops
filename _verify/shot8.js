
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

  const chip = page.locator('button', { hasText: /^工作区内修改/ }).first();
  console.log('CHIP_COUNT ' + await chip.count());
  await chip.click({ timeout: 10000 }).catch(e => console.log('chip click fail ' + e.message));
  await sleep(1800);
  await page.screenshot({ path: SHOTS + '41-perm-popup.png' });
  const dialogText = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"],[role="menu"],[data-radix-popper-content-wrapper]');
    return d ? d.innerText.replace(/\n/g, ' | ') : null;
  });
  console.log('DIALOG ' + JSON.stringify(dialogText));
  console.log('ERRORS ' + JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
