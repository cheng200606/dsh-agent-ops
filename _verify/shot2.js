const { chromium } = require('playwright');
const TOKEN = process.env.DSH_TOKEN;
const URL = 'http://127.0.0.1:32781/?token=' + TOKEN;
const SHOTS = 'D:/ProfessionalSoftware/Project/dsh-bots/dist/shots/';

async function dismiss(page) {
  for (const label of ['继续', '继续使用', '知道了']) {
    const b = page.locator('button', { hasText: label });
    if (await b.count() > 0) { await b.first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(800); }
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  await dismiss(page);
  await page.waitForTimeout(1000);

  // ── A. 左侧栏主面板：三纵切页 ──
  const btn = page.locator('button[aria-label="运行台"]');
  console.log('panellistBtnCount ' + await btn.count());
  if (await btn.count() > 0) {
    await btn.first().click({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SHOTS + '02-ops-main-inbox.png' });
  }
  const navTexts = await page.evaluate(() => [...document.querySelectorAll('.ao-navitem')].map(e => e.innerText));
  console.log('NAV ' + JSON.stringify(navTexts));
  const headText = await page.evaluate(() => {
    const head = document.querySelector('.ao-head');
    return head ? head.innerText : '(no head)';
  });
  console.log('HEAD ' + JSON.stringify(headText));

  // 切到「执行环境」页（M2 新增）
  const envTab = page.locator('.ao-navitem', { hasText: '执行环境' });
  if (await envTab.count() > 0) {
    await envTab.first().click({ timeout: 8000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: SHOTS + '03-ops-main-env.png' });
    const kv = await page.evaluate(() => [...document.querySelectorAll('.ao-kv')].map(e => e.innerText.replace(/\n/g, ' | ')));
    console.log('ENVKV ' + JSON.stringify(kv));
  }
  const tlTab = page.locator('.ao-navitem', { hasText: '时间线' });
  if (await tlTab.count() > 0) {
    await tlTab.first().click({ timeout: 8000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: SHOTS + '04-ops-main-timeline.png' });
  }

  // ── B. 头部徽标（需要打开会话）──
  const badge = page.locator('button[aria-label="打开 Agent Ops 运行台"]');
  console.log('badgeCount ' + await badge.count());
  const headerActions = await page.evaluate(() => [...document.querySelectorAll('[class*="header"] button')].map(e => (e.getAttribute('aria-label') || e.title || e.innerText || '').slice(0, 40)));
  console.log('HEADER_BUTTONS ' + JSON.stringify(headerActions));

  console.log('ERRORS ' + JSON.stringify(errors, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
