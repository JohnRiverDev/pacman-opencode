# SPEC 01 — Los cuatro fantasmas clásicos con IA propia

> **Status:** Draft
> **Depends on:** —
> **Date:** 2026-09-24
> **Objective:** Dar a los 4 fantasmas (Blinky, Pinky, Inky y Clyde) IA de persecución propia con ciclos scatter/chase y salida escalonada de la pen.

## Scope

**In:**

- 4 fantasmas con las personalidades clásicas: Blinky (persigue directo), Pinky (anticipa 4 celdas delante de Pac-Man), Inky (usa a Blinky de referencia) y Clyde (se retira a menos de 8 celdas).
- Modos globales scatter/chase con la secuencia de tiempos del nivel 1 del arcade: 7/20/7/20/5/20/5 segundos y luego chase infinito.
- Salida escalonada por tiempo: Blinky inmediato, Pinky ~2s, Inky ~6s, Clyde ~12s.
- Colores clásicos por fantasma (rojo, rosa, cian, naranja) en el render.
- Al perder una vida: todos vuelven a la pen y se re-liberan con el mismo escalonado.
- Misma velocidad para los 4 (`GHOST_SPEED`).

**Out of scope (para futuras specs):**

- Modo asustado (`frightened`) / power pellets.
- Velocidades distintas entre fantasmas y aceleración de Blinky (cruise Elroy).
- Liberación por dots comidos.
- Aparición de fantasmas fuera de la pen (todos arrancan dentro, como hoy).
- Cambio visual de los fantasmas entre scatter y chase.

## Data model

```js
// maze.js — 4 starts dentro de la pen (2x2 interior, filas 13 y 15)
const GHOST_STARTS = [
  { x: 13, y: 13, kind: 'blinky' },
  { x: 14, y: 13, kind: 'pinky' },
  { x: 13, y: 15, kind: 'inky' },
  { x: 14, y: 15, kind: 'clyde' },
];
```

```js
// game.js — constantes nuevas
const RELEASE_DELAYS = { blinky: 0, pinky: 120, inky: 360, clyde: 720 }; // frames @60fps
const SCATTER_TARGETS = {
  blinky: { x: 26, y: 1 },
  pinky:  { x: 1,  y: 1 },
  inky:   { x: 26, y: 29 },
  clyde:  { x: 1,  y: 29 },
};
const PHASES = [
  { mode: 'scatter', frames: 420 }, // 7s
  { mode: 'chase',   frames: 1200 }, // 20s
  { mode: 'scatter', frames: 420 },
  { mode: 'chase',   frames: 1200 },
  { mode: 'scatter', frames: 300 }, // 5s
  { mode: 'chase',   frames: 1200 },
  { mode: 'scatter', frames: 300 },
  { mode: 'chase',   frames: Infinity },
];
```

```js
// game — juego
{ state, score, lives, dotsRemaining, grid, pacman,
  frame: 0, // contador de frames de la partida, se incrementa en update()
  ghosts: [ /* ghost */ ] }

// game — cada fantasma
{ x, y, dir: 'up', speed: GHOST_SPEED, kind,
  state: 'waiting',          // 'waiting' | 'active'
  waitUntil: 0,              // frame absoluto de liberacion
  inPen: true,               // forzado a salir recto hacia arriba
}

// game — modo global segun frame
function ghostMode( frame ) {
  let t = frame;
  for ( const p of PHASES ) {
    if ( t < p.frames ) return p.mode;
    t -= p.frames;
  }
  return 'chase';
}
```

Convenciones:

- Los tiempos van en frames (el bucle ya corre a `requestAnimationFrame`); 1s = 60 frames.
- Objetivos de scatter son celdas transitables pegadas a cada esquina.
- Blanco de Pinky/Inky no se clampa a los bordes: un objetivo fuera del grid es válido para comparar distancias.

Blancos por personalidad (en `chase`):

- **blinky:** celda de Pac-Man.
- **pinky:** celda de Pac-Man + 4 · `DIRS[pacman.dir]`.
- **inky:** `2 * (celda de Pac-Man + 2 · DIRS[pacman.dir]) - celda de blinky` (reflejo del punto "2 adelante" a través de Blinky).
- **clyde:** si la distancia euclídea a Pac-Man es > 8, la celda de Pac-Man; si no, su esquina (`SCATTER_TARGETS.clyde`).

## Implementation plan

Cada paso deja el juego funcional; se verifica abriendo `src/index.html`.

