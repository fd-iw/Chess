// Run: node tests/perft.test.js
require('../app/src/main/assets/www/js/engine.js');
const E = globalThis.ChessEngine;
function perft(p, d) { if (d === 0) return 1; let n = 0; for (const m of p.moves()) { p.make(m); n += perft(p, d - 1); p.unmake(m); } return n; }
const cases = [
  [E.START_FEN, [20, 400, 8902, 197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];
let ok = true;
for (const [fen, exp] of cases) exp.forEach((v, i) => { const p = new E.Position(fen); const got = perft(p, i + 1); if (got !== v) { ok = false; console.log('FAIL', fen, i + 1, got, v); } if (p.fen() !== new E.Position(fen).fen()) { ok = false; console.log('state corrupt', fen); } });
console.log(ok ? 'perft OK' : 'perft FAILED'); process.exit(ok ? 0 : 1);
