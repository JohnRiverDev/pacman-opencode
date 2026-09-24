# AGENTS.md

Vanilla JS/HTML/CSS Pac-Man clone. Its main purpose is to practice **spec-driven development** via the local skills in `.agents/skills/` (`spec`, `spec-impl`). `README.md`, code comments, and UI text are in **Spanish** — write code/comments in Spanish and match the user's prompt language.

## Run & verify

- **No build step, no package manager, no tests, no lint, no CI.** Do not run `npm install` / `npm run ...`.
- Open `src/index.html` directly in a browser (works over `file://`). Verify changes manually in the browser; there is no automated test suite.

## Architecture

- Classic `<script>` tags in `index.html` wire the app: `js/maze.js` → `js/game.js` → `js/render.js` → `js/main.js`. Modules share state through globals (`window.MAZE`, `window.createGame`, `window.update`, `window.draw`). **Adding a JS file requires adding a `<script>` tag in the right position** — the dependency flows downward (maze < game < render < main). Don't introduce `export`/`import` without converting the whole wiring.
- `maze.js`: 28×31 grid read from string literals. Tile codes: `1` wall, `2` dot, `3` pen door, `0` empty. Exposes `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`.
- `game.js`: pure game rules. **`MAZE` is pristine — never mutate it.** `createGame()` copies it into `game.grid`; all dot-eating, movement, and collisions use only `game.grid`.
- `render.js`: draws from `game.grid` (not `MAZE`). Grid is 28 wide × 31 high at `TILE = 20` px.
- Movement: cell coordinates are fractional and snap to integers when aligned; actors are blocked per-`isWall` rules — pacman can't cross walls or the door (`3`), ghosts only walls (they pass the door). Row `TUNNEL_ROW` wraps horizontally.
- Style: spaces inside parentheses (`f( x, y )`) and single-quoted strings. Match it.

## Spec-driven workflow

- New features go through a spec first: use the `spec` skill → it writes `specs/NN-slug.md` (numbered `01-`, `02-`, ...; slug kebab-case) in the template/markdown shape from the skill and seeds `specs/.spec-config.yml` on first use. No `specs/` folder exists yet.
- The user marks the spec `Approved` (Spanish `Aprobado` also accepted) manually; then run the `spec-impl` skill, which validates the state, checks the working tree is clean, creates/switches to branch `spec-NN-slug`, and implements the plan **step by step, pausing for diff review and never auto-committing**.
- `spec-impl` refuses to run on `Draft`/`In review`/`Implemented`/`Obsolete` specs. Work outside an approved spec belongs on a different branch.