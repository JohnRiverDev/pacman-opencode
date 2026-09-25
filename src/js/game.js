// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Constantes para el comportamiento de los fantasmas
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

// Modo global según frame
function ghostMode( frame ) {
  let t = frame;
  for ( const p of PHASES ) {
    if ( t < p.frames ) return p.mode;
    t -= p.frames;
  }
  return 'chase';
}

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
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
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      state: 'waiting',          // 'waiting' | 'active'
      waitUntil: 0,              // frame absoluto de liberacion
      inPen: true,               // forzado a salir recto hacia arriba
      frightened: false,         // Indica si el fantasma está vulnerable
    } ) ),
    frame: 0,
    
    // Nuevas propiedades para power pellets
    frightened: false,          // Indica si estamos en modo asustado
    frightenedTimer: 0,         // Timer para el modo asustado (en frames)
    powerPelletsEaten: 0,       // Cantidad de power pellets comidos
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      // Verificar si es un power pellet o una dot
      const isPowerPellet = POWER_PELLET_POSITIONS.some(
        pos => pos.x === p.x && pos.y === p.y
      );
      
      if ( isPowerPellet ) {
        // Activar modo asustado
        game.frightened = true;
        game.frightenedTimer = 600; // 10 segundos a 60fps
        game.powerPelletsEaten++;
      }
      
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  // Si el fantasma está en modo asustado, mover aleatoriamente
  if ( game.frightened || g.frightened ) {
    const options = Object.keys( DIRS ).filter(
      ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
    );
    // Sin salida (callejon): permitir el giro de 180.
    const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];
    
    // Elegir dirección aleatoria durante modo asustado
    if ( choices.length ) {
      g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    }
    return;
  }

  // Obtener blanco según personalidad y modo
  let target = null;
  if ( ghostMode( game.frame ) === 'scatter' ) {
    // En scatter, usar las esquinas específicas
    target = SCATTER_TARGETS[ g.kind ];
  } else {
    // En chase, usar blanco específico según tipo de fantasma
    switch ( g.kind ) {
      case 'blinky': // Blinky persigue directamente a Pac-Man
        target = { x: Math.round( p.x ), y: Math.round( p.y ) };
        break;
      case 'pinky': // Pinky anticipa 4 celdas delante de Pac-Man
        const dir = DIRS[ p.dir ];
        if ( dir ) {
          target = { x: Math.round( p.x + 4 * dir.x ), y: Math.round( p.y + 4 * dir.y ) };
        } else {
          target = { x: Math.round( p.x ), y: Math.round( p.y ) };
        }
        break;
      case 'inky': // Inky usa a Blinky como referencia
        if ( game.ghosts[0] ) { // Blinky es el primer fantasma
          const blinky = game.ghosts[0];
          const dir = DIRS[ p.dir ];
          if ( dir ) {
            const ahead = { x: Math.round( p.x + 2 * dir.x ), y: Math.round( p.y + 2 * dir.y ) };
            target = { 
              x: 2 * ahead.x - Math.round( blinky.x ),
              y: 2 * ahead.y - Math.round( blinky.y )
            };
          } else {
            target = { x: Math.round( p.x ), y: Math.round( p.y ) };
          }
        } else {
          target = { x: Math.round( p.x ), y: Math.round( p.y ) };
        }
        break;
      case 'clyde': // Clyde se retira si está a menos de 8 celdas
        const dx = Math.round( p.x ) - g.x;
        const dy = Math.round( p.y ) - g.y;
        const dist = Math.sqrt( dx * dx + dy * dy );
        if ( dist <= 8 ) {
          target = SCATTER_TARGETS.clyde;
        } else {
          target = { x: Math.round( p.x ), y: Math.round( p.y ) };
        }
        break;
    }
  }

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Elegir la mejor dirección greedy (la que minimiza distancia Manhattan al blanco)
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dx = nx - target.x;
    const dy = ny - target.y;
    const dist = Math.abs( dx ) + Math.abs( dy );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    
    // Si está en la pen, forzar dirección hacia arriba
    if ( g.inPen ) {
      g.dir = 'up';
      // Cuando cruza la puerta (y <= 11), salir de la pen
      if ( g.y <= 11 ) {
        g.inPen = false;
      }
    } else {
      // Si el fantasma está en modo asustado, activar el modo asustado
      if ( game.frightened || g.frightened ) {
        g.frightened = true;
      }
      decideGhost( game, g );
    }
    
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  
  game.ghosts.forEach( ( g, i ) => {
    const start = GHOST_STARTS[ i ];
    g.x = start.x;
    g.y = start.y;
    g.dir = 'up';
    g.state = 'waiting';
    g.inPen = true;
    g.waitUntil = game.frame + RELEASE_DELAYS[ g.kind ];
    g.frightened = false;  // Desactivar modo asustado
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.frame++;
  
  // Decrementar el timer del modo asustado si está activo
  if ( game.frightenedTimer > 0 ) {
    game.frightenedTimer--;
    if ( game.frightenedTimer === 0 ) {
      game.frightened = false;
      // Desactivar el modo asustado para todos los fantasmas
      game.ghosts.forEach( ( g ) => {
        g.frightened = false;
      } );
    }
  }
  
  movePacman( game );
  game.ghosts.forEach( ( g ) => {
    // Solo mueve si no está esperando
    if ( g.state !== 'waiting' ) {
      moveGhost( game, g );
    } else {
      // Si está en estado waiting, verificar si es hora de liberar
      if ( game.frame >= g.waitUntil ) {
        g.state = 'active';
      }
    }
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      // Si estamos en modo asustado y el fantasma es vulnerable
      if ( game.frightened || g.frightened ) {
        // Incrementar la puntuación por captura de fantasma
        // La puntuación se duplica por cada fantasma capturado
        const scoreMultiplier = Math.pow( 2, game.ghosts.filter( ghost => ghost.frightened ).length - 1 );
        game.score += 100 * scoreMultiplier;
        
        // Reiniciar posición del fantasma
        g.x = g.x;
        g.y = g.y;
        g.state = 'waiting';
        g.inPen = true;
        g.waitUntil = game.frame + RELEASE_DELAYS[ g.kind ];
        g.frightened = false;  // Desactivar modo asustado para este fantasma
        
      } else {
        game.lives--;
        if ( game.lives <= 0 ) {
          game.state = 'lost';
          return;
        }
        resetPositions( game );
      }
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
