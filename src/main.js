import { DisplayMode, Engine, SolverStrategy, vec } from 'excalibur'
import { COL, PHYS, VIEW } from './config.js'
import { Level } from './level.js'
import { hud } from './hud.js'
import './style.css'

const game = new Engine({
  canvasElementId: 'game',
  width: VIEW.width,
  height: VIEW.height,
  displayMode: DisplayMode.FitScreenAndFill,
  backgroundColor: COL.sky,
  antialiasing: true,
  suppressPlayButton: true,
  physics: {
    solver: SolverStrategy.Arcade,
    gravity: vec(0, PHYS.gravity),
  },
})

game.addScene('level', new Level())

hud.onPlay(async () => {
  hud.showIntro(false)
  await game.start()
  game.goToScene('level')
})

hud.onRestart(() => window.location.reload())

// show the intro card on load
hud.showIntro(true)
