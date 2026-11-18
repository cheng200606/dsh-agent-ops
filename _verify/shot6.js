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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(9000);
  await dismiss(page);

  const input = page.locator('[contenteditable="true"], textarea').first();
  await input.click({ timeout: 15000 });
  await input.type('用 pwsh 工具执行 echo hello-agent-ops，只执行不要解释。', { delay: 3 });
  await page.keyboard.press('Enter');
  console.log('sent');
  await sleep(12000);

  // 等审批卡出现（web profile 的审批策略是 ask）
  let approved = 0;
  for (let i = 0; i < 30; i++) {
    const cands = ['允许', '允许一次', 'Allow', 'Allow once', '批准'];
    let hit = false;
    for (const label of cands) {
      const b = page.locator('button', { hasText: new RegExp('^' + label + '$') });
      if (await b.count() > 0) { await b.first().click({ timeout: 3000 }).catch(() => {}); approved++; hit = true; console.log('clicked ' + label); break; }
    }
    if (!hit) await sleep(2000);
    else await sleep(3000);
    if (i > 6 && !hit && approved > 0) break;
  }
  console.log('approved=' + approved);
  await sleep(8000);
  await page.screenshot({ path: SHOTS + '30-session-run.png' });

  // 徽标（此会话头部）
  const badge = await page.locator('button[aria-label="打开 Agent Ops 运行台"]');
  console.log('BADGE ' + await badge.count());
  if (await badge.count() > 0) {
    console.log('BADGE_TITLE ' + await badge.first().getAttribute('title'));
    await badge.first().click({ timeout: 8000 }).catch(e => console.log('badge click fail ' + e.message));
    await sleep(3000);
    await page.screenshot({ path: SHOTS + '31-ops-tab-with-data.png' });
    const pills = await page.evaluate(() => [...document.querySelectorAll('.ao-pill')].map(e => e.innerText.replace(/\n/g, ':')));
    const cards = await page.evaluate(() => [...document.querySelectorAll('.ao-card')].map(e => e.innerText.replace(/\n/g, ' | ').slice(0, 160)));
    const exp = await page.evaluate(() => { const b = document.querySelector('.ao-act'); return b ? { text: b.innerText, disabled: b.disabled } : null; });
    const toast = await page.evaluate(() => { const t = document.querySelector('.ao-toast'); return t ? t.innerText.replace(/\n/g, ' | ') : null; });
    console.log('PILLS ' + JSON.stringify(pills));
    console.log('CARDS ' + JSON.stringify(cards));
    console.log('EXPORT ' + JSON.stringify(exp));
    console.log('TOAST ' + JSON.stringify(toast));

    // 点导出，抓下载
    if (exp && !exp.disabled) {
      const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
      await page.locator('.ao-act').first().click({ timeout: 8000 }).catch(e => console.log('export click fail ' + e.message));
      const d = await dl;
      if (d) {
        const p = 'D:/ProfessionalSoftware/Project/dsh-bots/dist/shots/exported-audit.md';
        await d.saveAs(p);
        const fs = require('fs');
        console.log('DOWNLOAD ' + d.suggestedFilename() + ' bytes=' + fs.statSync(p).size);
        console.log('MD_HEAD ' + JSON.stringify(fs.readFileSync(p, 'utf8').split('\n').slice(0, 12)));
      } else { console.log('DOWNLOAD none'); }
      await sleep(1200);
      await page.screenshot({ path: SHOTS + '32-exported.png' });
    }
  }
  console.log('ERRORS ' + JSON.stringify(errors, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });