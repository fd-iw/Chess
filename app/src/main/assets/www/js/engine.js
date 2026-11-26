/* Chess rules + AI engine (written from scratch for Christian's Chess Academy).
 * Squares: 0..63, index = row*8 + col, row 0 = rank 8 (top, black side), col 0 = file a.
 * Pieces: 'P','N','B','R','Q','K' white; lowercase black; null = empty.
 */
(function (global) {
  'use strict';

  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var FILES = 'abcdefgh';
  var VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  var NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  var MATE = 100000;

  function isWhite(p) { return p < 'a'; }
  function colorOf(p) { return p < 'a' ? 'w' : 'b'; }
  function typeOf(p) { return p.toLowerCase(); }
  function row(sq) { return sq >> 3; }
  function col(sq) { return sq & 7; }
  function sqName(sq) { return FILES[col(sq)] + (8 - row(sq)); }
  function sqFromName(n) { return (8 - parseInt(n[1], 10)) * 8 + FILES.indexOf(n[0]); }

  // ---------- precomputed attack tables ----------
  var KNIGHT = [], KING = [], RAYS = [];
  var DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]; // 0-3 orthogonal, 4-7 diagonal
  (function () {
    var kn = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (var s = 0; s < 64; s++) {
      var r = row(s), c = col(s), i, rr, cc;
      KNIGHT[s] = []; KING[s] = []; RAYS[s] = [];
      for (i = 0; i < 8; i++) {
        rr = r + kn[i][0]; cc = c + kn[i][1];
        if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) KNIGHT[s].push(rr * 8 + cc);
        rr = r + DIRS[i][0]; cc = c + DIRS[i][1];
        if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) KING[s].push(rr * 8 + cc);
        var ray = [];
        rr = r + DIRS[i][0]; cc = c + DIRS[i][1];
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { ray.push(rr * 8 + cc); rr += DIRS[i][0]; cc += DIRS[i][1]; }
        RAYS[s].push(ray);
      }
    }
  })();

  // ---------- piece-square tables (white's view, row 0 = rank 8) ----------
  var PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    kEnd: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  };
  function mirror(sq) { return (7 - row(sq)) * 8 + col(sq); }

  // ---------- Position ----------
  function Position(fen) { this.load(fen || START_FEN); }

  Position.prototype.load = function (fen) {
    var parts = fen.trim().split(/\s+/);
    this.board = new Array(64);
    for (var i = 0; i < 64; i++) this.board[i] = null;
    var r = 0, c = 0, rows = parts[0];
    this.kings = { w: -1, b: -1 };
    for (i = 0; i < rows.length; i++) {
      var ch = rows[i];
      if (ch === '/') { r++; c = 0; }
      else if (ch >= '1' && ch <= '8') c += parseInt(ch, 10);
      else {
        var s = r * 8 + c;
        this.board[s] = ch;
        if (ch === 'K') this.kings.w = s;
        if (ch === 'k') this.kings.b = s;
        c++;
      }
    }
    this.turn = parts[1] || 'w';
    var cs = parts[2] || '-';
    this.castle = { K: cs.indexOf('K') >= 0, Q: cs.indexOf('Q') >= 0, k: cs.indexOf('k') >= 0, q: cs.indexOf('q') >= 0 };
    this.ep = (parts[3] && parts[3] !== '-') ? sqFromName(parts[3]) : -1;
    this.half = parseInt(parts[4] || '0', 10);
    this.full = parseInt(parts[5] || '1', 10);
    this.stack = [];
  };

  Position.prototype.clone = function () {
    var p = Object.create(Position.prototype);
    p.board = this.board.slice();
    p.kings = { w: this.kings.w, b: this.kings.b };
    p.turn = this.turn;
    p.castle = { K: this.castle.K, Q: this.castle.Q, k: this.castle.k, q: this.castle.q };
    p.ep = this.ep; p.half = this.half; p.full = this.full;
    p.stack = [];
    return p;
  };

  Position.prototype.fen = function () {
    var out = '';
    for (var r = 0; r < 8; r++) {
      var empty = 0;
      for (var c = 0; c < 8; c++) {
        var p = this.board[r * 8 + c];
        if (!p) empty++;
        else { if (empty) { out += empty; empty = 0; } out += p; }
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    var cs = (this.castle.K ? 'K' : '') + (this.castle.Q ? 'Q' : '') + (this.castle.k ? 'k' : '') + (this.castle.q ? 'q' : '');
    return out + ' ' + this.turn + ' ' + (cs || '-') + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
  };

  // Key used for repetition detection (board + turn + castling + ep)
  Position.prototype.key = function () { return this.fen().split(' ').slice(0, 4).join(' '); };

  // Is square `sq` attacked by side `by` ('w'|'b')?
  Position.prototype.attacked = function (sq, by) {
    var b = this.board, i, t, p, ray, d;
    var white = by === 'w';
    // pawns
    var r = row(sq), c = col(sq);
    var pr = white ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) {
      var pawn = white ? 'P' : 'p';
      if (c > 0 && b[pr * 8 + c - 1] === pawn) return true;
      if (c < 7 && b[pr * 8 + c + 1] === pawn) return true;
    }
    var N = white ? 'N' : 'n', K = white ? 'K' : 'k', Bq = white ? 'B' : 'b', R = white ? 'R' : 'r', Q = white ? 'Q' : 'q';
    t = KNIGHT[sq];
    for (i = 0; i < t.length; i++) if (b[t[i]] === N) return true;
    t = KING[sq];
    for (i = 0; i < t.length; i++) if (b[t[i]] === K) return true;
    for (d = 0; d < 8; d++) {
      ray = RAYS[sq][d];
      for (i = 0; i < ray.length; i++) {
        p = b[ray[i]];
        if (p) {
          if (p === Q || (d < 4 ? p === R : p === Bq)) return true;
          break;
        }
      }
    }
    return false;
  };

  // List of squares holding pieces of side `by` that attack `sq`.
  Position.prototype.attackers = function (sq, by) {
    var b = this.board, out = [], i, t, p, ray, d;
    var white = by === 'w';
    var r = row(sq), c = col(sq);
    var pr = white ? r + 1 : r - 1;
    var pawn = white ? 'P' : 'p';
    if (pr >= 0 && pr < 8) {
      if (c > 0 && b[pr * 8 + c - 1] === pawn) out.push(pr * 8 + c - 1);
      if (c < 7 && b[pr * 8 + c + 1] === pawn) out.push(pr * 8 + c + 1);
    }
    var N = white ? 'N' : 'n', K = white ? 'K' : 'k', Bq = white ? 'B' : 'b', R = white ? 'R' : 'r', Q = white ? 'Q' : 'q';
    t = KNIGHT[sq];
    for (i = 0; i < t.length; i++) if (b[t[i]] === N) out.push(t[i]);
    t = KING[sq];
    for (i = 0; i < t.length; i++) if (b[t[i]] === K) out.push(t[i]);
    for (d = 0; d < 8; d++) {
      ray = RAYS[sq][d];
      for (i = 0; i < ray.length; i++) {
        p = b[ray[i]];
        if (p) {
          if (p === Q || (d < 4 ? p === R : p === Bq)) out.push(ray[i]);
          break;
        }
      }
    }
    return out;
  };

  Position.prototype.inCheck = function (side) {
    side = side || this.turn;
    var k = this.kings[side];
    return k >= 0 && this.attacked(k, side === 'w' ? 'b' : 'w');
  };

  // Pseudo-legal move generation
  Position.prototype.pseudo = function (capturesOnly) {
    var moves = [], b = this.board, side = this.turn, white = side === 'w';
    for (var s = 0; s < 64; s++) {
      var p = b[s];
      if (!p || isWhite(p) !== white) continue;
      var t = typeOf(p), i, to, q, ray, d;
      if (t === 'p') {
        var dir = white ? -8 : 8, startRow = white ? 6 : 1, promoRow = white ? 0 : 7;
        var r = row(s), c = col(s);
        to = s + dir;
        if (to >= 0 && to < 64 && !b[to]) {
          if (row(to) === promoRow) this._promos(moves, s, to, null);
          else if (!capturesOnly) {
            moves.push({ from: s, to: to, piece: p, captured: null });
            if (r === startRow && !b[to + dir]) moves.push({ from: s, to: to + dir, piece: p, captured: null, flag: 'd' });
          }
        }
        for (var dc = -1; dc <= 1; dc += 2) {
          var cc = c + dc;
          if (cc < 0 || cc > 7) continue;
          to = s + dir + dc;
          if (to < 0 || to >= 64) continue;
          q = b[to];
          if (q && isWhite(q) !== white) {
            if (row(to) === promoRow) this._promos(moves, s, to, q);
            else moves.push({ from: s, to: to, piece: p, captured: q });
          } else if (to === this.ep) {
            moves.push({ from: s, to: to, piece: p, captured: white ? 'p' : 'P', flag: 'e' });
          }
        }
      } else if (t === 'n' || t === 'k') {
        var tbl = t === 'n' ? KNIGHT[s] : KING[s];
        for (i = 0; i < tbl.length; i++) {
          to = tbl[i]; q = b[to];
          if (!q) { if (!capturesOnly) moves.push({ from: s, to: to, piece: p, captured: null }); }
          else if (isWhite(q) !== white) moves.push({ from: s, to: to, piece: p, captured: q });
        }
        if (t === 'k' && !capturesOnly) this._castles(moves, s, p);
      } else {
        var d0 = t === 'b' ? 4 : 0, d1 = t === 'r' ? 4 : 8;
        for (d = d0; d < d1; d++) {
          ray = RAYS[s][d];
          for (i = 0; i < ray.length; i++) {
            to = ray[i]; q = b[to];
            if (!q) { if (!capturesOnly) moves.push({ from: s, to: to, piece: p, captured: null }); }
            else { if (isWhite(q) !== white) moves.push({ from: s, to: to, piece: p, captured: q }); break; }
          }
        }
      }
    }
    return moves;
  };

  Position.prototype._promos = function (moves, s, to, cap) {
    var p = this.board[s], white = isWhite(p);
    var list = ['q', 'n', 'r', 'b'];
    for (var i = 0; i < 4; i++) moves.push({ from: s, to: to, piece: p, captured: cap, promo: white ? list[i].toUpperCase() : list[i] });
  };

  Position.prototype._castles = function (moves, s, p) {
    var b = this.board;
    if (p === 'K' && s === 60) {
      if (this.castle.K && b[63] === 'R' && !b[61] && !b[62] && !this.attacked(60, 'b') && !this.attacked(61, 'b') && !this.attacked(62, 'b'))
        moves.push({ from: 60, to: 62, piece: p, captured: null, flag: 'k' });
      if (this.castle.Q && b[56] === 'R' && !b[59] && !b[58] && !b[57] && !this.attacked(60, 'b') && !this.attacked(59, 'b') && !this.attacked(58, 'b'))
        moves.push({ from: 60, to: 58, piece: p, captured: null, flag: 'q' });
    } else if (p === 'k' && s === 4) {
      if (this.castle.k && b[7] === 'r' && !b[5] && !b[6] && !this.attacked(4, 'w') && !this.attacked(5, 'w') && !this.attacked(6, 'w'))
        moves.push({ from: 4, to: 6, piece: p, captured: null, flag: 'k' });
      if (this.castle.q && b[0] === 'r' && !b[3] && !b[2] && !b[1] && !this.attacked(4, 'w') && !this.attacked(3, 'w') && !this.attacked(2, 'w'))
        moves.push({ from: 4, to: 2, piece: p, captured: null, flag: 'q' });
    }
  };

  Position.prototype.make = function (m) {
    var b = this.board;
    this.stack.push({ castle: { K: this.castle.K, Q: this.castle.Q, k: this.castle.k, q: this.castle.q }, ep: this.ep, half: this.half, full: this.full });
    b[m.to] = m.promo || m.piece;
    b[m.from] = null;
    if (m.flag === 'e') {
      b[row(m.from) * 8 + col(m.to)] = null;
    } else if (m.flag === 'k') {
      b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null;
    } else if (m.flag === 'q') {
      b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null;
    }
    if (m.piece === 'K') { this.kings.w = m.to; this.castle.K = this.castle.Q = false; }
    else if (m.piece === 'k') { this.kings.b = m.to; this.castle.k = this.castle.q = false; }
    if (m.from === 63 || m.to === 63) this.castle.K = false;
    if (m.from === 56 || m.to === 56) this.castle.Q = false;
    if (m.from === 7 || m.to === 7) this.castle.k = false;
    if (m.from === 0 || m.to === 0) this.castle.q = false;
    this.ep = m.flag === 'd' ? (m.from + m.to) >> 1 : -1;
    this.half = (typeOf(m.piece) === 'p' || m.captured) ? 0 : this.half + 1;
    if (this.turn === 'b') this.full++;
    this.turn = this.turn === 'w' ? 'b' : 'w';
  };

  Position.prototype.unmake = function (m) {
    var b = this.board, st = this.stack.pop();
    this.castle = st.castle; this.ep = st.ep; this.half = st.half; this.full = st.full;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    b[m.from] = m.piece;
    if (m.flag === 'e') {
      b[m.to] = null;
      b[row(m.from) * 8 + col(m.to)] = m.captured;
    } else {
      b[m.to] = m.captured;
    }
    if (m.flag === 'k') { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = null; }
    else if (m.flag === 'q') { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = null; }
    if (m.piece === 'K') this.kings.w = m.from;
    else if (m.piece === 'k') this.kings.b = m.from;
  };

  Position.prototype.moves = function () {
    var ps = this.pseudo(false), out = [], side = this.turn;
    for (var i = 0; i < ps.length; i++) {
      this.make(ps[i]);
      if (!this.inCheck(side)) out.push(ps[i]);
      this.unmake(ps[i]);
    }
    return out;
  };

  Position.prototype.movesFrom = function (sq) {
    return this.moves().filter(function (m) { return m.from === sq; });
  };

  Position.prototype.uci = function (m) { return sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : ''); };

  Position.prototype.findUci = function (u) {
    var ms = this.moves();
    for (var i = 0; i < ms.length; i++) if (this.uci(ms[i]) === u) return ms[i];
    // allow promotion without suffix -> queen
    for (i = 0; i < ms.length; i++) if (this.uci(ms[i]) === u + 'q') return ms[i];
    return null;
  };

  Position.prototype.san = function (m, legal) {
    var s;
    if (m.flag === 'k') s = 'O-O';
    else if (m.flag === 'q') s = 'O-O-O';
    else {
      var t = typeOf(m.piece);
      legal = legal || this.moves();
      if (t === 'p') {
        s = m.captured ? FILES[col(m.from)] + 'x' : '';
        s += sqName(m.to);
        if (m.promo) s += '=' + m.promo.toUpperCase();
      } else {
        s = t.toUpperCase();
        var others = legal.filter(function (o) { return o.piece === m.piece && o.to === m.to && o.from !== m.from; });
        if (others.length) {
          var sameFile = others.some(function (o) { return col(o.from) === col(m.from); });
          var sameRank = others.some(function (o) { return row(o.from) === row(m.from); });
          if (!sameFile) s += FILES[col(m.from)];
          else if (!sameRank) s += (8 - row(m.from));
          else s += sqName(m.from);
        }
        if (m.captured) s += 'x';
        s += sqName(m.to);
      }
    }
    this.make(m);
    if (this.inCheck()) s += this.moves().length === 0 ? '#' : '+';
    this.unmake(m);
    return s;
  };

  Position.prototype.insufficient = function () {
    var minors = 0, others = 0;
    for (var i = 0; i < 64; i++) {
      var p = this.board[i];
      if (!p) continue;
      var t = typeOf(p);
      if (t === 'k') continue;
      if (t === 'n' || t === 'b') minors++;
      else others++;
    }
    return others === 0 && minors <= 1;
  };

  // ---------- Evaluation (from side-to-move's perspective) ----------
  Position.prototype.evaluate = function () {
    var b = this.board, score = 0, nonPawn = 0, i, p;
    for (i = 0; i < 64; i++) {
      p = b[i];
      if (p) { var t = typeOf(p); if (t !== 'p' && t !== 'k') nonPawn += VALUE[t]; }
    }
    var endgame = nonPawn <= 1300;
    for (i = 0; i < 64; i++) {
      p = b[i];
      if (!p) continue;
      var tp = typeOf(p), w = isWhite(p);
      var idx = w ? i : mirror(i);
      var tbl = tp === 'k' ? (endgame ? PST.kEnd : PST.k) : PST[tp];
      var v = (tp === 'k' ? 0 : VALUE[tp]) + tbl[idx];
      score += w ? v : -v;
    }
    return this.turn === 'w' ? score : -score;
  };

  // ---------- Search ----------
  function Searcher(pos, deadline) {
    this.pos = pos; this.deadline = deadline || Infinity; this.nodes = 0; this.aborted = false;
    this.killers = [];
  }

  function orderScore(m, killer) {
    if (m.captured) return 10000 + VALUE[typeOf(m.captured)] * 10 - VALUE[typeOf(m.piece)] / 10;
    if (m.promo) return 9000;
    if (killer && killer.from === m.from && killer.to === m.to) return 5000;
    return 0;
  }

  Searcher.prototype.order = function (moves, ply) {
    var k = this.killers[ply];
    for (var i = 0; i < moves.length; i++) moves[i]._o = orderScore(moves[i], k);
    moves.sort(function (a, b) { return b._o - a._o; });
    return moves;
  };

  Searcher.prototype.timeUp = function () {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) this.aborted = true;
    return this.aborted;
  };

  Searcher.prototype.qsearch = function (alpha, beta, qdepth) {
    if (this.timeUp()) return 0;
    var pos = this.pos;
    var stand = pos.evaluate();
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qdepth > 6) return alpha;
    var moves = this.order(pos.pseudo(true), 99), side = pos.turn;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      if (m.promo && typeOf(m.promo) !== 'q') continue;
      pos.make(m);
      if (pos.inCheck(side)) { pos.unmake(m); continue; }
      var sc = -this.qsearch(-beta, -alpha, qdepth + 1);
      pos.unmake(m);
      if (this.aborted) return 0;
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  };

  Searcher.prototype.negamax = function (depth, alpha, beta, ply) {
    if (this.timeUp()) return 0;
    var pos = this.pos, side = pos.turn;
    var check = pos.inCheck(side);
    if (check && ply < 12) depth++;
    if (depth <= 0) return this.qsearch(alpha, beta, 0);
    if (pos.half >= 100) return 0;
    var moves = this.order(pos.pseudo(false), ply), legal = 0;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      pos.make(m);
      if (pos.inCheck(side)) { pos.unmake(m); continue; }
      legal++;
      var sc = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      pos.unmake(m);
      if (this.aborted) return 0;
      if (sc >= beta) {
        if (!m.captured) this.killers[ply] = m;
        return beta;
      }
      if (sc > alpha) alpha = sc;
    }
    if (!legal) return check ? -MATE + ply : 0;
    return alpha;
  };

  // Exact score for every root move at fixed depth (used for weaker bots + coach).
  function scoreAllMoves(pos, depth, deadline) {
    var p = pos.clone(), s = new Searcher(p, deadline);
    var moves = s.order(p.moves(), 0), out = [];
    for (var i = 0; i < moves.length; i++) {
      p.make(moves[i]);
      var sc = -s.negamax(depth - 1, -MATE - 1, MATE + 1, 1);
      p.unmake(moves[i]);
      if (s.aborted) break;
      out.push({ move: moves[i], score: sc });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return { list: out, complete: !s.aborted };
  }

  // Iterative-deepening best-move search.
  function bestMove(pos, opts) {
    opts = opts || {};
    var maxDepth = opts.maxDepth || 4, timeMs = opts.timeMs || 1000;
    var start = Date.now(), deadline = start + timeMs;
    var p = pos.clone();
    var rootMoves = p.moves();
    if (!rootMoves.length) return null;
    var best = { move: rootMoves[0], score: -MATE - 1, depth: 0 };
    var s = new Searcher(p, deadline);
    rootMoves = s.order(rootMoves, 0);
    for (var depth = 1; depth <= maxDepth; depth++) {
      var alpha = -MATE - 1, beta = MATE + 1, iterBest = null, iterScore = -MATE - 1;
      for (var i = 0; i < rootMoves.length; i++) {
        var m = rootMoves[i];
        p.make(m);
        var sc = -s.negamax(depth - 1, -beta, -alpha, 1);
        p.unmake(m);
        if (s.aborted) break;
        if (sc > iterScore) { iterScore = sc; iterBest = m; }
        if (sc > alpha) alpha = sc;
      }
      if (s.aborted) {
        // keep partial result only if it found something better than the previous best move
        if (iterBest && iterBest === rootMoves[0] && iterScore > best.score) best = { move: iterBest, score: iterScore, depth: depth };
        break;
      }
      best = { move: iterBest, score: iterScore, depth: depth };
      // move best to front for the next iteration
      var idx = rootMoves.indexOf(iterBest);
      rootMoves.splice(idx, 1); rootMoves.unshift(iterBest);
      if (iterScore > MATE - 100) break; // found a mate
      if (Date.now() - start > timeMs * 0.5) break; // next depth would not finish
    }
    best.nodes = s.nodes;
    return best;
  }

  global.ChessEngine = {
    START_FEN: START_FEN, VALUE: VALUE, NAMES: NAMES, MATE: MATE,
    Position: Position, bestMove: bestMove, scoreAllMoves: scoreAllMoves,
    sqName: sqName, sqFromName: sqFromName, colorOf: colorOf, typeOf: typeOf, row: row, col: col
  };
})(typeof window !== 'undefined' ? window : globalThis);
