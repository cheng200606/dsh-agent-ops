
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
  await chip.click({ timeout: 10000 });
  await sleep(1200);
  await page.locator('button', { hasText: /自动审查/ }).last().click({ timeout: 8000 });
  await sleep(1200);

  const ack = page.getByRole('checkbox').first();
  console.log('CHECKBOX ' + await ack.count());
  await ack.check({ timeout: 5000 }).catch(async () => { await ack.click({ timeout: 5000 }).catch(()=>{}); });
  await sleep(800);
  const enable = page.getByRole('button', { name: /^启用自动审查$/ });
  console.log('ENABLE_DISABLED ' + await enable.isDisabled().catch(()=>'n/a'));
  await enable.click({ timeout: 8000 }).catch(e => console.log('enable fail ' + e.message));
  await sleep(3000);
  const chipText = await page.locator('button', { hasText: /自动审查|工作区内修改|完全权限/ }).first().innerText().catch(()=>null);
  console.log('CHIP_AFTER ' + JSON.stringify(chipText));
  await page.screenshot({ path: SHOTS + '43-auto-enabled.png' });
  console.log('ERRORS ' + JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