1. `maze.js`: expandir `GHOST_STARTS` a 4 entradas con `kind` clásico. Al archivo le funciona ya (los 2 nuevos caen en el comportamiento aleatorio actual).
2. `game.js`: en `createGame`, añadir `game.frame`, `state`/`waitUntil`/`inPen` a cada fantasma y las constantes `RELEASE_DELAYS`, `SCATTER_TARGETS`, `PHASES` (con `waitUntil = RELEASE_DELAYS[kind]`).
3. `game.js`: liberación — incrementar `game.frame` al inicio de `update()`; un ghost en `waiting` se pone `active` cuando `frame >= waitUntil`; `moveGhost` no mueve a los `waiting`.
4. `game.js`: salida de pen — mientras `inPen`, forzar `dir = 'up'` (omitir `decideGhost`); pasar `inPen = false` cuando `g.y <= 11` (ya cruzó la puerta).
5. `game.js`: reescribir `decideGhost` para que calcule el blanco por personalidad y según `ghostMode( game.frame )` (en `scatter` siempre la esquina). Mantiene la elección greedy actual: entre direcciones válidas (sin la contraria), la que minimiza la distancia Manhattan al blanco.
6. `game.js`: `resetPositions` devuelve cada fantasma a su celda de la pen con `state = 'waiting'` e `inPen = true`, y `waitUntil = game.frame + RELEASE_DELAYS[kind]`.
7. `render.js`: `GHOST_COLORS` pasa de array a mapa por `kind` (`blinky #ff0000`, `pinky #ffb8ff`, `inky #00ffff`, `clyde #ffb852`) y `draw` los asigna por `g.kind`.
8. Verificación manual según los criterios de aceptación.

## Acceptance criteria

- [ ] Se ven 4 fantasmas con los colores clásicos: rojo, rosa, cian y naranja.
- [ ] Nada más empezar solo Blinky sale de la pen; Pinky sale ~2s después, Inky ~6s y Clyde ~12s después.
- [ ] En los primeros 7s (scatter) cada liberado se dirige a su esquina (Blinky arriba-der, Pinky arriba-izq, Inky abajo-der, Clyde abajo-izq).
- [ ] A los 7s pasan a chase y Blinky reduce distancia a Pac-Man en cada cruce.
- [ ] Pinky anticipa a Pac-Man: su blanco está 4 celdas delante de su dirección.
- [ ] Inky no apunta directo a Pac-Man: su blanco cambia según dónde esté Blinky.
- [ ] Clyde deja de perseguir cuando está a ≤ 8 celdas de Pac-Man y vuelve a su esquina.
- [ ] Ningún fantasma hace giro de 180° salvo en callejón sin salida.
- [ ] La secuencia scatter/chase sigue los tiempos 7/20/7/20/5/20/5s y luego chase infinito.
- [ ] Al perder una vida, los 4 vuelven a la pen y se re-liberan escalonados (Blinky primero).
- [ ] Los 4 se mueven a `GHOST_SPEED` (0.1 celda/frame).
- [ ] No hay errores en la consola del navegador.

## Decisions

- **Sí:** nombres clásicos como `kind` (`blinky`, `pinky`, `inky`, `clyde`), reemplazando a `hunter`/`random`. Son autodescriptivos y el código queda fiel al arcade.
- **Sí:** los 4 arrancan dentro de la pen (las 4 celdas interiores). Sin fantasma de inicio fuera, como hoy.
- **Sí:** liberación por tiempo (0/2/6/12s) en vez de por dots. Independiente del nivel del jugador y trivial de probar a mano.
- **Sí:** secuencia clásica de tiempos para scatter/chase. Fiel al nivel 1.
- **Sí:** misma velocidad para los 4 (lo pidió el usuario). Cruise Elroy fuera.
- **Sí:** un flag `inPen` + `dir` forzada hacia arriba para salir de la pen. Los fantasmas ignoran la puerta (3), así que basta con apuntar recto.
- **No:** `frightened` / power pellets. No existe el sistema que los vuelva vulnerables; va en otra spec.
- **No:** liberación por dots (modo arcade). Se registra para una futura spec si se quiere más fidelidad.
- **No:** diferencia visual entre scatter y chase. Los colores y rutas distintas bastan para distinguir personalidades.
- **No:** pathfinding completo. Se mantiene la heurística greedy actual (mejor dirección en cada celda alineada).
- **No:** colisión entre fantasmas. Nunca ha existido y los solapamientos al cruzar la pen son inofensivos.

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| Los tiempos por frames dependen de correr a 60fps reales | Si el equipo cae de FPS, la liberación y las fases se desvían del reloj. Aceptable para el MVP; migrar a delta-time queda para otra spec. |
| Un liberado cruza la pen donde espera otro | Inofensivo: los fantasmas no colisionan entre sí (comportamiento existente). |
| Personalidades difíciles de distinguir a simple vista | Colores clásicos + esquinas opuestas en scatter hacen reconocible cada patrón. |

## What is **not** in this spec

- Power pellets y modo asustado.
- Velocidades por fantasma y cruise Elroy.
- Liberación por dots comidos.
- Objetivos de scatter fuera de los bordes del laberinto.
- Colisión entre fantasmas.

Cada uno de esos, si llega, va en su propia spec.