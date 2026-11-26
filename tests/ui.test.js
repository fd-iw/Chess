// Drives the app in Chromium at phone size: plays games via taps, checks for JS errors.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const shots = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html'));
  if (shots) await page.screenshot({ path: shots + '/home.png' });
  await page.click('[data-go=levels]');
  if (shots) await page.screenshot({ path: shots + '/levels.png' });
  await page.click('[data-lv="1"]');
  // play up to 60 player moves: pick the engine's best move and tap it
  for (let i = 0; i < 60; i++) {
    await page.waitForFunction(() => { const G = window.__app.G(); return G.over || (!G.busy && G.pos.turn === G.color); }, null, { timeout: 20000 });
    const st = await page.evaluate(() => { const G = window.__app.G(); if (G.over) return null;
      const b = window.ChessEngine.bestMove(G.pos, { maxDepth: 3, timeMs: 300 }); return { from: b.move.from, to: b.move.to, promo: !!b.move.promo }; });
    if (!st) break;
    // dismiss coach popup buttons if present
    await page.click(`#board [data-sq="${st.from}"]`);
    await page.click(`#board [data-sq="${st.to}"]`);
    if (st.promo) await page.click('[data-pr=q]');
    const cont = await page.$('#c-continue'); if (cont) await cont.click();
    if (i === 6 && shots) { await page.waitForTimeout(800); await page.screenshot({ path: shots + '/game.png' }); }
  }
  await page.waitForSelector('#modal.show', { timeout: 20000 });
  if (shots) await page.screenshot({ path: shots + '/end.png' });
  const s = await page.evaluate(() => window.__app.S());
  console.log('games', s.games, 'wins', s.wins, 'unlocked', s.unlocked, 'xp', s.xp, 'ach', Object.keys(s.ach).join(','));
  await page.click('#eg-levels');
  // hint + undo checks on level 2
  await page.click('[data-lv="2"]');
  await page.waitForFunction(() => !window.__app.G().busy);
  await page.click('#btn-hint'); await page.waitForTimeout(1500); await page.click('#btn-hint');
  const msg = await page.textContent('#coach-msg'); console.log('hint:', msg);
  if (shots) await page.screenshot({ path: shots + '/hint.png' });
  // blunder: play e4 then Qh5?? style -- just make a move then undo
  await page.click('#board [data-sq="52"]'); await page.click('#board [data-sq="36"]');
  await page.waitForFunction(() => { const G = window.__app.G(); return !G.busy && G.pos.turn === G.color; }, null, { timeout: 20000 });
  await page.click('#btn-undo');
  await page.waitForFunction(() => window.__app.G().moves.length === 0);
  console.log('undo ok');
  // puzzles
  await page.evaluate(() => window.onAndroidBack()); await page.evaluate(() => window.onAndroidBack());
  await page.click('[data-go=puzzles]'); await page.click('[data-pz="0"]');
  await page.click('#pz-board [data-sq="56"]'); await page.click('#pz-board [data-sq="0"]');
  console.log('puzzle:', await page.textContent('#pz-msg'));
  if (shots) await page.screenshot({ path: shots + '/puzzle.png' });
  await page.evaluate(() => window.onAndroidBack()); await page.evaluate(() => window.onAndroidBack());
  await page.click('[data-go=learn]'); await page.click('[data-ls="1"]');
  if (shots) await page.screenshot({ path: shots + '/lesson.png' });
  await page.click('#lesson-done');
  await page.evaluate(() => window.onAndroidBack()); await page.click('[data-go=awards]');
  if (shots) await page.screenshot({ path: shots + '/awards.png' });
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no JS errors');
  await browser.close(); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
