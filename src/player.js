import { Actor, Circle, CollisionType, Keys, vec } from 'excalibur'
import { COL, PHYS, PLAYER } from './config.js'

const LEFT = [Keys.A, Keys.Left]
const RIGHT = [Keys.D, Keys.Right]
const JUMP = [Keys.Space, Keys.W, Keys.Up]

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
  }

  onInitialize() {
    // simple face so the cyan block reads as a character
    const mkEye = (dx) => {
      const eye = new Actor({ pos: vec(dx, -8), width: 10, height: 10, z: 51 })
      eye.graphics.use(new Circle({ radius: 5, color: COL.playerDark }))
      return eye
    }
    this.eyeL = mkEye(-8)
    this.eyeR = mkEye(8)
    this.addChild(this.eyeL)
    this.addChild(this.eyeR)
  }

  get half() { return vec(PLAYER.w / 2, PLAYER.h / 2) }

  control(engine, platforms, dt) {
    if (this.dead) return
    const kb = engine.input.keyboard

    // horizontal
    const left = LEFT.some((k) => kb.isHeld(k))
    const right = RIGHT.some((k) => kb.isHeld(k))
    this.vel.x = (right ? PHYS.moveSpeed : 0) - (left ? PHYS.moveSpeed : 0)
    if (this.vel.x > 0) this.facing = 1
    else if (this.vel.x < 0) this.facing = -1

    // ground check via foot sensor
    const left_ = this.pos.x - PLAYER.w / 2
    const bottom = this.pos.y + PLAYER.h / 2
    const sensor = { x: left_ + 5, y: bottom - 2, w: PLAYER.w - 10, h: 8 }
    const onGround =
      this.vel.y >= -20 && platforms.some((p) => aabbOverlap(sensor.x, sensor.y, sensor.w, sensor.h, p))

    if (onGround) {
      this.grounded = true
      this.coyote = PHYS.coyoteTime
      if (this.vel.y > 0) this.vel.y = 0
    } else {
      this.grounded = false
      this.coyote = Math.max(0, this.coyote - dt)
    }

    // jump
    if (JUMP.some((k) => kb.wasPressed(k)) && (this.grounded || this.coyote > 0)) {
      this.vel.y = -PHYS.jumpSpeed
      this.grounded = false
      this.coyote = 0
    }

    // variable jump height: release early = shorter hop
    if (this.vel.y < 0 && !JUMP.some((k) => kb.isHeld(k))) {
      this.vel.y += PHYS.gravity * 0.55 * dt
    }

    // terminal velocity (limits tunneling through thin platforms)
    if (this.vel.y > 1200) this.vel.y = 1200

    // face the direction of travel
    this.eyeL.pos.x = -8 + this.facing * 4
    this.eyeR.pos.x = 8 + this.facing * 4
  }

  respawn() {
    this.vel = vec(0, 0)
    this.pos = vec(this.respawnPoint.x, this.respawnPoint.y)
  }
}
