/* Bots, puzzles, lessons and achievements */
(function (global) {
  'use strict';

  // depth = search depth, noise = random centipawns added to each move (bigger = more mistakes)
  // Bots with full:true use the strong iterative-deepening search instead.
  var BOTS = [
    { id: 1, name: 'Pawn Pete', elo: 250, avatar: '🐣', depth: 1, noise: 650, blurb: 'Just learned how the pieces move. Leaves pieces hanging a lot!' },
    { id: 2, name: 'Rookie Rita', elo: 400, avatar: '🐢', depth: 1, noise: 320, blurb: 'Likes grabbing pieces, but forgets to protect hers.' },
    { id: 3, name: 'Knightly Nick', elo: 550, avatar: '🐴', depth: 2, noise: 260, blurb: 'Loves knight jumps. Sometimes misses simple threats.' },
    { id: 4, name: 'Bishop Bella', elo: 700, avatar: '🦊', depth: 2, noise: 160, blurb: 'Sees one move ahead. Will punish free pieces.' },
    { id: 5, name: 'Castle Carl', elo: 850, avatar: '🏰', depth: 2, noise: 90, blurb: 'Solid player. Castles early and defends well.' },
    { id: 6, name: 'Queen Quinn', elo: 1000, avatar: '👸', depth: 3, noise: 70, blurb: 'Looks for forks and pins. Stay alert!' },
    { id: 7, name: 'Tactic Tom', elo: 1200, avatar: '🦉', depth: 3, noise: 35, blurb: 'Rarely blunders. Finds tactics two moves deep.' },
    { id: 8, name: 'Master Maya', elo: 1400, avatar: '🐯', full: true, maxDepth: 4, timeMs: 900, noise: 0, blurb: 'Plays the strongest move she can find.' },
    { id: 9, name: 'Expert Ezra', elo: 1600, avatar: '🦅', full: true, maxDepth: 5, timeMs: 1600, noise: 0, blurb: 'Thinks deep. You will need a plan!' },
    { id: 10, name: 'Grandmaster Gus', elo: 1800, avatar: '🐉', full: true, maxDepth: 7, timeMs: 2800, noise: 0, blurb: 'The final boss. Beat him and you are a legend!' }
  ];

  // type 'mate': any checkmating move is accepted. type 'win': the listed move(s) are accepted.
  var PUZZLES = [
    { id: 1, title: 'Back Rank Mate', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', type: 'mate', solution: ['a1a8'], hint: 'The black king is trapped by his own pawns. Attack the back row!' },
    { id: 2, title: "Scholar's Mate", fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', type: 'mate', solution: ['h5f7'], hint: 'f7 is only protected by the king. Your queen and bishop both aim there.' },
    { id: 3, title: "Fool's Mate", fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', type: 'mate', solution: ['d8h4'], hint: 'White opened the diagonal next to his king. Your queen can use it.' },
    { id: 4, title: 'King & Queen Mate', fen: '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1', type: 'mate', solution: ['b1b8'], hint: 'Your king already covers g7 and h7. Use the queen to cover the 8th rank.' },
    { id: 5, title: 'Smothered Mate', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', type: 'mate', solution: ['g5f7'], hint: 'The king is surrounded by his own pieces. Which piece can jump in?' },
    { id: 6, title: 'Rook Mate', fen: '1k6/8/1K6/8/8/8/8/7R w - - 0 1', type: 'mate', solution: ['h1h8'], hint: 'Your king takes away the 7th rank squares.' },
    { id: 7, title: 'Black Back Rank', fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', type: 'mate', solution: ['a8a1'], hint: 'White forgot to make an escape square for his king.' },
    { id: 8, title: 'Queen Kiss', fen: 'k7/2Q5/1K6/8/8/8/8/8 w - - 0 1', type: 'mate', solution: ['c7b7'], hint: 'Put the queen right next to the king, protected by your own king.' },
    { id: 9, title: 'Free Queen!', fen: '4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1', type: 'win', solution: ['d2d5'], hint: 'Always check: is any enemy piece unprotected?' },
    { id: 10, title: 'Knight Fork', fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', type: 'win', solution: ['b5c7'], hint: 'Knights can attack two pieces at once. Find a square that hits the king AND the rook.' },
    { id: 11, title: 'Royal Fork', fen: '2q1k3/8/8/8/4N3/8/8/4K3 w - - 0 1', type: 'win', solution: ['e4d6'], hint: 'Attack the king and the queen at the same time.' },
    { id: 12, title: 'Queen Fork', fen: 'r5k1/8/8/8/8/8/8/3QK3 w - - 0 1', type: 'win', solution: ['d1d5'], hint: 'Give a check that also attacks the rook in the corner.' },
    { id: 13, title: 'Pawn Fork', fen: '4k3/8/8/2n1n3/8/3P4/8/7K w - - 0 1', type: 'win', solution: ['d3d4'], hint: 'Even a little pawn can attack two pieces!' },
    { id: 14, title: 'Skewer', fen: '3q4/8/8/8/3k4/8/8/R5K1 w - - 0 1', type: 'win', solution: ['a1d1'], hint: 'Check the king so that when it moves, the queen behind it is exposed.' },
    { id: 15, title: 'Mate with Two Rooks', fen: '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1', type: 'mate', solution: ['b1b8'], hint: 'One rook guards the 7th rank, the other delivers mate.' }
  ];

  var LESSONS = [
    {
      id: 'pieces', icon: '♞', title: 'How the Pieces Move',
      sections: [
        { h: 'Pawn (1 point)', t: 'Moves forward 1 square (or 2 on its very first move). It captures diagonally forward. Reach the last row and it becomes a queen!', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1' },
        { h: 'Knight (3 points)', t: 'Moves in an "L" shape: 2 squares one way, then 1 to the side. It is the only piece that can jump over others.', fen: '8/8/8/8/3N4/8/8/8 w - - 0 1' },
        { h: 'Bishop (3 points)', t: 'Moves any distance diagonally. Each bishop stays on one color forever.' },
        { h: 'Rook (5 points)', t: 'Moves any distance straight up, down, left or right. Rooks love open files (columns with no pawns).' },
        { h: 'Queen (9 points)', t: 'The strongest piece: moves like a rook AND a bishop. Don\'t lose her!' },
        { h: 'King (priceless)', t: 'Moves 1 square in any direction. If your king is attacked and cannot escape, that is checkmate and the game is over.' },
        { h: 'Special moves', t: 'Castling: king moves 2 squares toward a rook, and the rook hops over. En passant: a pawn that moves 2 squares can be captured by an enemy pawn as if it moved 1.' }
      ]
    },
    {
      id: 'hang', icon: '🛡️', title: 'Rule #1: Don\'t Hang Pieces',
      sections: [
        { h: 'Why you lose to real people', t: 'Most games at beginner level are not lost by bad plans. They are lost because a piece is left undefended ("hanging") and the opponent just takes it. Fix this one habit and you will beat most 400-rated players!' },
        { h: 'The Blunder Check (do it EVERY move)', t: '1) What did my opponent\'s last move attack? 2) After my move, can any of my pieces be taken for free? 3) Is my move safe — is the square I\'m moving to attacked?' },
        { h: 'Count attackers and defenders', t: 'If a piece is attacked 2 times and defended only 1 time, you will probably lose it. Add a defender or move it.' },
        { h: 'Use the Danger glow', t: 'In this app, turn on "Danger alerts" in Settings. Your pieces that can be captured for free will glow red. Over time, try to spot them before the glow does!' }
      ]
    },
    {
      id: 'opening', icon: '🚀', title: 'Opening Principles',
      sections: [
        { h: '1. Control the center', t: 'Start with 1.e4 or 1.d4. Pawns in the center give your pieces room to move.', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' },
        { h: '2. Develop knights and bishops', t: 'Bring out your knights and bishops before your queen and rooks. Knights before bishops is a good habit.' },
        { h: '3. Castle early', t: 'Castle in the first 10 moves to keep your king safe and connect your rooks.', fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 6 5' },
        { h: '4. Don\'t bring the queen out too early', t: 'Your opponent will chase her with pieces and gain time.' },
        { h: '5. Don\'t move the same piece twice', t: 'Unless you have to, get all your pieces into the game first.' }
      ]
    },
    {
      id: 'tactics', icon: '⚡', title: 'Tactics: Forks, Pins & Skewers',
      sections: [
        { h: 'Fork', t: 'One piece attacks two enemy pieces at once. Knights are the best forkers! Here the knight on c7 attacks the king and the rook.', fen: 'r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1' },
        { h: 'Pin', t: 'A piece cannot move because a more valuable piece is behind it. Here the black knight is pinned to the king by the bishop.', fen: '4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1' },
        { h: 'Skewer', t: 'Like a pin, but the more valuable piece is in front. When it moves, you take the piece behind it.' },
        { h: 'Checks, Captures, Threats', t: 'Before each move, look at ALL your checks, then all captures, then all threats. This is how strong players find tactics.' }
      ]
    },
    {
      id: 'mates', icon: '👑', title: 'Checkmate Patterns',
      sections: [
        { h: 'Back rank mate', t: 'A king stuck behind its own pawns can be mated by a rook or queen on the back row. Give your own king an escape square (like h3 or g3) to avoid this!', fen: '3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1' },
        { h: 'Scholar\'s Mate (and how to stop it)', t: 'Queen + bishop attack f7. Beginners on chess.com try this a lot! Defend with ...g6 or ...Qe7, or ...Nf6 when their queen is on f3 — but NOT ...Nf6 when the queen is on h5.', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3' },
        { h: 'King + Queen vs King', t: 'Use your queen to box the king toward the edge (stay a knight\'s jump away), then bring your king close and deliver mate. Watch out for stalemate!' }
      ]
    },
    {
      id: 'endgame', icon: '🏁', title: 'Endgame Basics',
      sections: [
        { h: 'Activate your king', t: 'When the queens are gone, your king becomes a fighter. Bring it to the center!' },
        { h: 'Push passed pawns', t: 'A pawn with no enemy pawns in front of it (or beside it) is "passed". Push it to make a new queen.' },
        { h: 'Avoid stalemate', t: 'If you are way ahead, always make sure the enemy king has a legal move until you give checkmate. Stalemate is a draw!' }
      ]
    },
    {
      id: 'humans', icon: '🧠', title: 'Beating Real Players',
      sections: [
        { h: 'Bots vs humans', t: 'Bots play strange but "safe" moves. Humans at low ratings attack fast, set traps, and play quickly. You need a different mindset.' },
        { h: 'Slow down', t: 'Use your clock! Play 10-minute or longer games so you have time for the Blunder Check on every move.' },
        { h: 'Expect early attacks', t: 'Many players try Scholar\'s Mate (Qh5 + Bc4). Know how to defend it — then their queen is out early and you can chase it with your pieces.' },
        { h: 'When they blunder, take it', t: 'Before every move, ask: "Can I take something for free?" Beginners hang pieces all the time.' },
        { h: 'Don\'t tilt', t: 'Lost a game? Take a break. Review it in your head: where did a piece get lost? Learn one thing, then play again.' }
      ]
    }
  ];

  var ACHIEVEMENTS = [
    { id: 'first_game', icon: '🎮', name: 'First Steps', desc: 'Finish your first game' },
    { id: 'first_win', icon: '🏆', name: 'First Victory', desc: 'Win a game against any bot' },
    { id: 'beat_3', icon: '🐴', name: 'Horse Tamer', desc: 'Beat Knightly Nick (level 3)' },
    { id: 'beat_5', icon: '🏰', name: 'Castle Crasher', desc: 'Beat Castle Carl (level 5)' },
    { id: 'beat_7', icon: '🦉', name: 'Tactic Master', desc: 'Beat Tactic Tom (level 7)' },
    { id: 'beat_10', icon: '🐉', name: 'Dragon Slayer', desc: 'Beat Grandmaster Gus (level 10)' },
    { id: 'no_hints', icon: '🧠', name: 'On My Own', desc: 'Win a game without hints or takebacks' },
    { id: 'clean', icon: '✨', name: 'Clean Game', desc: 'Win a game with zero blunders' },
    { id: 'castle', icon: '🛡️', name: 'Safe King', desc: 'Castle in a game' },
    { id: 'promote', icon: '👑', name: 'Queen Me!', desc: 'Promote a pawn' },
    { id: 'en_passant', icon: '🥐', name: 'En Passant!', desc: 'Capture a pawn en passant' },
    { id: 'speedy', icon: '⚡', name: 'Speedy Win', desc: 'Win in 25 moves or less' },
    { id: 'sharp', icon: '🎯', name: 'Sharp Eye', desc: 'Play 10 best moves in one game' },
    { id: 'streak3', icon: '🔥', name: 'On Fire', desc: 'Win 3 games in a row' },
    { id: 'games10', icon: '📅', name: 'Dedicated', desc: 'Play 10 games' },
    { id: 'games50', icon: '💪', name: 'Chess Addict', desc: 'Play 50 games' },
    { id: 'puzzle1', icon: '🧩', name: 'Puzzle Solver', desc: 'Solve your first puzzle' },
    { id: 'puzzle_all', icon: '🏅', name: 'Puzzle Master', desc: 'Solve every puzzle' },
    { id: 'student', icon: '📚', name: 'Student of the Game', desc: 'Read every lesson' },
    { id: 'perfect', icon: '⭐', name: 'Perfectionist', desc: 'Get 3 stars on every level' }
  ];

  var RANKS = [
    { xp: 0, name: 'Beginner' }, { xp: 150, name: 'Novice' }, { xp: 400, name: 'Club Player' },
    { xp: 800, name: 'Tactician' }, { xp: 1400, name: 'Expert' }, { xp: 2200, name: 'Candidate Master' },
    { xp: 3200, name: 'Master' }, { xp: 4500, name: 'Grandmaster' }
  ];

  global.ChessData = { BOTS: BOTS, PUZZLES: PUZZLES, LESSONS: LESSONS, ACHIEVEMENTS: ACHIEVEMENTS, RANKS: RANKS };
})(typeof window !== 'undefined' ? window : globalThis);
