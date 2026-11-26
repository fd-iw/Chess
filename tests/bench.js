require('../app/src/main/assets/www/js/engine.js');
const E = globalThis.ChessEngine;
const fens=[E.START_FEN,'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4','r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'];
for(const f of fens){const p=new E.Position(f);
for (const d of [1,2,3]){let t=Date.now();const r=E.scoreAllMoves(p,d);console.log('all d'+d, Date.now()-t,'ms', p.san(r.list[0].move), r.list[0].score);}
for (const [d,t] of [[4,900],[5,1600],[7,2800]]){let s=Date.now();const b=E.bestMove(p,{maxDepth:d,timeMs:t});console.log('best',d,Date.now()-s,'ms depth',b.depth,p.san(b.move),b.score,b.nodes);}}
