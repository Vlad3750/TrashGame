import { Actor, Circle, CollisionType, vec } from 'excalibur'

// Tiny self-managed particle system (one Circle actor per particle).
// Cheap, fully controllable, and avoids Excalibur's version-specific emitter API.
export class Particles {
  constructor(scene) {
    this.scene = scene
    this.list = []
  }

  burst(x, y, opts = {}) {
    const {
      count = 10,
      color,
      speed = 170,
      speedVar = 90,
      dir = -Math.PI / 2,   // default: upward
      spread = Math.PI * 2, // full circle
      life = 0.5,
      lifeVar = 0.18,
      size = 4,
      sizeVar = 2,
      gravity = 900,
      drag = 2.2,
      z = 55,
    } = opts

    for (let i = 0; i < count; i++) {
      const ang = dir + (Math.random() - 0.5) * spread
      const sp = Math.max(0, speed + (Math.random() - 0.5) * 2 * speedVar)
      const r = Math.max(1, size + (Math.random() - 0.5) * 2 * sizeVar)
      const lf = Math.max(0.06, life + (Math.random() - 0.5) * 2 * lifeVar)

      const a = new Actor({ pos: vec(x, y), z, collisionType: CollisionType.PreventCollision })
      a.graphics.use(new Circle({ radius: r, color }))
      this.scene.add(a)
      this.list.push({
        a,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: lf,
        max: lf,
        gravity,
        drag,
      })
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]
      const f = Math.max(0, 1 - p.drag * dt)
      p.vx *= f
      p.vy = p.vy * f + p.gravity * dt
      p.a.pos.x += p.vx * dt
      p.a.pos.y += p.vy * dt
      p.life -= dt
      const t = Math.max(0, p.life / p.max)
      p.a.graphics.opacity = t
      const s = 0.35 + 0.65 * t
      p.a.scale = vec(s, s)
      if (p.life <= 0) {
        p.a.kill()
        this.list.splice(i, 1)
      }
    }
  }
}
