const { chromium } = require('playwright');
const TOKEN = process.env.DSH_TOKEN;
const PORT = process.env.DSH_PORT || '32790';
const URL = 'http://127.0.0.1:' + PORT + '/?token=' + TOKEN;
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

  const newBtn = page.locator('button', { hasText: '新会话' }).first();
  if (await newBtn.count() > 0) { await newBtn.click({ timeout: 5000 }).catch(() => {}); await sleep(2500); }
  await dismiss(page);

  const panel = page.locator('button[aria-label="运行台"]').first();
  const hasPanel = await panel.count() > 0;
  console.log('HAS_PANEL ' + hasPanel);
  if (hasPanel) {
    await panel.click({ timeout: 5000 }).catch(e => console.log('panel click fail ' + e.message));
    await sleep(2000);
  }

  const nav = await page.evaluate(() => [...document.querySelectorAll('.ao-navitem')].map(e => e.innerText.trim()));
  console.log('NAV ' + JSON.stringify(nav));

  const labels = ['收件箱', '时间线', '规则表', '建议', '执行环境', '团队', '群聊'];
  let index = 70;
  for (const label of labels) {
    const btn = page.locator('.ao-navitem', { hasText: label }).first();
    if (await btn.count() === 0) { console.log('MISSING_PAGE ' + label); continue; }
    await btn.click({ timeout: 5000 }).catch(() => {});
    await sleep(1200);
    const text = await page.evaluate(() => {
      const el = document.querySelector('.ao-content');
      return el ? el.innerText.replace(/\n+/g, ' | ').slice(0, 260) : null;
    });
    console.log('PAGE ' + label + ' => ' + JSON.stringify(text));
    await page.screenshot({ path: SHOTS + String(index) + '-070-' + label + '.png' });
    index += 1;
  }

  console.log('ERRORS ' + JSON.stringify(errors.slice(0, 10)));
  await browser.close();
})().catch(e => { console.log('FATAL ' + e.message); process.exit(1); });
