# SPEC 02 — Power pellets (objetos que permiten comer fantasmas)

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-09-24
> **Objective:** Agregar power pellets en las esquinas del laberinto que, al ser comidos, activan un modo asustado temporal donde los fantasmas se vuelven vulnerables y pueden ser capturados por Pac-Man.

## Scope

**In:**

- Power pellets colocados en las cuatro esquinas del laberinto (como en el arcade clásico).
- Al comer uno, se activa el modo asustado que dura 10 segundos (600 frames a 60fps).
- Durante el modo asustado, los fantasmas se vuelven vulnerables y pueden ser capturados por Pac-Man.
- Los fantasmas se ven con un color azul claro durante el modo asustado.
- El jugador obtiene puntos adicionales cuando captura fantasmas asustados (múltiplos de 100).
- Al terminar el tiempo del modo asustado, los fantasmas regresan a su comportamiento normal.

**Out of scope (para futuras specs):**

- Mecánicas más complejas como efectos especiales visuales o sonoros.
- Poderes con efectos diferentes en otros elementos del juego (como puntos extra, velocidad, etc.).
- Sistema avanzado de puntuación con combos o bonificaciones por tiempo.

## Data model

```js
// maze.js - Agregar nuevas constantes para indicar posición de power pellets
const POWER_PELLET_POSITIONS = [
  { x: 1, y: 1 },    // Esquina superior izquierda
  { x: 26, y: 1 },   // Esquina superior derecha
  { x: 1, y: 29 },   // Esquina inferior izquierda
  { x: 26, y: 29 }   // Esquina inferior derecha
];
```

```js
// game.js - Nueva propiedad en el estado del juego para controlar el modo asustado
{
  state: 'start',
  score: 0,
  lives: 3,
  dotsRemaining: dots,
  grid,
  pacman: {
    x: PACMAN_START.x,
    y: PACMAN_START.y,
    dir: 'left',
    nextDir: null,
    speed: PACMAN_SPEED,
  },
  ghosts: [ /* ghost */ ],
  frame: 0,
  
  // Nuevas propiedades para power pellets
  frightened: false,          // Indica si estamos en modo asustado
  frightenedTimer: 0,         // Timer para el modo asustado (en frames)
  powerPelletsEaten: 0,       // Cantidad de power pellets comidos
}
```

```js
// game.js - Cada fantasma necesita nuevo estado para saber si está vulnerable
{
  x, y, dir: 'up', speed: GHOST_SPEED, kind,
  state: 'waiting',          // 'waiting' | 'active'
  waitUntil: 0,              // frame absoluto de liberacion
  inPen: true,               // forzado a salir recto hacia arriba
  frightened: false,         // Indica si el fantasma está vulnerable
}
```

## Implementation plan

Cada paso deja el juego funcional; se verifica abriendo `src/index.html`.

1. `maze.js`: definir `POWER_PELLET_POSITIONS` como las 4 esquinas del laberinto para colocar los power pellets.
2. `game.js`: al crear una partida, inicializar `frightened = false`, `frightenedTimer = 0` y `powerPelletsEaten = 0`.
3. `game.js`: modificar `createGame()` para que los power pellets se coloquen en las esquinas (reemplazando dots por power pellets).
4. `game.js`: al comer un power pellet, marcar `frightened = true` y `frightenedTimer = 600` (10 segundos a 60fps), y aumentar `powerPelletsEaten`.
5. `game.js`: modificar `movePacman()` para detectar cuando come un power pellet en lugar de un dot.
6. `game.js`: modificar `decideGhost()` para que los fantasmas se comporten diferente durante el modo asustado (direcciones aleatorias).
7. `game.js`: en `update()`, decrementar `frightenedTimer` cada frame y al llegar a 0, desactivar el modo asustado.
8. `game.js`: al final de un juego (colisión entre Pac-Man y fantasma) en modo asustado, incrementar la puntuación por captura de fantasma.
9. `render.js`: cambiar color de los fantasmas a azul durante el modo asustado (`#0000ff`).
10. Verificación manual según los criterios de aceptación.

## Acceptance criteria

- [ ] Se colocan 4 power pellets en las esquinas del laberinto (esquina superior izquierda, superior derecha, inferior izquierda y inferior derecha)
- [ ] Al comer uno, el modo asustado se activa por 10 segundos
- [ ] Durante el modo asustado, los fantasmas se ven azules
- [ ] Cuando Pac-Man come un fantasma en modo asustado, se obtienen puntos adicionales (100, 200, 400, 800 puntos por orden de captura)
- [ ] Al terminar el tiempo del modo asustado, los fantasmas regresan a su comportamiento normal
- [ ] El jugador puede comer múltiples power pellets en una sola partida
- [ ] No hay errores en la consola del navegador
- [ ] La puntuación se actualiza correctamente al capturar fantasmas durante la fase asustada

## Decisions

- **Sí:** power pellets posicionados en las esquinas como en el arcade clásico. Es el comportamiento esperado.
- **Sí:** modo asustado de 10 segundos (600 frames) como en el arcade original.
- **Sí:** efecto visual del cambio de color de los fantasmas a azul claro durante el modo asustado.
- **Sí:** aumento de puntos al capturar fantasmas que se van duplicando: 100, 200, 400, 800 puntos por orden de captura.
- **Sí:** el modo asustado afecta a todos los fantasmas simultáneamente.
- **No:** efectos sonoros o visuales adicionales. Se mantendrá solo la mecánica básica.
- **No:** power pellets con efectos más complejos (puntos extra, duración variable, etc.)
- **No:** sistema avanzado de combos

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| Colisión incorrecta entre Pac-Man y fantasmas durante el modo asustado | Se asegura que solo se detecte colisión si los fantasmas están en estado asustado |
| Los power pellets pueden causar confusiones con las dots existentes | Se verifica el tipo de celda antes de comer cualquier objeto |
| Cambios en la lógica podrían romper el comportamiento normal del juego | Testeo manual de la función de "resetPositions" para asegurar que funcione correctamente |

## What is **not** in this spec

- Sonidos o efectos adicionales.
- Puntuación extra por tiempo o combos.
- Mecánicas con efecto más allá del modo asustado.
- Configuración avanzada de los valores como duración, puntuación o comportamiento.

Cada uno de esos, si llega, va en su propia spec.