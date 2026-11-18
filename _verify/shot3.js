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
  await page.waitForTimeout(800);

  // 先打开一个已有会话，让会话头部动作区真正渲染出来
  const rows = page.locator('text=Grok Bot 对标与群聊插件方');
  console.log('sessionRows ' + await rows.count());
  if (await rows.count() > 0) {
    await rows.first().click({ timeout: 15000 }).catch(e => console.log('sessionClickFail ' + e.message));
    await page.waitForTimeout(6000);
  }
  await page.screenshot({ path: SHOTS + '05-session-open.png' });

  const headerButtons = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('button')) {
      const label = b.getAttribute('aria-label') || b.title || '';
      if (label) out.push(label.slice(0, 50));
    }
    return out;
  });
  console.log('BUTTONS ' + JSON.stringify(headerButtons));

  const badge = page.locator('button[aria-label="打开 Agent Ops 运行台"]');
  const badgeCount = await badge.count();
  console.log('badgeCount ' + badgeCount);
  if (badgeCount > 0) {
    console.log('badgeText ' + JSON.stringify(await badge.first().innerText().catch(() => '')));
    console.log('badgeTitle ' + JSON.stringify(await badge.first().getAttribute('title')));
    await page.screenshot({ path: SHOTS + '06-badge.png' });
    await badge.first().click({ timeout: 10000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: SHOTS + '07-ops-tab.png' });
    const tabTxt = await page.evaluate(() => {
      const roots = [...document.querySelectorAll('.ao-root')];
      return roots.map(r => r.innerText.replace(/\n+/g, ' | ').slice(0, 300));
    });
    console.log('AO_ROOTS ' + JSON.stringify(tabTxt));
    const navs = await page.evaluate(() => [...document.querySelectorAll('.ao-navitem')].map(e => e.innerText));
    console.log('TAB_NAV ' + JSON.stringify(navs));
  }

  console.log('ERRORS ' + JSON.stringify(errors, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
