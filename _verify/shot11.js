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

  // 开一个会话，让 ops tab 有 session 作用域
  const newBtn = page.locator('button', { hasText: '新会话' }).first();
  if (await newBtn.count() > 0) { await newBtn.click({ timeout: 5000 }).catch(() => {}); await sleep(2500); }
  await dismiss(page);

  // 打开运行台主面板
  const panel = page.locator('button[aria-label="运行台"]').first();
  if (await panel.count() > 0) { await panel.click({ timeout: 5000 }).catch(e => console.log('panel click fail ' + e.message)); await sleep(2000); }
  const nav = await page.evaluate(() => [...document.querySelectorAll('.ao-navitem')].map(e => e.innerText.trim()));
  console.log('NAV ' + JSON.stringify(nav));
  await page.screenshot({ path: SHOTS + '50-060-main.png' });

  // 团队页
  const teamBtn = page.locator('.ao-navitem', { hasText: '团队' }).first();
  if (await teamBtn.count() > 0) { await teamBtn.click({ timeout: 5000 }).catch(() => {}); await sleep(1200); }
  const team = await page.evaluate(() => { const el = document.querySelector('.ao-content'); return el ? el.innerText.replace(/\n+/g, ' | ').slice(0, 400) : null; });
  console.log('TEAM ' + JSON.stringify(team));
  await page.screenshot({ path: SHOTS + '51-060-team.png' });

  // 群聊页
  const chatBtn = page.locator('.ao-navitem', { hasText: '群聊' }).first();
  if (await chatBtn.count() > 0) { await chatBtn.click({ timeout: 5000 }).catch(() => {}); await sleep(1200); }
  const chatBefore = await page.evaluate(() => { const el = document.querySelector('.ao-content'); return el ? el.innerText.replace(/\n+/g, ' | ').slice(0, 300) : null; });
  console.log('CHAT_BEFORE ' + JSON.stringify(chatBefore));
  await page.screenshot({ path: SHOTS + '52-060-chat.png' });

  const input = page.locator('.ao-input').first();
  const hasInput = await input.count() > 0;
  console.log('HAS_INPUT ' + hasInput);
  if (hasInput) {
    const disabled = await input.isDisabled().catch(() => null);
    console.log('INPUT_DISABLED ' + disabled);
    if (!disabled) {
      await input.click({ timeout: 5000 }).catch(() => {});
      await input.type('大家好，我是 lead，先对一下今天的任务。', { delay: 5 });
      const sendBtn = page.locator('.ao-send').first();
      await sendBtn.click({ timeout: 5000 }).catch(e => console.log('send click fail ' + e.message));
      await sleep(4000);
      const chatAfter = await page.evaluate(() => { const el = document.querySelector('.ao-content'); return el ? el.innerText.replace(/\n+/g, ' | ').slice(0, 600) : null; });
      console.log('CHAT_AFTER ' + JSON.stringify(chatAfter));
      const msgs = await page.evaluate(() => [...document.querySelectorAll('.ao-msg')].map(e => e.innerText.replace(/\n/g, ' / ')));
      console.log('MSGS ' + JSON.stringify(msgs));
      await page.screenshot({ path: SHOTS + '53-060-chat-sent.png' });

      // 刷新后验证持久化（从会话日志重建）
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(9000);
      await dismiss(page);
      const panel2 = page.locator('button[aria-label="运行台"]').first();
      if (await panel2.count() > 0) { await panel2.click({ timeout: 5000 }).catch(() => {}); await sleep(2000); }
      const chatBtn2 = page.locator('.ao-navitem', { hasText: '群聊' }).first();
      if (await chatBtn2.count() > 0) { await chatBtn2.click({ timeout: 5000 }).catch(() => {}); await sleep(1500); }
      const msgs2 = await page.evaluate(() => [...document.querySelectorAll('.ao-msg')].map(e => e.innerText.replace(/\n/g, ' / ')));
      console.log('MSGS_AFTER_RELOAD ' + JSON.stringify(msgs2));
      await page.screenshot({ path: SHOTS + '54-060-reload.png' });
    }
  }

  console.log('ERRORS ' + JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.log('FATAL ' + e.message); process.exit(1); });