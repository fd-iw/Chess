// Validates every puzzle: solution is legal, mates really mate, 'win' solutions are the engine's best move.
require('../app/src/main/assets/www/js/engine.js');
require('../app/src/main/assets/www/js/data.js');
const E = globalThis.ChessEngine, D = globalThis.ChessData;
let ok = true;
for (const pz of D.PUZZLES) {
  const p = new E.Position(pz.fen);
  for (const u of pz.solution) {
    const m = p.findUci(u);
    if (!m) { ok = false; console.log('ILLEGAL', pz.id, u); continue; }
    const san = p.san(m);
    if (pz.type === 'mate' && !san.endsWith('#')) { ok = false; console.log('NOT MATE', pz.id, san); }
    if (pz.type === 'win') {
      const r = E.scoreAllMoves(p, 4).list;
      const best = r[0], mine = r.find(x => p.uci(x.move) === u);
      const second = r.find(x => p.uci(x.move) !== u);
      if (mine.score < best.score || (mine.score < 250 && mine.score - second.score < 150)) { ok = false; console.log('WIN?', pz.id, u, 'best', p.uci(best.move), best.score, 'mine', mine.score, 'second', second && p.uci(second.move), second && second.score); }
    }
    console.log('#' + pz.id, pz.title, san);
  }
}
for (const l of D.LESSONS) for (const s of l.sections) if (s.fen) new E.Position(s.fen);
console.log(ok ? 'puzzles OK' : 'puzzles FAILED'); process.exit(ok ? 0 : 1);
