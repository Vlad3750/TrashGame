import { Actor, Animation, AnimationStrategy, Circle, CollisionType, Color, Scene, vec } from 'excalibur'
import {
  BOSS, CHECKPOINTS, COL, ENEMIES, PLATFORMS, PLAYER,
  SEEDS, SEEDS_TO_BEAT_BOSS, TREE, VIEW, WASTE, WORLD,
} from './config.js'
import { Player } from './player.js'
import { Resources } from './resources.js'
import { Tree } from './tree.js'
import { Particles } from './particles.js'
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

    this.particles = new Particles(this)
    this.dustCd = 0

    // trash that periodically erupts from the toxic pools and falls back in
    this.wasteTrash = []
    this.spurtCd = 0

    // click = swing the tree
    engine.input.pointers.primary.on('down', () => this._onClick())

    this.camera.strategy.elasticToActor(this.player, 0.12, 0.16)
    this.camera.zoom = 1

    hud.setSeeds(0, SEEDS_TO_BEAT_BOSS)
    hud.setTree(this.tree.sizeLabel(PLAYER.h), false)
  }

  _buildWorld() {
    // forest backdrop — a screen-filling actor that follows the camera (z below everything).
    // Scale to "cover" the viewport (preserve aspect, crop overflow) plus a small margin.
    const BG_W = 928, BG_H = 793
    const cover = Math.max(VIEW.width / BG_W, VIEW.height / BG_H) * 1.15
    const bgSprite = Resources.background.toSprite()
    bgSprite.destSize = { width: Math.ceil(BG_W * cover), height: Math.ceil(BG_H * cover) }
    this.bg = new Actor({ pos: vec(0, 0), z: -10, collisionType: CollisionType.PreventCollision })
    this.bg.graphics.use(bgSprite)
    this.add(this.bg)

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

    // boss — Garbage Titan: a giant blobby
    const bx = BOSS.x, gh = BOSS.h, gw = BOSS.w
    const cy = BOSS.y - gh / 2
    const body = new Actor({ pos: vec(bx, cy), width: gw, height: gh, z: 48, collisionType: CollisionType.PreventCollision })
    const bossFrames = [Resources.blobby1.toSprite(), Resources.blobby2.toSprite()]
    for (const f of bossFrames) f.destSize = { width: gw, height: gh }
    body.graphics.use(new Animation({
      frames: bossFrames.map((graphic) => ({ graphic, duration: 300 })),
      strategy: AnimationStrategy.Loop,
    }))
    this.add(body)

    // floating health bar above the Titan
    const barW = gw + 20, barH = 18, barY = BOSS.y - gh - 30
    this.add(new Actor({ pos: vec(bx, barY), width: barW + 6, height: barH + 6, color: Color.fromHex('#0b1220'), z: 55, collisionType: CollisionType.PreventCollision }))
    const fill = new Actor({ pos: vec(bx - barW / 2, barY), anchor: vec(0, 0.5), width: barW, height: barH, color: COL.flagOn, z: 56, collisionType: CollisionType.PreventCollision })
    this.add(fill)

    this.boss = {
      a: body, alive: true, hp: BOSS.maxHp, hitCd: 0,
      bar: { fill, w: barW }, barY,
      rect: { x: bx - gw / 2, y: BOSS.y - gh, w: gw, h: gh },
    }
  }

  // ---------- per-frame ----------
  onPostUpdate(engine, elapsedMs) {
    // keep the sky backdrop centered on the camera so it always fills the view
    if (this.bg) this.bg.pos = this.camera.pos.clone()
    if (this.won || !this.player) return
    const dt = Math.min(elapsedMs / 1000, 0.05)
    this.t += dt
    this.bossMsgCd = Math.max(0, this.bossMsgCd - dt)

    // bigger tree = heavier = slower run/jump
    const weight = Math.min(this.seeds, TREE.maxSeedsForGrowth) / TREE.maxSeedsForGrowth
    this.player.control(engine, this.platformRects, dt, weight)

    // keep player inside the world horizontally
    this.player.pos.x = Math.max(WORLD.left + PLAYER.w / 2, Math.min(WORLD.right - PLAYER.w / 2, this.player.pos.x))

    // landing impact + running dust
    if (this.player.justLanded) { this._landFx(this.player.justLanded); this.player.justLanded = 0 }
    this.dustCd = Math.max(0, this.dustCd - dt)
    if (this.player.moving && this.dustCd <= 0) { this._walkDust(); this.dustCd = 0.13 }

    // simulate the tree (pendulum on a rigid arm)
    let cur = engine.input.pointers.primary.lastWorldPos
    if (!cur || (cur.x === 0 && cur.y === 0)) cur = vec(this.player.pos.x + this.player.facing * 120, this.player.pos.y)
    this.tree.setSeeds(this.seeds)
    this.tree.update(this.player.pos, cur, dt)

    this._animateScenery()
    this._wasteSpurts(dt)
    this._enemies(dt)
    this._pickups()
    this._hazards()
    this._checkpoints()
    this._boss(dt)
    this.particles.update(dt)
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

  // Trash chunks erupt out of the toxic pools, arc just above the ground, then
  // fall back in with a little splash. Cheap self-managed actors (like particles).
  _wasteSpurts(dt) {
    const GRAV = 900

    // spawn a new chunk every so often from a random pool
    this.spurtCd -= dt
    if (this.spurtCd <= 0 && this.wasteRects.length) {
      this.spurtCd = 0.05 + Math.random() * 0.12
      const w = this.wasteRects[(Math.random() * this.wasteRects.length) | 0]
      const x = w.x + 10 + Math.random() * (w.w - 20)
      const surfaceY = w.y + 7
      // randomly a (smaller) plastic bottle or a (bigger) oil canister
      const isBottle = Math.random() < 0.5
      const sprite = (isBottle ? Resources.plasticBottle : Resources.oilCanister).toSprite()
      const size = isBottle ? 16 + Math.random() * 8 : 38 + Math.random() * 18
      sprite.destSize = { width: size, height: size }
      const a = new Actor({ pos: vec(x, surfaceY), z: 6, collisionType: CollisionType.PreventCollision })
      a.graphics.use(sprite)
      this.add(a)
      this.wasteTrash.push({
        a,
        surfaceY,
        vx: (Math.random() - 0.5) * 60,
        vy: -(420 + Math.random() * 200),   // pop ~100-180px above the surface
        spin: (Math.random() - 0.5) * 10,
      })
    }

    // integrate; remove when a chunk drops back to its pool surface
    for (let i = this.wasteTrash.length - 1; i >= 0; i--) {
      const t = this.wasteTrash[i]
      t.vy += GRAV * dt
      t.a.pos.x += t.vx * dt
      t.a.pos.y += t.vy * dt
      t.a.rotation += t.spin * dt
      if (t.vy > 0 && t.a.pos.y >= t.surfaceY) {
        this.particles.burst(t.a.pos.x, t.surfaceY, { count: 4, color: COL.wasteGlow, speed: 90, dir: -Math.PI / 2, spread: Math.PI / 2, gravity: 700, drag: 2.5, life: 0.3, size: 2.5, sizeVar: 1 })
        t.a.kill()
        this.wasteTrash.splice(i, 1)
      }
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
      // tree hit — only lands during a click-swing attack
      if (this.tree.attacking && circleRect(this.tree.tipX, this.tree.tipY, this.tree.canopyR, er)) {
        e.alive = false
        e.a.kill()
        this.particles.burst(e.a.pos.x, e.a.pos.y, { count: 14, color: COL.enemy, speed: 210, gravity: 800, drag: 2.4, life: 0.5, size: 4, sizeVar: 2 })
        this.particles.burst(e.a.pos.x, e.a.pos.y, { count: 8, color: COL.canopy, speed: 150, gravity: 450, drag: 2.2, life: 0.6, size: 3, sizeVar: 1.5 })
        this._shake(7, 150)
        hud.banner('🌳 Enemy uprooted!', 'good')
        continue
      }
      // touch death?
      if (aabb(this._playerRect(), er)) this._death('Hit by trash! Back to checkpoint', COL.player, 9)
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
        this.particles.burst(s.a.pos.x, s.a.pos.y, { count: 11, color: COL.seed, speed: 150, speedVar: 80, gravity: 220, drag: 3, life: 0.45, size: 3, sizeVar: 1.5 })
        this.particles.burst(s.a.pos.x, s.a.pos.y, { count: 5, color: COL.canopyHi, speed: 110, gravity: 150, drag: 3, life: 0.5, size: 2.5 })
        this._shake(2, 70)
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
      if (aabb(pr, w)) { this._death('☠️ Toxic waste! Respawning…', COL.wasteGlow, 13); return }
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

  _boss(dt = 0) {
    const b = this.boss
    if (!b.alive) return

    b.hitCd = Math.max(0, b.hitCd - dt)

    if (!this.bossIntroShown && Math.abs(this.player.pos.x - BOSS.x) < 700) {
      this.bossIntroShown = true
      hud.banner('⚠ GARBAGE TITAN — strike it with a 3× tree!', 'warn')
    }

    const canopyHits = circleRect(this.tree.tipX, this.tree.tipY, this.tree.canopyR, b.rect)
    if (canopyHits) {
      if (this.seeds >= SEEDS_TO_BEAT_BOSS) {
        if (b.hitCd > 0) return
        b.hitCd = BOSS.hitCooldown
        b.hp = Math.max(0, b.hp - 1)
        this._updateBossBar()
        const bc = { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 }

        if (b.hp > 0) {
          // a solid hit, but the Titan still stands
          this.particles.burst(this.tree.tipX, this.tree.tipY, { count: 16, color: COL.bossAcid, speed: 260, speedVar: 160, gravity: 380, drag: 1.9, life: 0.5, size: 4, sizeVar: 2 })
          this._shake(12, 220)
          b.a.graphics.opacity = 0.4
          this.engine.clock.schedule(() => { b.a.graphics.opacity = 1 }, 90)
          return
        }

        b.alive = false
        b.a.kill()
        b.bar.fill.kill()
        for (let k = 0; k < 3; k++) {
          this.particles.burst(bc.x, bc.y, { count: 26, color: k % 2 ? COL.canopy : COL.bossAcid, speed: 330, speedVar: 200, gravity: 420, drag: 1.7, life: 0.95, size: 6, sizeVar: 3 })
        }
        this._shake(26, 650)
        this._win()
      } else if (this.bossMsgCd <= 0) {
        this.bossMsgCd = 0.9
        hud.banner(`Tree too weak (${this.tree.sizeLabel(PLAYER.h)})! Need ${SEEDS_TO_BEAT_BOSS} seeds — find another path.`, 'warn')
        this.particles.burst(this.tree.tipX, this.tree.tipY, { count: 10, color: COL.bossAcid, speed: 190, gravity: 320, drag: 2.4, life: 0.4, size: 3, sizeVar: 1.5 })
        this._shake(8, 180)
        // knock the player back toward the seeds
        const away = this.player.pos.x < BOSS.x ? -1 : 1
        this.player.vel.x = away * 420
        this.player.vel.y = -340
      }
      return
    }
    // touching the titan's body is lethal
    if (aabb(this._playerRect(), b.rect)) this._death('The Titan swatted you!', COL.bossEye, 12)
  }

  _updateBossBar() {
    const b = this.boss
    const ratio = b.hp / BOSS.maxHp
    b.bar.fill.scale = vec(ratio, 1)
    // green when healthy, shading to red as it drops
    b.bar.fill.color = ratio > 0.5 ? COL.flagOn : ratio > 0.25 ? COL.seed : COL.bossEye
  }

  // ---------- juice helpers ----------
  _shake(mag, durationMs) {
    this.camera.shake(mag, mag, durationMs)
  }

  _onClick() {
    if (this.won || !this.player || this.player.dead) return
    this.tree.swing()
    const dir = Math.atan2(this.tree.tanY * this.tree.swingSign, this.tree.tanX * this.tree.swingSign)
    this.particles.burst(this.tree.tipX, this.tree.tipY, {
      count: 9, color: COL.canopyHi, dir, spread: 1.0, speed: 250, speedVar: 130,
      gravity: 240, drag: 2.6, life: 0.32, size: 4, sizeVar: 2,
    })
    const sizeF = this.tree.len / TREE.baseLen
    this._shake(3 + sizeF * 1.4, 90)
  }

  _landFx(speed) {
    const feetY = this.player.pos.y + PLAYER.h / 2
    const f = Math.min(1, speed / 900)
    this.particles.burst(this.player.pos.x, feetY, {
      count: 6 + ((f * 8) | 0), color: COL.soil, dir: -Math.PI / 2, spread: 1.7,
      speed: 90 + f * 130, speedVar: 60, gravity: 700, drag: 3, life: 0.3, size: 3, sizeVar: 2,
    })
    this._shake(2 + f * 7, 120)
  }

  _walkDust() {
    const feetY = this.player.pos.y + PLAYER.h / 2
    this.particles.burst(this.player.pos.x - this.player.facing * 12, feetY, {
      count: 2, color: COL.soil, dir: -Math.PI / 2 + this.player.facing * 0.5, spread: 0.5,
      speed: 55, speedVar: 30, gravity: 300, drag: 3, life: 0.26, size: 2.5, sizeVar: 1,
    })
  }

  _playerRect() {
    return { x: this.player.pos.x - PLAYER.w / 2, y: this.player.pos.y - PLAYER.h / 2, w: PLAYER.w, h: PLAYER.h }
  }

  _death(msg, color = COL.wasteGlow, mag = 10) {
    this.particles.burst(this.player.pos.x, this.player.pos.y, {
      count: 16, color, speed: 210, speedVar: 110, gravity: 500, drag: 2.2, life: 0.5, size: 4, sizeVar: 2,
    })
    this._shake(mag, 260)
    this.player.respawn()
    hud.banner(msg, 'warn')
  }

  _win() {
    this.won = true
    // freeze the player so physics stops moving it once the game is over
    this.player.vel = vec(0, 0)
    this.player.acc = vec(0, 0)
    this.player.body.collisionType = CollisionType.Fixed
    this.player.graphics.use('idle')
    hud.banner('🌍 The Garbage Titan falls — the world turns green!', 'good')
    hud.showWin(true)
  }
}
