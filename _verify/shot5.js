const { chromium } = require('playwright');
const TOKEN = process.env.DSH_TOKEN;
const URL = 'http://127.0.0.1:32781/?token=' + TOKEN;
const SHOTS = 'D:/ProfessionalSoftware/Project/dsh-bots/dist/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function dismiss(page) {
  for (const label of ['继续', '继续使用', '知道了']) {
    const b = page.locator('button', { hasText: label });
    if (await b.count() > 0) { await b.first().click({ timeout: 4000 }).catch(() => {}); await sleep(600); }
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(9000);
  await dismiss(page);

  // 主面板：运行台
  const panellist = page.locator('button[aria-label="运行台"]');
  console.log('panellist ' + await panellist.count());
  await panellist.first().click({ timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: SHOTS + '20-m3-inbox.png' });

  const nav = await page.evaluate(() => [...document.querySelectorAll('.ao-navitem')].map(e => e.innerText.trim()));
  console.log('NAV ' + JSON.stringify(nav));

  // 规则页
  const rulesNav = page.locator('.ao-navitem', { hasText: '规则' });
  console.log('rulesNav ' + await rulesNav.count());
  if (await rulesNav.count() > 0) {
    await rulesNav.first().click({ timeout: 8000 });
    await sleep(1500);
    await page.screenshot({ path: SHOTS + '21-m3-rules.png' });
    const groups = await page.evaluate(() => [...document.querySelectorAll('.ao-grouphd')].map(e => e.innerText.trim()));
    const cnt = await page.evaluate(() => document.querySelectorAll('.ao-rule').length);
    const sample = await page.evaluate(() => [...document.querySelectorAll('.ao-rule')].slice(0, 3).map(e => e.innerText.replace(/\n/g, ' | ')));
    const policy = await page.evaluate(() => [...document.querySelectorAll('.ao-kv')].map(e => e.innerText.replace(/\n/g, ':')).slice(0, 3));
    console.log('RULE_GROUPS ' + JSON.stringify(groups));
    console.log('RULE_COUNT ' + cnt);
    console.log('RULE_SAMPLE ' + JSON.stringify(sample));
    console.log('POLICY ' + JSON.stringify(policy));
  }

  // 时间线 / 执行环境仍可用
  for (const name of ['时间线', '执行环境']) {
    const b = page.locator('.ao-navitem', { hasText: name });
    if (await b.count() > 0) { await b.first().click({ timeout: 8000 }); await sleep(900); }
  }
  await page.screenshot({ path: SHOTS + '22-m3-env.png' });

  // 导出按钮存在且 disabled（无数据）
  const exp = await page.evaluate(() => {
    const b = document.querySelector('.ao-act');
    return b ? { text: b.innerText, disabled: b.disabled, title: b.getAttribute('title') } : null;
  });
  console.log('EXPORT ' + JSON.stringify(exp));

  // 全域浮层是否注册了通知条容器（有数据才可见，这里只确认注册没抛错）
  const toast = await page.evaluate(() => document.querySelectorAll('.ao-toaster').length);
  console.log('TOASTERS ' + toast);

  // 打开会话，确认徽标仍在
  const newBtn = page.locator('button[aria-label="新建会话"]');
  if (await newBtn.count() > 0) {
    await newBtn.first().click({ timeout: 15000 });
    await sleep(5000);
    await dismiss(page);
    const badge = await page.locator('button[aria-label="打开 Agent Ops 运行台"]').count();
    console.log('BADGE ' + badge);
    await page.screenshot({ path: SHOTS + '23-m3-session.png' });
  }

  console.log('ERRORS ' + JSON.stringify(errors, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });