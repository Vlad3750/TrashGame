import { Actor, Animation, AnimationStrategy, Circle, CollisionType, Color, Scene, vec } from 'excalibur'
import {
  BOSS, CHECKPOINTS, COL, ENEMIES, PLATFORMS, PLAYER,
  SEEDS, SEEDS_TO_BEAT_BOSS, WASTE, WORLD,
} from './config.js'
import { Player } from './player.js'
import { Resources } from './resources.js'
import { Tree } from './tree.js'
import { hud } from './hud.js'

const ENEMY = { w: 72, h: 72, speed: 75 }

// ---- geometry helpers ----
const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
const circleRect = (cx, cy, r, rc) => {
  const nx = Math.max(rc.x, Math.min(cx, rc.x + rc.w))
  const ny = Math.max(rc.y, Math.min(cy, rc.y + rc.h))
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r
}

export class Level extends Scene {
  onInitialize(engine) {
    this.engine = engine
    this.t = 0
    this.seeds = 0
    this.won = false
    this.bossMsgCd = 0
    this.bossIntroShown = false

    this.platformRects = []
    this.wasteRects = []
    this.glows = []
    this.seedItems = []
    this.enemies = []
    this.checkpoints = []

    this._buildWorld()

    // player at first checkpoint
    const c0 = CHECKPOINTS[0]
    this.player = new Player({ x: c0.x, y: c0.y - PLAYER.h / 2 })
    this.add(this.player)

    this.tree = new Tree()
    this.tree.addTo(this)

    this.camera.strategy.elasticToActor(this.player, 0.12, 0.16)
    this.camera.zoom = 1

    hud.setSeeds(0, SEEDS_TO_BEAT_BOSS)
    hud.setTree(this.tree.sizeLabel(PLAYER.h), false)
  }

