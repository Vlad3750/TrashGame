import {
  Actor, Animation, AnimationStrategy, CollisionType, Keys,
  SpriteSheet, range, vec,
} from 'excalibur'
import { COL, MOBILITY, PHYS, PLAYER, SLIDE } from './config.js'
import { Resources } from './resources.js'

// sprite frames are 96x64; scale so the character reads ~110px tall
const FRAME_W = 96
const FRAME_H = 64
const SPRITE_HEIGHT = 110
const SPRITE_SCALE = SPRITE_HEIGHT / FRAME_H
// feet are at the bottom row of the frame — align them to the collision-box bottom.
// Excalibur multiplies graphics.offset by the sprite scale, so divide it back out.
const SPRITE_OFFSET_Y = (PLAYER.h / 2 - SPRITE_HEIGHT / 2) / SPRITE_SCALE

const mkAnim = (image, count, frameDuration, strategy = AnimationStrategy.Loop) => {
  const sheet = SpriteSheet.fromImageSource({
    image,
    grid: { rows: 1, columns: count, spriteWidth: FRAME_W, spriteHeight: FRAME_H },
  })
  const anim = Animation.fromSpriteSheet(sheet, range(0, count - 1), frameDuration, strategy)
  anim.scale = vec(SPRITE_SCALE, SPRITE_SCALE)
  return anim
}

const LEFT = [Keys.A, Keys.Left]
const RIGHT = [Keys.D, Keys.Right]
const JUMP = [Keys.Space, Keys.W, Keys.Up]
const SLIDE_KEYS = [Keys.S, Keys.Down, Keys.ShiftLeft, Keys.ShiftRight]

const aabbOverlap = (ax, ay, aw, ah, b) =>
  ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y

export class Player extends Actor {
  constructor(spawn) {
    super({
      pos: vec(spawn.x, spawn.y),
      width: PLAYER.w,
      height: PLAYER.h,
      color: COL.player,
      collisionType: CollisionType.Active,
      z: 50,
    })
    this.spawn = vec(spawn.x, spawn.y)
    this.respawnPoint = vec(spawn.x, spawn.y)
    this.grounded = false
    this.coyote = 0
    this.facing = 1
    this.dead = false
    this.justLanded = 0   // impact speed on the frame we touch down (read+reset by level)
    this.moving = false
    this.sliding = false
    this.slideT = 0
    this.slideCd = 0
    this.slideDir = 1
  }

  onInitialize() {
    this.anims = {
      idle: mkAnim(Resources.charIdle, 8, 110),
      run: mkAnim(Resources.charRun, 8, 70),
      jump: mkAnim(Resources.charJump, 6, 90, AnimationStrategy.Freeze),
      fall: mkAnim(Resources.charFall, 4, 110, AnimationStrategy.Freeze),
      slide: mkAnim(Resources.charSlide, 4, 80, AnimationStrategy.Freeze),
    }
    for (const key of Object.keys(this.anims)) {
      this.graphics.add(key, this.anims[key])
    }
    this.currentAnim = 'idle'
    this.graphics.use('idle')
    this.graphics.offset = vec(0, SPRITE_OFFSET_Y)
  }

  _updateAnim() {
    let next = 'idle'
    if (this.sliding) next = 'slide'
    else if (!this.grounded) next = this.vel.y < 0 ? 'jump' : 'fall'
    else if (this.vel.x !== 0) next = 'run'

    if (next !== this.currentAnim) {
      this.currentAnim = next
      const anim = this.anims[next]
      anim.reset()
      this.graphics.use(next)
    }
    // face travel direction
    this.graphics.flipHorizontal = this.facing < 0
  }

  get half() { return vec(PLAYER.w / 2, PLAYER.h / 2) }

  // weight: 0 (no tree) .. 1 (max growth) — bigger tree = slower run + weaker jump
  control(engine, platforms, dt, weight = 0) {
    if (this.dead) return
    const kb = engine.input.keyboard
    const moveSpeed = PHYS.moveSpeed * (1 - weight * MOBILITY.moveSlowMax)
    const jumpSpeed = PHYS.jumpSpeed * (1 - weight * MOBILITY.jumpSlowMax)

    this.slideCd = Math.max(0, this.slideCd - dt)

    // horizontal input
    const left = LEFT.some((k) => kb.isHeld(k))
    const right = RIGHT.some((k) => kb.isHeld(k))

    // start a slide: grounded, off cooldown, and already moving
    const wantSlide = SLIDE_KEYS.some((k) => kb.wasPressed(k))
    if (!this.sliding && this.grounded && this.slideCd <= 0 && wantSlide && Math.abs(this.vel.x) > SLIDE.minSpeed) {
      this.sliding = true
      this.slideT = SLIDE.duration
      this.slideDir = this.facing
    }

    if (this.sliding) {
      // locked forward dash that eases from slide speed back to run speed
      this.slideT -= dt
      const k = Math.max(0, this.slideT / SLIDE.duration)
      this.vel.x = this.slideDir * (moveSpeed + (SLIDE.speed - moveSpeed) * k)
      this.facing = this.slideDir
    } else {
      this.vel.x = (right ? moveSpeed : 0) - (left ? moveSpeed : 0)
      if (this.vel.x > 0) this.facing = 1
      else if (this.vel.x < 0) this.facing = -1
    }

    // ground check via foot sensor
    const left_ = this.pos.x - PLAYER.w / 2
    const bottom = this.pos.y + PLAYER.h / 2
    const sensor = { x: left_ + 5, y: bottom - 2, w: PLAYER.w - 10, h: 8 }
    const wasGrounded = this.grounded
    const fallSpeed = this.vel.y
    const onGround =
      this.vel.y >= -20 && platforms.some((p) => aabbOverlap(sensor.x, sensor.y, sensor.w, sensor.h, p))

    if (onGround) {
      if (!wasGrounded && fallSpeed > 140) this.justLanded = fallSpeed
      this.grounded = true
      this.coyote = PHYS.coyoteTime
      if (this.vel.y > 0) this.vel.y = 0
    } else {
      this.grounded = false
      this.coyote = Math.max(0, this.coyote - dt)
    }

    // end the slide when it times out or we leave the ground
    if (this.sliding && (this.slideT <= 0 || !this.grounded)) {
      this.sliding = false
      this.slideCd = SLIDE.cooldown
    }

    // jump
    if (JUMP.some((k) => kb.wasPressed(k)) && (this.grounded || this.coyote > 0)) {
      this.vel.y = -jumpSpeed
      this.grounded = false
      this.coyote = 0
    }

    // variable jump height: release early = shorter hop
    if (this.vel.y < 0 && !JUMP.some((k) => kb.isHeld(k))) {
      this.vel.y += PHYS.gravity * 0.55 * dt
    }

    // terminal velocity (limits tunneling through thin platforms)
    if (this.vel.y > 1200) this.vel.y = 1200

    this._updateAnim()
    this.moving = this.grounded && Math.abs(this.vel.x) > 20
  }

  respawn() {
    this.vel = vec(0, 0)
    this.pos = vec(this.respawnPoint.x, this.respawnPoint.y)
  }
}
