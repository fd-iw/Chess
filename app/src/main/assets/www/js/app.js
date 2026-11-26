/* Christian's Chess Academy - app logic */
(function () {
  'use strict';
  var E = window.ChessEngine, D = window.ChessData;
  var $ = function (id) { return document.getElementById(id); };
  var MATE = E.MATE;

  // ---------------------------------------------------------------- storage
  var KEY = 'cca_save_v1';
  function defaults() {
    return {
      xp: 0, unlocked: 1, stars: {}, games: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0,
      puzzles: {}, lessons: {}, ach: {}, saved: null,
      settings: { coach: true, danger: true, legal: true, evalbar: true, sound: true }
    };
  }
  var S = (function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = defaults(), o = JSON.parse(raw);
        for (var k in d) if (!(k in o)) o[k] = d[k];
        for (k in d.settings) if (!(k in o.settings)) o.settings[k] = d.settings[k];
        return o;
      }
    } catch (e) { /* ignore */ }
    return defaults();
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- sound
  var actx = null;
  function beep(freq, dur, type, vol, delay) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t = actx.currentTime + (delay || 0);
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) { /* no audio */ }
  }
  var sfx = {
    move: function () { beep(420, 0.07, 'square', 0.12); },
    capture: function () { beep(220, 0.12, 'square', 0.2); beep(160, 0.1, 'square', 0.15, 0.04); },
    check: function () { beep(660, 0.1, 'triangle', 0.25); beep(880, 0.12, 'triangle', 0.25, 0.1); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { beep(f, 0.18, 'triangle', 0.25, i * 0.12); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { beep(f, 0.22, 'sine', 0.25, i * 0.15); }); },
    good: function () { beep(880, 0.1, 'sine', 0.2); beep(1175, 0.15, 'sine', 0.2, 0.08); },
    bad: function () { beep(200, 0.25, 'sawtooth', 0.12); }
  };

  // ---------------------------------------------------------------- helpers
  function pieceImg(p) { return 'pieces/' + E.colorOf(p) + E.typeOf(p).toUpperCase() + '.svg'; }
  function pname(p) { return E.NAMES[E.typeOf(p)]; }
  function opp(c) { return c === 'w' ? 'b' : 'w'; }
  function rankFor(xp) { var r = D.RANKS[0], next = null; for (var i = 0; i < D.RANKS.length; i++) { if (xp >= D.RANKS[i].xp) r = D.RANKS[i]; else { next = D.RANKS[i]; break; } } return { rank: r, next: next }; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cp(score) { return Math.max(-3000, Math.min(3000, score)); }

  // Pieces of `color` that can be won: attacked and either undefended or attacked by a cheaper piece.
  function hangingPieces(pos, color) {
    var out = [];
    for (var s = 0; s < 64; s++) {
      var p = pos.board[s];
      if (!p || E.colorOf(p) !== color || E.typeOf(p) === 'k') continue;
      var att = pos.attackers(s, opp(color));
      if (!att.length) continue;
      var val = E.VALUE[E.typeOf(p)], minAtt = 99999;
      att.forEach(function (a) { minAtt = Math.min(minAtt, E.VALUE[E.typeOf(pos.board[a])]); });
      var defended = pos.attacked(s, color);
      if (!defended || minAtt < val) out.push({ sq: s, piece: p, defended: defended, attacker: att.reduce(function (b, a) { return E.VALUE[E.typeOf(pos.board[a])] < E.VALUE[E.typeOf(pos.board[b])] ? a : b; }) });
    }
    out.sort(function (a, b) { return E.VALUE[E.typeOf(b.piece)] - E.VALUE[E.typeOf(a.piece)]; });
    return out;
  }

  // ---------------------------------------------------------------- board rendering
  function renderBoard(el, pos, o) {
    o = o || {};
    var html = '', targets = {}, i;
    (o.targets || []).forEach(function (m) { targets[m.to] = true; });
    var hint = {}; (o.hint || []).forEach(function (s) { hint[s] = true; });
    var danger = {}; (o.danger || []).forEach(function (s) { danger[s] = true; });
    var checkSq = -1;
    if (pos.inCheck()) checkSq = pos.kings[pos.turn];
    for (i = 0; i < 64; i++) {
      var s = o.flipped ? 63 - i : i, r = E.row(s), c = E.col(s);
      var cls = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
      if (o.last && (o.last.from === s || o.last.to === s)) cls += ' last';
      if (o.selected === s) cls += ' sel';
      if (hint[s]) cls += ' hintsq';
      if (danger[s]) cls += ' danger';
      if (s === checkSq) cls += ' check';
      var inner = '';
      var di = i, drow = di >> 3, dcol = di & 7;
      if (o.coords !== false) {
        if (drow === 7) inner += '<span class="coord f">' + 'abcdefgh'[c] + '</span>';
        if (dcol === 0) inner += '<span class="coord r">' + (8 - r) + '</span>';
      }
      var p = pos.board[s];
      if (p) inner += '<img src="' + pieceImg(p) + '" alt="">';
      if (targets[s]) inner += p ? '<span class="ring"></span>' : '<span class="dot"></span>';
      if (o.badge && o.badge.sq === s) inner += '<span class="badge" style="background:' + o.badge.color + '">' + o.badge.text + '</span>';
      html += '<div class="' + cls + '" data-sq="' + s + '">' + inner + '</div>';
    }
    el.innerHTML = html;
  }

  function drawArrows(svg, arrows, flipped) {
    var out = '';
    (arrows || []).forEach(function (a) {
      function ctr(s) { var d = flipped ? 63 - s : s; return [(d & 7) * 100 + 50, (d >> 3) * 100 + 50]; }
      var f = ctr(a.from), t = ctr(a.to);
      var dx = t[0] - f[0], dy = t[1] - f[1], len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
      var head = 34, w = 14, hw = 30;
      var ex = t[0] - ux * head, ey = t[1] - uy * head, nx = -uy, ny = ux;
      var sx = f[0] + ux * 20, sy = f[1] + uy * 20;
      var pts = [
        [sx + nx * w / 2, sy + ny * w / 2], [ex + nx * w / 2, ey + ny * w / 2], [ex + nx * hw / 2, ey + ny * hw / 2],
        [t[0], t[1]], [ex - nx * hw / 2, ey - ny * hw / 2], [ex - nx * w / 2, ey - ny * w / 2], [sx - nx * w / 2, sy - ny * w / 2]
      ].map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
      out += '<polygon points="' + pts + '" fill="' + (a.color || 'rgba(255,170,0,.85)') + '"/>';
    });
    svg.innerHTML = out;
  }

  // Generic tap-to-move controller
  function BoardController(el, cfg) {
    var self = this;
    this.selected = -1; this.targets = [];
    el.addEventListener('click', function (ev) {
      var t = ev.target.closest('.sq');
      if (!t) return;
      self.tap(parseInt(t.getAttribute('data-sq'), 10));
    });
    this.tap = function (sq) {
      if (!cfg.canMove()) return;
      var pos = cfg.getPos(), p = pos.board[sq];
      var ms = this.targets.filter(function (m) { return m.to === sq; });
      if (this.selected >= 0 && ms.length) {
        this.clear();
        if (ms.length > 1) choosePromotion(pos.turn, function (pr) {
          var m = ms.filter(function (x) { return x.promo.toLowerCase() === pr; })[0];
          cfg.onMove(m);
        }, function () { cfg.redraw(); });
        else cfg.onMove(ms[0]);
        return;
      }
      if (p && E.colorOf(p) === pos.turn && sq !== this.selected) {
        this.selected = sq;
        this.targets = pos.movesFrom(sq);
      } else this.clear();
      cfg.redraw();
    };
    this.clear = function () { this.selected = -1; this.targets = []; };
  }

  function choosePromotion(color, done, cancel) {
    var html = '<h2>Promote to…</h2><div class="promo">';
    ['q', 'r', 'b', 'n'].forEach(function (t) {
      var p = color === 'w' ? t.toUpperCase() : t;
      html += '<button data-pr="' + t + '"><img src="' + pieceImg(p) + '"></button>';
    });
    html += '</div><div class="btns"><button id="promo-cancel">Cancel</button></div>';
    showModal(html, true);
    document.querySelectorAll('.promo button').forEach(function (b) {
      b.onclick = function () { hideModal(); done(b.getAttribute('data-pr')); };
    });
    $('promo-cancel').onclick = function () { hideModal(); cancel(); };
  }

  // ---------------------------------------------------------------- modal & toast
  var modalClosable = true;
  function showModal(html, closable) { $('modal-box').innerHTML = html; $('modal').classList.add('show'); modalClosable = closable !== false; }
  function hideModal() { $('modal').classList.remove('show'); }
  $('modal').addEventListener('click', function (e) { if (e.target.id === 'modal' && modalClosable) hideModal(); });

  var toastQ = [], toastBusy = false;
  function toast(icon, title, sub) { toastQ.push([icon, title, sub]); if (!toastBusy) nextToast(); }
  function nextToast() {
    var t = toastQ.shift();
    if (!t) { toastBusy = false; return; }
    toastBusy = true;
    $('toast').innerHTML = '<span class="ic">' + t[0] + '</span><div>' + esc(t[1]) + (t[2] ? '<small>' + esc(t[2]) + '</small>' : '') + '</div>';
    $('toast').classList.add('show');
    setTimeout(function () { $('toast').classList.remove('show'); setTimeout(nextToast, 400); }, 2600);
  }

  // ---------------------------------------------------------------- achievements & xp
  function addXp(n) { S.xp += n; save(); }
  function award(id) {
    if (S.ach[id]) return;
    var a = D.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    S.ach[id] = Date.now(); S.xp += 25; save();
    toast(a.icon, 'Achievement unlocked: ' + a.name, a.desc + ' (+25 XP)');
    sfx.good();
  }

  // ---------------------------------------------------------------- navigation
  var current = 'home';
  var parentOf = { levels: 'home', puzzles: 'home', learn: 'home', awards: 'home', game: 'levels', puzzle: 'puzzles', lesson: 'learn' };
  function go(name) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $('screen-' + name).classList.add('active');
    current = name;
    if (name !== 'game' && G) G.token++; // stop pending bot moves
    if (name === 'home') renderHome();
    if (name === 'levels') renderLevels();
    if (name === 'puzzles') renderPuzzleList();
    if (name === 'learn') renderLessons();
    if (name === 'awards') renderAwards();
  }
  document.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-go')); }); });

  window.onAndroidBack = function () {
    if ($('modal').classList.contains('show')) { if (modalClosable) hideModal(); return true; }
    if (current === 'home') return false;
    if (current === 'game') { leaveGame(); return true; }
    go(parentOf[current] || 'home');
    return true;
  };

  // ---------------------------------------------------------------- home
  var TIPS = [
    'Before every move, ask: "Is the piece I\'m moving safe on its new square?"',
    'Checks, Captures, Threats — look at all three before you move.',
    'Castle early to keep your king safe.',
    'Knights on the rim are dim! Keep knights near the center.',
    'If your opponent moves a piece, ask "What is it attacking now?"',
    'Don\'t bring your queen out too early — she will get chased.',
    'Ahead in material? Trade pieces (not pawns) to make winning easier.',
    'Rooks love open files and the 7th rank.',
    'Watch out for Scholar\'s Mate: defend f7 (or f2) in the opening!',
    'Take your time. The biggest difference between you and 1000-rated players is checking for blunders.'
  ];
  function renderHome() {
    var rk = rankFor(S.xp);
    $('home-rank').textContent = rk.rank.name;
    $('home-xp').textContent = S.xp;
    var pct = rk.next ? (S.xp - rk.rank.xp) / (rk.next.xp - rk.rank.xp) * 100 : 100;
    $('home-xpfill').style.width = pct + '%';
    var nb = D.BOTS[Math.min(S.unlocked, 10) - 1];
    $('home-next').textContent = 'Next challenge: Level ' + nb.id + ' – ' + nb.name + ' (' + nb.elo + ')';
    $('home-puzzles').textContent = Object.keys(S.puzzles).length + ' / ' + D.PUZZLES.length + ' solved';
    $('home-awards').textContent = Object.keys(S.ach).length + ' / ' + D.ACHIEVEMENTS.length + ' unlocked';
    $('tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    if (S.saved) {
      var b = D.BOTS[S.saved.level - 1];
      $('btn-continue').style.display = '';
      $('continue-sub').textContent = 'vs ' + b.name + ' · move ' + (Math.floor(S.saved.moves.length / 2) + 1);
    } else $('btn-continue').style.display = 'none';
  }
  $('btn-continue').onclick = function () { if (S.saved) resumeGame(S.saved); };

  // ---------------------------------------------------------------- levels
  var colorChoice = 'w';
  document.querySelectorAll('#color-seg button').forEach(function (b) {
    b.onclick = function () {
      colorChoice = b.getAttribute('data-color');
      document.querySelectorAll('#color-seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
    };
  });
  function starStr(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
  function renderLevels() {
    var html = '';
    D.BOTS.forEach(function (b) {
      var locked = b.id > S.unlocked, st = S.stars[b.id] || 0;
      html += '<button class="level' + (locked ? ' locked' : '') + (b.id === S.unlocked ? ' current' : '') + '" data-lv="' + b.id + '">' +
        '<div class="lv-av">' + (locked ? '🔒' : b.avatar) + '</div><div class="lv-info"><div class="lv-num">LEVEL ' + b.id + '</div>' +
        '<div><span class="lv-name">' + esc(b.name) + '</span><span class="lv-elo">' + b.elo + '</span></div>' +
        '<div class="lv-blurb">' + esc(b.blurb) + '</div>' +
        '<div class="lv-stars" style="color:' + (st ? 'var(--gold)' : '#666') + '">' + (locked ? 'Beat level ' + (b.id - 1) + ' to unlock' : starStr(st)) + '</div></div></button>';
    });
    $('level-list').innerHTML = html;
    document.querySelectorAll('.level').forEach(function (el) {
      el.onclick = function () {
        var lv = parseInt(el.getAttribute('data-lv'), 10);
        if (lv > S.unlocked) { toast('🔒', 'Locked', 'Beat level ' + (lv - 1) + ' first!'); return; }
        var c = colorChoice === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
        if (S.saved) {
          showModal('<div class="big-emoji">♟️</div><h2>Start a new game?</h2><p>Your unfinished game will be lost.</p><div class="btns"><button class="green" id="ng-yes">New game</button><button id="ng-no">Cancel</button></div>');
          $('ng-yes').onclick = function () { hideModal(); startGame(lv, c); };
          $('ng-no').onclick = hideModal;
        } else startGame(lv, c);
      };
    });
  }

  // ---------------------------------------------------------------- game
  var G = null;
  var ctrl = new BoardController($('board'), {
    getPos: function () { return G.pos; },
    canMove: function () { return G && !G.over && !G.busy && G.pos.turn === G.color; },
    onMove: function (m) { playerMove(m); },
    redraw: function () { drawGame(); }
  });

  function newG(level, color) {
    return {
      level: level, bot: D.BOTS[level - 1], color: color, pos: new E.Position(), moves: [], sans: [], keys: [],
      hints: 0, takebacks: 0, blunders: 0, best: 0, over: false, busy: false, flipped: color === 'b',
      last: null, badge: null, arrows: [], hint: [], hintStage: 0, hintCache: null, evalW: 0, token: (G ? G.token + 1 : 1)
    };
  }

  function startGame(level, color) {
    G = newG(level, color);
    G.keys.push(G.pos.key());
    setupGameScreen();
    coachSay(G.color === 'w' ? 'You have the white pieces. Good luck, Christian! Tap a piece to see where it can go.' : 'You have black. ' + G.bot.name + ' moves first.');
    saveGame();
    go('game');
    drawGame();
    if (G.color !== 'w') botTurn();
  }

  function resumeGame(sv) {
    G = newG(sv.level, sv.color);
    G.keys.push(G.pos.key());
    sv.moves.forEach(function (u) { var m = G.pos.findUci(u); if (m) applyMove(m, true); });
    G.hints = sv.hints || 0; G.takebacks = sv.takebacks || 0; G.blunders = sv.blunders || 0; G.best = sv.best || 0;
    setupGameScreen();
    coachSay('Welcome back! Let\'s continue your game against ' + G.bot.name + '.');
    go('game');
    drawGame();
    if (G.pos.turn !== G.color) botTurn();
  }

  function setupGameScreen() {
    $('game-title').textContent = 'Level ' + G.level + ' · ' + G.bot.name;
    $('opp-avatar').textContent = G.bot.avatar;
    $('opp-name').textContent = G.bot.name;
    $('opp-elo').textContent = '(' + G.bot.elo + ')';
    $('me-rank').textContent = rankFor(S.xp).rank.name;
    ctrl.clear();
  }

  function saveGame() {
    if (!G || G.over) return;
    S.saved = { level: G.level, color: G.color, moves: G.moves.slice(), hints: G.hints, takebacks: G.takebacks, blunders: G.blunders, best: G.best };
    save();
  }

  function leaveGame() { if (G) G.token++; go('levels'); }
  $('game-back').onclick = leaveGame;

  function drawGame() {
    if (!G) return;
    var danger = [];
    if (S.settings.danger && !G.over && G.pos.turn === G.color && !G.busy) danger = hangingPieces(G.pos, G.color).map(function (h) { return h.sq; });
    renderBoard($('board'), G.pos, {
      flipped: G.flipped, selected: ctrl.selected, targets: S.settings.legal ? ctrl.targets : [], last: G.last,
      hint: G.hint, danger: danger, badge: G.badge
    });
    drawArrows($('arrows'), G.arrows, G.flipped);
    // move list
    var mv = '';
    for (var i = 0; i < G.sans.length; i += 2) {
      mv += '<span class="mv' + (i >= G.sans.length - 2 ? ' cur' : '') + '"><b>' + (i / 2 + 1) + '.</b>' + esc(G.sans[i]) + (G.sans[i + 1] ? ' ' + esc(G.sans[i + 1]) : '') + '</span>';
    }
    $('moves').innerHTML = mv || '<span class="mv">Moves will appear here</span>';
    $('moves').scrollLeft = 99999;
    // captured + material
    drawCaptured();
    // eval bar
    var eb = $('evalbar');
    eb.style.display = S.settings.evalbar ? '' : 'none';
    eb.classList.toggle('flipped', G.flipped);
    var e = G.evalW, pct;
    if (Math.abs(e) > MATE - 200) pct = e > 0 ? 100 : 0;
    else pct = 50 + 50 * (2 / (1 + Math.exp(-e / 400)) - 1);
    $('evalfill').style.height = Math.max(3, Math.min(97, pct)) + '%';
    $('evaltext').textContent = Math.abs(e) > MATE - 200 ? 'M' : (Math.abs(e / 100)).toFixed(1);
    $('opp-row').classList.toggle('thinking', G.busy && G.pos.turn !== G.color && !G.over);
    $('btn-hint').disabled = G.over;
    $('btn-undo').disabled = G.over || G.moves.length < 1;
  }

  function drawCaptured() {
    var start = { p: 8, n: 2, b: 2, r: 2, q: 1 }, cnt = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    var mat = { w: 0, b: 0 };
    G.pos.board.forEach(function (p) { if (p && E.typeOf(p) !== 'k') { cnt[E.colorOf(p)][E.typeOf(p)]++; mat[E.colorOf(p)] += { p: 1, n: 3, b: 3, r: 5, q: 9 }[E.typeOf(p)]; } });
    function capturedBy(side) { // pieces of the other side that `side` captured
      var o = opp(side), html = '';
      ['q', 'r', 'b', 'n', 'p'].forEach(function (t) {
        var n = Math.max(0, start[t] - cnt[o][t]);
        for (var i = 0; i < n; i++) html += '<img src="' + pieceImg(o === 'w' ? t.toUpperCase() : t) + '">';
      });
      var adv = mat[side] - mat[o];
      if (adv > 0) html += '<span class="adv">+' + adv + '</span>';
      return html;
    }
    $('me-captured').innerHTML = capturedBy(G.color);
    $('opp-captured').innerHTML = capturedBy(opp(G.color));
  }

  function coachSay(html) { $('coach-msg').innerHTML = html; }

  // Apply a move to the game (both sides). Returns SAN.
  function applyMove(m, silent) {
    var pos = G.pos, mover = pos.turn;
    var san = pos.san(m);
    if (mover === G.color && !silent) {
      if (m.flag === 'k' || m.flag === 'q') award('castle');
      if (m.promo) award('promote');
      if (m.flag === 'e') award('en_passant');
    }
    pos.make(m);
    G.moves.push(pos.uci(m));
    G.sans.push(san);
    G.keys.push(pos.key());
    G.last = { from: m.from, to: m.to };
    G.hint = []; G.hintStage = 0; G.hintCache = null;
    if (!silent) {
      if (san.indexOf('+') >= 0 || san.indexOf('#') >= 0) sfx.check();
      else if (m.captured) sfx.capture();
      else sfx.move();
    }
    return san;
  }

  function gameResult() {
    var pos = G.pos, legal = pos.moves();
    if (!legal.length) {
      if (pos.inCheck()) return { winner: opp(pos.turn), reason: 'checkmate' };
      return { winner: null, reason: 'stalemate' };
    }
    if (pos.insufficient()) return { winner: null, reason: 'insufficient material' };
    if (pos.half >= 100) return { winner: null, reason: '50-move rule' };
    var k = G.keys[G.keys.length - 1], n = 0;
    G.keys.forEach(function (x) { if (x === k) n++; });
    if (n >= 3) return { winner: null, reason: 'repetition' };
    return null;
  }

  function playerMove(m) {
    var token = G.token;
    var pre = G.pos.clone();
    G.arrows = []; G.badge = null;
    applyMove(m);
    var res = gameResult();
    if (res) { G.busy = false; drawGame(); saveGame(); return endGame(res); }
    saveGame();
    if (!S.settings.coach) { drawGame(); return botTurn(); }
    G.busy = true;
    drawGame();
    coachSay('🤔 …');
    setTimeout(function () {
      if (!G || G.token !== token) return;
      var fb = analyzeMove(pre, m);
      G.evalW = pre.turn === 'w' ? fb.playedScore : -fb.playedScore;
      G.badge = { sq: m.to, text: fb.badge, color: fb.color };
      if (fb.cls === 'best') G.best++;
      if (fb.cls === 'blunder') G.blunders++;
      saveGame();
      if (fb.cls === 'blunder' || fb.cls === 'mistake') {
        sfx.bad();
        G.arrows = [{ from: fb.bestMove.from, to: fb.bestMove.to, color: 'rgba(129,182,76,.9)' }];
        coachSay('<b class="' + fb.cls + '">' + fb.label + '</b> ' + fb.text +
          '<br><button class="mini green" id="c-takeback">↩️ Take back</button><button class="mini" id="c-continue">Continue ▶</button>');
        drawGame();
        $('c-takeback').onclick = function () { if (G.token !== token) return; G.busy = false; undo(true); };
        $('c-continue').onclick = function () { if (G.token !== token) return; G.arrows = []; G.busy = false; botTurn(); };
        return;
      }
      if (fb.cls === 'best' && G.best === 10) award('sharp');
      coachSay('<b class="' + fb.cls + '">' + fb.label + '</b> ' + fb.text);
      G.busy = false;
      botTurn();
    }, 30);
  }

  // Compare the played move with the best move.
  function analyzeMove(pre, played) {
    var r = E.scoreAllMoves(pre, 2);
    var deep = E.scoreAllMoves(pre, 3, Date.now() + 1800);
    if (deep.complete) r = deep;
    var list = r.list, best = list[0], uci = pre.uci(played);
    var mine = list.filter(function (x) { return pre.uci(x.move) === uci; })[0] || best;
    var loss = cp(best.score) - cp(mine.score);
    var bestSan = pre.san(best.move);
    var out = { bestMove: best.move, playedScore: mine.score, bestSan: bestSan };
    var after = pre.clone(); after.make(played);
    var me = pre.turn;

    if (mine.score >= best.score || loss <= 15) { out.cls = 'best'; out.label = 'Best move!'; out.badge = '★'; out.color = '#81b64c'; }
    else if (loss < 60 || (mine.score > 700 && best.score < MATE - 200)) { out.cls = 'good'; out.label = 'Good move.'; out.badge = '✓'; out.color = '#95b776'; }
    else if (loss < 130) { out.cls = 'inacc'; out.label = 'Inaccuracy.'; out.badge = '?!'; out.color = '#f7c631'; }
    else if (loss < 300) { out.cls = 'mistake'; out.label = 'Mistake.'; out.badge = '?'; out.color = '#ffa459'; }
    else { out.cls = 'blunder'; out.label = 'Blunder!'; out.badge = '??'; out.color = '#fa412d'; }
    if (best.score > MATE - 200 && mine.score < MATE - 200 && out.cls !== 'blunder') { out.cls = 'mistake'; out.label = 'Missed checkmate!'; out.badge = '?'; out.color = '#ffa459'; }

    if (out.cls === 'best' || out.cls === 'good') {
      if (mine.score > MATE - 200) out.text = 'You have a forced checkmate — find it!';
      else if (played.captured) out.text = 'Nice capture.';
      else if (after.inCheck()) out.text = 'Check!';
      else out.text = ['Keep it up.', 'Well played.', 'Solid.', 'Good thinking.'][Math.floor(Math.random() * 4)];
      if (out.cls === 'good' && loss >= 30) out.text += ' (' + bestSan + ' was even better.)';
      return out;
    }
    // explain what went wrong
    var hang = hangingPieces(after, me);
    var movedHang = hang.filter(function (h) { return h.sq === played.to; })[0];
    var text;
    if (mine.score < -(MATE - 200)) text = 'This lets ' + G.bot.name + ' checkmate you! ';
    else if (best.score > MATE - 200) text = 'You had checkmate with <b>' + bestSan + '</b>! ';
    else if (movedHang) text = 'Your ' + pname(movedHang.piece) + ' on ' + E.sqName(movedHang.sq) + ' can be taken' + (movedHang.defended ? ' by a cheaper ' + pname(after.board[movedHang.attacker]) + '. ' : ' for free. ');
    else if (hang.length && !hangingPieces(pre, me).some(function (h) { return h.sq === hang[0].sq; })) text = 'This leaves your ' + pname(hang[0].piece) + ' on ' + E.sqName(hang[0].sq) + ' unprotected. ';
    else if (hang.length) text = 'Your ' + pname(hang[0].piece) + ' on ' + E.sqName(hang[0].sq) + ' was under attack — you needed to save it. ';
    else if (best.move.captured) text = 'You could have captured the ' + pname(best.move.captured) + ' on ' + E.sqName(best.move.to) + '. ';
    else text = 'This gives ' + G.bot.name + ' a strong reply. ';
    if (best.score <= MATE - 200) text += 'Better was <b>' + bestSan + '</b>.';
    out.text = text;
    return out;
  }

  function botTurn() {
    if (!G || G.over) return;
    var token = G.token;
    G.busy = true;
    drawGame();
    setTimeout(function () {
      if (!G || G.token !== token || G.over) return;
      var choice = chooseBotMove(G.bot, G.pos);
      if (!G || G.token !== token) return;
      var m = choice.move;
      G.badge = null;
      var san = applyMove(m);
      if (choice.score !== undefined) G.evalW = G.pos.turn === 'w' ? -choice.score : choice.score;
      G.busy = false;
      var res = gameResult();
      saveGame();
      drawGame();
      if (res) return endGame(res);
      if (S.settings.coach) coachAfterBot(m, san);
    }, 350);
  }

  function chooseBotMove(bot, pos) {
    if (bot.full) {
      var b = E.bestMove(pos, { maxDepth: bot.maxDepth, timeMs: bot.timeMs });
      return { move: b.move, score: b.score };
    }
    var r = E.scoreAllMoves(pos, bot.depth).list, bestI = 0, bestV = -Infinity;
    for (var i = 0; i < r.length; i++) {
      var sc = r[i].score;
      if (bot.id <= 3 && Math.random() < 0.5) sc = Math.max(-1500, Math.min(1500, sc)); // weak bots sometimes miss mates
      var v = sc + Math.random() * bot.noise;
      if (v > bestV) { bestV = v; bestI = i; }
    }
    return { move: r[bestI].move, score: r[bestI].score };
  }

  // After the bot moves, warn about threats and opportunities (the "nudge").
  function coachAfterBot(m, san) {
    var pos = G.pos, me = G.color;
    var hang = hangingPieces(pos, me), free = hangingPieces(pos, opp(me));
    var msg = G.bot.name + ' played <b>' + esc(san) + '</b>. ';
    if (pos.inCheck()) msg += '⚠️ You are in <b>check</b>! Protect your king.';
    else if (m.captured && E.colorOf(m.captured) === me && !hang.length) msg += 'They took your ' + pname(m.captured) + '. Can you take something back?';
    else if (hang.length) msg += '⚠️ Watch out! Your <b>' + pname(hang[0].piece) + '</b> on ' + E.sqName(hang[0].sq) + ' is in danger.';
    else if (free.length) msg += '👀 Look carefully… is there something you can capture?';
    else msg += 'Your move. Remember: checks, captures, threats!';
    coachSay(msg);
  }

  // ---- hint
  $('btn-hint').onclick = function () {
    if (!G || G.over || G.busy || G.pos.turn !== G.color) return;
    if (!G.hintCache) {
      coachSay('🤔 Thinking of a hint…');
      G.busy = true;
      setTimeout(function () {
        G.hintCache = E.bestMove(G.pos, { maxDepth: 4, timeMs: 1200 });
        G.busy = false;
        G.hints++; saveGame();
        showHint();
      }, 30);
      return;
    }
    showHint();
  };
  function showHint() {
    var h = G.hintCache, m = h.move, san = G.pos.san(m);
    G.hintStage++;
    if (G.hintStage === 1) {
      G.hint = [m.from];
      var extra = '';
      if (h.score > MATE - 200) extra = 'There is a checkmate here! ';
      else if (m.captured) extra = 'Something can be captured! ';
      else if (san.indexOf('+') >= 0) extra = 'Look for a check! ';
      var danger = hangingPieces(G.pos, G.color);
      if (!extra && danger.length && danger[0].sq === m.from) extra = 'This piece is in danger! ';
      coachSay('💡 ' + extra + 'Try moving your <b>' + pname(m.piece) + '</b> on ' + E.sqName(m.from) + '. <small>(Tap Hint again to see the move.)</small>');
    } else {
      G.hint = [m.from, m.to];
      G.arrows = [{ from: m.from, to: m.to, color: 'rgba(66,165,245,.9)' }];
      coachSay('💡 The best move is <b>' + esc(san) + '</b>.');
    }
    drawGame();
  }

  // ---- undo
  function undo(fromCoach) {
    if (!G || G.over || G.busy) return;
    if (!G.moves.length) return;
    var n = G.pos.turn === G.color ? 2 : 1;
    if (G.moves.length < n) n = G.moves.length;
    var keep = G.moves.slice(0, G.moves.length - n);
    if (G.color === 'b' && keep.length === 0) keep = G.moves.slice(0, 1); // keep the bot's first move
    if (keep.length === G.moves.length) return;
    var tb = G.takebacks + 1, hints = G.hints, bl = G.blunders, best = G.best, token = G.token;
    var lvl = G.level, col = G.color, flipped = G.flipped;
    G = newG(lvl, col); G.token = token + 1; G.flipped = flipped;
    G.keys.push(G.pos.key());
    keep.forEach(function (u) { applyMove(G.pos.findUci(u), true); });
    G.takebacks = tb; G.hints = hints; G.blunders = Math.max(0, bl - (fromCoach ? 1 : 0)); G.best = best;
    ctrl.clear();
    saveGame();
    coachSay(fromCoach ? 'Move taken back. Look at the green arrow idea, or find your own safe move!' : 'Move taken back.');
    drawGame();
    if (G.pos.turn !== G.color) botTurn();
  }
  $('btn-undo').onclick = function () { undo(false); };
  $('btn-flip').onclick = function () { if (G) { G.flipped = !G.flipped; drawGame(); } };
  $('btn-resign').onclick = function () {
    if (!G || G.over) return;
    showModal('<div class="big-emoji">🏳️</div><h2>Resign?</h2><p>Are you sure you want to give up this game?</p><div class="btns"><button id="rs-yes">Resign</button><button class="green" id="rs-no">Keep playing</button></div>');
    $('rs-yes').onclick = function () { hideModal(); endGame({ winner: opp(G.color), reason: 'resignation' }); };
    $('rs-no').onclick = hideModal;
  };

  function endGame(res) {
    G.over = true; G.busy = false; G.token++;
    S.saved = null;
    S.games++;
    var win = res.winner === G.color, draw = res.winner === null;
    var xp = 0, stars = 0, html;
    var myMoves = Math.ceil(G.moves.length / 2);
    award('first_game');
    if (S.games >= 10) award('games10');
    if (S.games >= 50) award('games50');
    if (win) {
      S.wins++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
      var help = G.hints + G.takebacks;
      stars = help === 0 ? 3 : help <= 3 ? 2 : 1;
      S.stars[G.level] = Math.max(S.stars[G.level] || 0, stars);
      var unlockedNew = G.level === S.unlocked && G.level < 10;
      if (G.level >= S.unlocked) S.unlocked = Math.min(10, G.level + 1);
      xp = 40 + G.level * 20 + stars * 10;
      save();
      award('first_win');
      if (G.level >= 3) award('beat_3');
      if (G.level >= 5) award('beat_5');
      if (G.level >= 7) award('beat_7');
      if (G.level >= 10) award('beat_10');
      if (help === 0) award('no_hints');
      if (S.settings.coach && G.blunders === 0) award('clean');
      if (myMoves <= 25) award('speedy');
      if (S.streak >= 3) award('streak3');
      var all3 = D.BOTS.every(function (b) { return (S.stars[b.id] || 0) === 3; });
      if (all3) award('perfect');
      sfx.win();
      html = '<div class="big-emoji">🏆</div><h2>You won, Christian!</h2><div class="stars" style="color:var(--gold)">' + starStr(stars) + '</div>' +
        '<p>' + cap(res.reason) + ' vs ' + esc(G.bot.name) + '. +' + xp + ' XP' +
        (stars < 3 ? '<br><small>Win without hints or takebacks for 3 stars.</small>' : '') +
        (unlockedNew ? '<br><b style="color:var(--green)">🔓 Level ' + (G.level + 1) + ' unlocked!</b>' : '') + '</p>';
    } else if (draw) {
      S.draws++; xp = 15;
      html = '<div class="big-emoji">🤝</div><h2>Draw</h2><p>By ' + res.reason + '. +' + xp + ' XP' + (res.reason === 'stalemate' ? '<br><small>Tip: when you\'re winning, make sure the enemy king always has a move!</small>' : '') + '</p>';
    } else {
      S.losses++; S.streak = 0; xp = 5;
      sfx.lose();
      html = '<div class="big-emoji">' + G.bot.avatar + '</div><h2>' + esc(G.bot.name) + ' won</h2><p>By ' + res.reason + '. Don\'t give up — every loss teaches you something! +' + xp + ' XP' +
        (G.blunders ? '<br><small>You made ' + G.blunders + ' blunder' + (G.blunders > 1 ? 's' : '') + '. Use the Blunder Check before each move.</small>' : '') + '</p>';
    }
    addXp(xp);
    save();
    html += '<p style="margin-top:-6px"><small>Best moves: ' + G.best + ' · Blunders: ' + G.blunders + ' · Hints: ' + G.hints + '</small></p><div class="btns">';
    if (win && G.level < 10) html += '<button class="green" id="eg-next">Next level ▶</button>';
    html += '<button' + (win && G.level < 10 ? '' : ' class="green"') + ' id="eg-again">Play again</button><button id="eg-view">View board</button><button id="eg-levels">Choose level</button></div>';
    var lvl = G.level, col = G.color;
    drawGame();
    coachSay(win ? '🎉 Great game! ' : draw ? 'A draw! ' : 'Good effort. Review the board, then try again!');
    setTimeout(function () {
      showModal(html);
      if ($('eg-next')) $('eg-next').onclick = function () { hideModal(); startGame(lvl + 1, col); };
      $('eg-again').onclick = function () { hideModal(); startGame(lvl, col); };
      $('eg-view').onclick = hideModal;
      $('eg-levels').onclick = function () { hideModal(); go('levels'); };
    }, 600);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---- settings
  var SETTINGS = [
    ['coach', 'Coach', 'Rates every move and explains mistakes'],
    ['danger', 'Danger alerts', 'Red glow on your pieces that can be captured'],
    ['legal', 'Show legal moves', 'Dots where the selected piece can go'],
    ['evalbar', 'Evaluation bar', 'Shows who is winning'],
    ['sound', 'Sounds', 'Move and capture sounds']
  ];
  function openSettings() {
    var html = '<h2>⚙️ Settings</h2>';
    SETTINGS.forEach(function (s) {
      html += '<div class="setting"><div><b>' + s[1] + '</b><small>' + s[2] + '</small></div><button class="switch' + (S.settings[s[0]] ? ' on' : '') + '" data-set="' + s[0] + '"></button></div>';
    });
    html += '<div class="btns"><button class="green" id="set-done">Done</button></div>';
    showModal(html);
    document.querySelectorAll('[data-set]').forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute('data-set'); S.settings[k] = !S.settings[k]; b.classList.toggle('on', S.settings[k]); save(); drawGame(); };
    });
    $('set-done').onclick = hideModal;
  }
  $('btn-settings').onclick = openSettings;

  // ---------------------------------------------------------------- puzzles
  var PZ = null;
  var pzCtrl = new BoardController($('pz-board'), {
    getPos: function () { return PZ.pos; },
    canMove: function () { return PZ && !PZ.done && !PZ.wait; },
    onMove: function (m) { puzzleMove(m); },
    redraw: function () { drawPuzzle(); }
  });
  function renderPuzzleList() {
    var html = '';
    D.PUZZLES.forEach(function (p, i) {
      var done = S.puzzles[p.id];
      html += '<button class="pz-card' + (done ? ' done' : '') + '" data-pz="' + i + '"><span class="num">#' + p.id + ' · ' + (p.type === 'mate' ? 'Mate in 1' : 'Win material') + '</span><b>' + esc(p.title) + '</b><span class="state">' + (done ? '✓ Solved' : '') + '</span></button>';
    });
    $('puzzle-list').innerHTML = html;
    document.querySelectorAll('.pz-card').forEach(function (b) { b.onclick = function () { openPuzzle(parseInt(b.getAttribute('data-pz'), 10)); }; });
  }
  function openPuzzle(i) {
    var p = D.PUZZLES[i];
    PZ = { i: i, p: p, pos: new E.Position(p.fen), flipped: p.fen.split(' ')[1] === 'b', done: false, wait: false, hint: 0, last: null, hl: [] };
    pzCtrl.clear();
    $('pz-title').textContent = '#' + p.id + ' ' + p.title;
    var side = PZ.pos.turn === 'w' ? 'White' : 'Black';
    $('pz-banner').textContent = side + ' to move — ' + (p.type === 'mate' ? 'find checkmate in 1!' : 'win material!');
    $('pz-banner').className = 'pz-banner ' + PZ.pos.turn;
    $('pz-msg').innerHTML = p.type === 'mate' ? 'Find the move that checkmates the king.' : 'Find the best move. Look for checks, captures and threats!';
    $('pz-next').style.visibility = S.puzzles[p.id] ? 'visible' : 'hidden';
    if (current !== 'puzzle') { document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); }); $('screen-puzzle').classList.add('active'); current = 'puzzle'; }
    drawPuzzle();
  }
  function drawPuzzle() {
    renderBoard($('pz-board'), PZ.pos, { flipped: PZ.flipped, selected: pzCtrl.selected, targets: S.settings.legal ? pzCtrl.targets : [], last: PZ.last, hint: PZ.hl });
  }
  function puzzleMove(m) {
    var pos = PZ.pos, san = pos.san(m), uci = pos.uci(m);
    var ok = PZ.p.type === 'mate' ? san.slice(-1) === '#' : PZ.p.solution.indexOf(uci) >= 0;
    pos.make(m);
    PZ.last = { from: m.from, to: m.to }; PZ.hl = [];
    drawPuzzle();
    if (ok) {
      PZ.done = true;
      sfx.good();
      var first = !S.puzzles[PZ.p.id];
      if (first) { S.puzzles[PZ.p.id] = true; addXp(20); award('puzzle1'); if (Object.keys(S.puzzles).length >= D.PUZZLES.length) award('puzzle_all'); }
      $('pz-msg').innerHTML = '<b class="best">Correct! 🎉</b> ' + esc(san) + (first ? ' (+20 XP)' : '') + (PZ.p.type === 'win' ? '<br>' + esc(PZ.p.hint) : '');
      $('pz-next').style.visibility = 'visible';
    } else {
      sfx.bad();
      PZ.wait = true;
      $('pz-msg').innerHTML = '<b class="mistake">Not quite.</b> ' + esc(san) + (san.slice(-1) === '+' ? ' is check, but not the best move.' : ' is not it.') + ' Try again!';
      setTimeout(function () { pos.unmake(m); PZ.last = null; PZ.wait = false; drawPuzzle(); }, 900);
    }
  }
  $('pz-hint').onclick = function () {
    if (!PZ || PZ.done) return;
    PZ.hint++;
    if (PZ.hint === 1) $('pz-msg').innerHTML = '💡 ' + esc(PZ.p.hint);
    else { var m = PZ.pos.findUci(PZ.p.solution[0]); if (m) { PZ.hl = [m.from]; $('pz-msg').innerHTML = '💡 Move the ' + pname(m.piece) + ' on ' + E.sqName(m.from) + '.'; } }
    drawPuzzle();
  };
  $('pz-reset').onclick = function () { if (PZ) openPuzzle(PZ.i); };
  $('pz-next').onclick = function () { if (PZ) openPuzzle((PZ.i + 1) % D.PUZZLES.length); };

  // ---------------------------------------------------------------- lessons
  function renderLessons() {
    var html = '';
    D.LESSONS.forEach(function (l, i) {
      html += '<button class="lesson-btn" data-ls="' + i + '"><span class="ic">' + l.icon + '</span><span><b>' + esc(l.title) + '</b><small>' + l.sections.length + ' parts</small></span>' + (S.lessons[l.id] ? '<span class="check">✓</span>' : '') + '</button>';
    });
    $('lesson-list').innerHTML = html;
    document.querySelectorAll('.lesson-btn').forEach(function (b) { b.onclick = function () { openLesson(parseInt(b.getAttribute('data-ls'), 10)); }; });
  }
  function openLesson(i) {
    var l = D.LESSONS[i], html = '';
    $('lesson-title').textContent = l.title;
    l.sections.forEach(function (s, j) {
      html += '<div class="card lesson-sec"><h3>' + esc(s.h) + '</h3><p>' + esc(s.t) + '</p>' + (s.fen ? '<div class="board" id="lb-' + j + '"></div>' : '') + '</div>';
    });
    html += '<button class="big-btn green" id="lesson-done"><span class="ic">✅</span><span><b>Got it!</b><small>' + (S.lessons[l.id] ? 'Back to lessons' : '+10 XP') + '</small></span></button>';
    $('lesson-body').innerHTML = html;
    $('lesson-body').scrollTop = 0;
    l.sections.forEach(function (s, j) {
      if (!s.fen) return;
      var pos = new E.Position(s.fen);
      var o = { coords: true };
      if (l.id === 'pieces' && j < 2) { var sq = -1; pos.board.forEach(function (p, k) { if (p) sq = k; }); o.selected = sq; o.targets = pos.movesFrom(sq); }
      renderBoard($('lb-' + j), pos, o);
    });
    $('lesson-done').onclick = function () {
      if (!S.lessons[l.id]) { S.lessons[l.id] = true; addXp(10); toast('📚', 'Lesson complete!', '+10 XP'); }
      if (D.LESSONS.every(function (x) { return S.lessons[x.id]; })) award('student');
      save();
      go('learn');
    };
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $('screen-lesson').classList.add('active'); current = 'lesson';
  }

  // ---------------------------------------------------------------- awards
  function renderAwards() {
    $('stats').innerHTML = '<div><b>' + S.games + '</b><small>Games</small></div><div><b>' + S.wins + '</b><small>Wins</small></div><div><b>' + S.bestStreak + '</b><small>Best streak</small></div>' +
      '<div><b>' + (S.unlocked > 10 ? 10 : S.unlocked) + '/10</b><small>Levels open</small></div><div><b>' + Object.keys(S.puzzles).length + '</b><small>Puzzles</small></div><div><b>' + S.xp + '</b><small>XP</small></div>';
    var html = '';
    D.ACHIEVEMENTS.forEach(function (a) {
      var got = !!S.ach[a.id];
      html += '<div class="award' + (got ? ' got' : '') + '"><span class="ic">' + a.icon + '</span><div><b>' + esc(a.name) + '</b><small>' + esc(a.desc) + '</small></div></div>';
    });
    $('award-list').innerHTML = html;
  }
  $('btn-reset').onclick = function () {
    showModal('<div class="big-emoji">⚠️</div><h2>Reset everything?</h2><p>All levels, stars, XP and achievements will be erased.</p><div class="btns"><button id="rst-yes">Yes, reset</button><button class="green" id="rst-no">Cancel</button></div>');
    $('rst-yes').onclick = function () { var st = S.settings; S = defaults(); S.settings = st; save(); hideModal(); go('home'); };
    $('rst-no').onclick = hideModal;
  };

  // ---------------------------------------------------------------- boot
  renderHome();
  window.__app = { S: function () { return S; }, G: function () { return G; } }; // for testing
})();
