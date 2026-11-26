# ♞ Christian's Chess Academy

An Android chess app made for Christian: play bots from 250 to 1800 rating, with a built-in coach that hints toward the best move and explains mistakes.

## Features
- **10 bot levels** (Pawn Pete 250 → Grandmaster Gus 1800). Beat a level to unlock the next; replay any unlocked level anytime. Earn up to 3 stars per level (3 stars = no hints and no takebacks).
- **Coach**: rates every move (Best / Good / Inaccuracy / Mistake / Blunder), explains *why* ("your knight on f3 can be taken for free"), shows the better move, and offers a takeback.
- **Hints**: first tap shows which piece to move, second tap shows the exact move.
- **Danger alerts**: your pieces that can be captured glow red — the #1 habit for beating real players.
- **Lessons** (piece moves, don't hang pieces, openings, tactics, checkmates, endgames, beating humans) and **15 puzzles**.
- **20 achievements**, XP and ranks, eval bar, sounds, and auto-saved games.
- Works fully offline.

## Install on Android
1. Open the repo's **Releases** page on the phone and download `ChessAcademy-Christian.apk` from the newest release.
2. Tap the file to install. If Android asks, allow **Install unknown apps** for your browser or Files app.
3. New builds install as updates and keep the progress.

The APK is built by GitHub Actions (`.github/workflows/build-apk.yml`) on every push.

## Development
- The app is HTML/JS in `app/src/main/assets/www/`, shown in an Android WebView. Open `index.html` in a browser to test it.
- Tests: `node tests/perft.test.js` (move generation) and `node tests/puzzles.test.js` (checks every puzzle).
- Build locally with the Android SDK: `./gradlew assembleRelease`.
- `app/chess-academy.keystore` is a hobby signing key, committed so every build can update the last one. Don't use it for a Play Store app.

## Credits
Chess piece images: "cburnett" set by Colin M.L. Burnett, licensed GPLv2+ (via lichess.org). The chess engine and app code were written for this project.
