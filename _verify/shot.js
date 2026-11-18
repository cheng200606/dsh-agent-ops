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
  await page.waitForTimeout(8000);
  await dismiss(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SHOTS + '01-boot.png' });

  const btn = page.locator('button[aria-label="运行台"]');
  console.log('btnCount ' + await btn.count());
  await btn.first().click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOTS + '02-ops-panel.png' });

  const info = await page.evaluate(() => {
    const root = document.querySelector('.ao-root');
    const txt = root ? root.innerText : '(no .ao-root)';
    const pills = [...document.querySelectorAll('.ao-pill')].map(e => e.innerText);
    const env = document.querySelector('.ao-env') ? document.querySelector('.ao-env').innerText : '(none)';
    return { txt, pills, env, rootExists: !!root };
  });
  console.log('ROOT ' + info.rootExists);
  console.log('PILLS ' + JSON.stringify(info.pills));
  console.log('ENV ' + JSON.stringify(info.env));
  console.log('TEXT >>>');
  console.log(info.txt);
  console.log('<<<');
  console.log('ERRORS ' + JSON.stringify(errors, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