  _buildWorld() {
    // distant hills for depth
    for (const h of [{ x: 600, y: 760, w: 1400, c: '#13243a' }, { x: 2600, y: 720, w: 1800, c: '#102033' }, { x: 4200, y: 780, w: 1600, c: '#0e1b2c' }]) {
      this.add(new Actor({ pos: vec(h.x, h.y), width: h.w, height: 600, color: Color.fromHex(h.c), z: 1, collisionType: CollisionType.PreventCollision }))
    }

    // solid platforms (brown body + grass cap)
    for (const p of PLATFORMS) {
      const cx = p.x + p.w / 2
      const cy = p.y + p.h / 2
      this.add(new Actor({ pos: vec(cx, cy), width: p.w, height: p.h, color: COL.soil, collisionType: CollisionType.Fixed, z: 10 }))
      this.add(new Actor({ pos: vec(cx, p.y + 6), width: p.w, height: 12, color: COL.grass, collisionType: CollisionType.PreventCollision, z: 11 }))
      this.platformRects.push(p)
    }

    // toxic-waste pools (body + pulsing glow surface)
    for (const w of WASTE) {
      this.add(new Actor({ pos: vec(w.x + w.w / 2, w.y + w.h / 2), width: w.w, height: w.h, color: COL.wasteBody, collisionType: CollisionType.PreventCollision, z: 4 }))
      const glow = new Actor({ pos: vec(w.x + w.w / 2, w.y + 7), width: w.w, height: 14, color: COL.wasteGlow, collisionType: CollisionType.PreventCollision, z: 5 })
      this.add(glow)
      this.glows.push(glow)
      this.wasteRects.push(w)
    }

    // seeds
    for (const s of SEEDS) {
      const a = new Actor({ pos: vec(s.x, s.y), z: 40, collisionType: CollisionType.PreventCollision })
      a.graphics.use(new Circle({ radius: 11, color: COL.seed }))
      this.add(a)
      this.seedItems.push({ a, x: s.x, baseY: s.y, taken: false, phase: s.x * 0.01 })
    }

    // enemies (animated blobby sprite)
    for (const e of ENEMIES) {
      const a = new Actor({ pos: vec(e.x, e.y), width: ENEMY.w, height: ENEMY.h, z: 45, collisionType: CollisionType.PreventCollision })
      const frames = [Resources.blobby1.toSprite(), Resources.blobby2.toSprite()]
      for (const f of frames) f.destSize = { width: ENEMY.w, height: ENEMY.h }
      const anim = new Animation({
        frames: frames.map((graphic) => ({ graphic, duration: 250 })),
        strategy: AnimationStrategy.Loop,
      })
      a.graphics.use(anim)
      this.add(a)
      this.enemies.push({ a, baseX: e.x, y: e.y, range: e.range, dir: 1, alive: true })
    }

    // checkpoints (pole + flag)
    for (let i = 0; i < CHECKPOINTS.length; i++) {
      const c = CHECKPOINTS[i]
      this.add(new Actor({ pos: vec(c.x, c.y - 38), width: 6, height: 76, color: Color.fromHex('#9aa3ad'), z: 14, collisionType: CollisionType.PreventCollision }))
      const flag = new Actor({ pos: vec(c.x + 18, c.y - 60), width: 30, height: 20, color: i === 0 ? COL.flagOn : COL.flagOff, z: 15, collisionType: CollisionType.PreventCollision })
      this.add(flag)
      this.checkpoints.push({ x: c.x, groundTop: c.y, standY: c.y - PLAYER.h / 2, flag, active: i === 0 })
    }

    // boss — Garbage Titan
    const bx = BOSS.x, gh = BOSS.h, gw = BOSS.w
    const cy = BOSS.y - gh / 2
    const body = new Actor({ pos: vec(bx, cy), width: gw, height: gh, color: COL.boss, z: 48, collisionType: CollisionType.PreventCollision })
    const eye = new Actor({ pos: vec(0, -gh * 0.18), width: 46, height: 46, z: 49 }); eye.graphics.use(new Circle({ radius: 23, color: COL.bossEye }))
    body.addChild(eye)
    for (const dx of [-50, 0, 55]) { const drip = new Actor({ pos: vec(dx, gh * 0.3), width: 18, height: 18, z: 49 }); drip.graphics.use(new Circle({ radius: 9, color: COL.bossAcid })); body.addChild(drip) }
    this.add(body)
    this.boss = { a: body, alive: true, rect: { x: bx - gw / 2, y: BOSS.y - gh, w: gw, h: gh } }
  }

  // ---------- per-frame ----------
  onPostUpdate(engine, elapsedMs) {
    if (this.won || !this.player) return
    const dt = Math.min(elapsedMs / 1000, 0.05)
    this.t += dt
    this.bossMsgCd = Math.max(0, this.bossMsgCd - dt)

    this.player.control(engine, this.platformRects, dt)

    // keep player inside the world horizontally
    this.player.pos.x = Math.max(WORLD.left + PLAYER.w / 2, Math.min(WORLD.right - PLAYER.w / 2, this.player.pos.x))

    // aim the tree at the cursor
    let cur = engine.input.pointers.primary.lastWorldPos
    if (!cur || (cur.x === 0 && cur.y === 0)) cur = vec(this.player.pos.x + this.player.facing * 120, this.player.pos.y)
    this.tree.setSeeds(this.seeds)
    this.tree.aim(this.player.pos, cur)

    this._animateScenery()
    this._enemies(dt)
    this._pickups()
    this._hazards()
    this._checkpoints()
    this._boss()
  }

  _animateScenery() {
    const pulse = 0.55 + 0.35 * Math.sin(this.t * 4)
    for (const g of this.glows) g.graphics.opacity = pulse
    for (const s of this.seedItems) {
      if (s.taken) continue
      s.a.pos.y = s.baseY + Math.sin(this.t * 2 + s.phase) * 5
      s.a.graphics.opacity = 0.7 + 0.3 * Math.sin(this.t * 5 + s.phase)
    }
  }

  _enemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue
      e.a.pos.x += e.dir * ENEMY.speed * dt
      if (e.a.pos.x > e.baseX + e.range) { e.a.pos.x = e.baseX + e.range; e.dir = -1 }
      else if (e.a.pos.x < e.baseX - e.range) { e.a.pos.x = e.baseX - e.range; e.dir = 1 }
      e.a.graphics.current.flipHorizontal = e.dir < 0

      const er = { x: e.a.pos.x - ENEMY.w / 2, y: e.a.pos.y - ENEMY.h / 2, w: ENEMY.w, h: ENEMY.h }
      // tree hit?
      if (circleRect(this.tree.tipX, this.tree.tipY, this.tree.canopyR, er)) {
        e.alive = false
        e.a.kill()
        hud.banner('🌳 Enemy uprooted!', 'good')
        continue
      }
      // touch death?
      if (aabb(this._playerRect(), er)) this._die('Hit by trash! Back to checkpoint')
    }
  }

  _pickups() {
    for (const s of this.seedItems) {
      if (s.taken) continue
      const sr = { x: s.a.pos.x - 12, y: s.a.pos.y - 12, w: 24, h: 24 }
      if (aabb(this._playerRect(), sr)) {
        s.taken = true
        s.a.kill()
        this.seeds++
        hud.setSeeds(this.seeds, SEEDS_TO_BEAT_BOSS)
        const ready = this.seeds >= SEEDS_TO_BEAT_BOSS
        hud.setTree(this.tree.sizeLabel(PLAYER.h) /* updated next frame */, ready)
        if (this.seeds === SEEDS_TO_BEAT_BOSS) hud.banner('Your tree can now fell the Titan! ⚔️', 'good')
      }
    }
    // refresh tree size label (len updates after setSeeds)
    this.tree.setSeeds(this.seeds)
    hud.setTree(this.tree.sizeLabel(PLAYER.h), this.seeds >= SEEDS_TO_BEAT_BOSS)
  }

  _hazards() {
    const pr = this._playerRect()
    for (const w of this.wasteRects) {
      if (aabb(pr, w)) { this._die('☠️ Toxic waste! Respawning…'); return }
    }
  }

  _checkpoints() {
    const pr = this._playerRect()
    for (const c of this.checkpoints) {
      if (c.active) continue
      const cr = { x: c.x - 24, y: c.groundTop - 80, w: 60, h: 90 }
      if (aabb(pr, cr)) {
        c.active = true
        c.flag.color = COL.flagOn
        this.player.respawnPoint = vec(c.x, c.standY)
        hud.banner('⛳ Checkpoint reached', 'info')
      }
    }
  }

  _boss() {
    const b = this.boss
    if (!b.alive) return

    if (!this.bossIntroShown && Math.abs(this.player.pos.x - BOSS.x) < 700) {
      this.bossIntroShown = true
      hud.banner('⚠ GARBAGE TITAN — strike it with a 3× tree!', 'warn')
    }

    const canopyHits = circleRect(this.tree.tipX, this.tree.tipY, this.tree.canopyR, b.rect)
    if (canopyHits) {
      if (this.seeds >= SEEDS_TO_BEAT_BOSS) {
        b.alive = false
        b.a.kill()
        this._win()
      } else if (this.bossMsgCd <= 0) {
        this.bossMsgCd = 0.9
        hud.banner(`Tree too weak (${this.tree.sizeLabel(PLAYER.h)})! Need ${SEEDS_TO_BEAT_BOSS} seeds — find another path.`, 'warn')
        // knock the player back toward the seeds
        const away = this.player.pos.x < BOSS.x ? -1 : 1
        this.player.vel.x = away * 420
        this.player.vel.y = -340
      }
      return
    }
    // touching the titan's body is lethal
    if (aabb(this._playerRect(), b.rect)) this._die('The Titan swatted you!')
  }

  _playerRect() {
    return { x: this.player.pos.x - PLAYER.w / 2, y: this.player.pos.y - PLAYER.h / 2, w: PLAYER.w, h: PLAYER.h }
  }

  _die(msg) {
    this.player.respawn()
    hud.banner(msg, 'warn')
  }

  _win() {
    this.won = true
    hud.banner('🌍 The Garbage Titan falls — the world turns green!', 'good')
    hud.showWin(true)
  }
}
