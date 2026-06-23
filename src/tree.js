import { Actor, Circle, CollisionType, Rectangle, vec } from 'excalibur'
import { COL, TREE } from './config.js'

// The tree is a weapon that sprouts from the player and points toward the cursor.
// It is simulated as a weighted bob on a rigid arm (a pendulum): it eases toward
// the aim, trails when the player moves, and sags under gravity. The bigger it
// grows the more mass it has — so it aims slower, lags more, and swings heavier.
export class Tree {
  constructor() {
    const noPhysics = { collisionType: CollisionType.PreventCollision }
    this.trunk = new Actor({ z: 60, ...noPhysics })
    this.canopy = new Actor({ z: 61, ...noPhysics })
    this.canopyHi = new Actor({ z: 62, ...noPhysics })

    this.len = TREE.baseLen
    this.canopyR = TREE.baseCanopy
    this.mass = 1

    // pendulum bob state (canopy position in world space)
    this.bobX = 0; this.bobY = 0
    this.bvX = 0; this.bvY = 0
    this.inited = false

    this.tipX = 0; this.tipY = 0
    this.angle = 0
    this.tanX = 0; this.tanY = -1
    this.tipSpeed = 0

    this.lungeT = 0
    this.swingSign = 1
    this._pendingSwing = 0
    this.canopyPop = 0

    this._seeds = -1
    this.setSeeds(0)
  }

  addTo(scene) {
    scene.add(this.trunk)
    scene.add(this.canopy)
    scene.add(this.canopyHi)
  }

  // Rebuild graphics + recompute mass only when the seed count changes.
  setSeeds(seeds) {
    if (seeds === this._seeds) return
    this._seeds = seeds
    const g = Math.min(seeds, TREE.maxSeedsForGrowth)
    this.len = TREE.baseLen + g * TREE.lenPerSeed
    this.canopyR = TREE.baseCanopy + g * TREE.canopyPerSeed
    this.mass = 1 + g * TREE.massPerSeed
    this.thickness = 10 + g * 0.5

    this.trunk.graphics.use(new Rectangle({ width: this.len, height: this.thickness, color: COL.trunk }))
    this.canopy.graphics.use(new Circle({ radius: this.canopyR, color: COL.canopy }))
    this.canopyHi.graphics.use(new Circle({ radius: this.canopyR * 0.55, color: COL.canopyHi }))
  }

  sizeLabel(playerH) {
    return (this.len / playerH).toFixed(1) + '×'
  }

  // Triggered on click: alternating slash impulse + a forward lunge.
  swing() {
    this.swingSign *= -1
    this._pendingSwing = this.swingSign
    this.lungeT = TREE.lungeDur
    this.canopyPop = 1
  }

  update(playerPos, cursor, dt) {
    const ax = playerPos.x
    const ay = playerPos.y - 6

    let dx = cursor.x - ax, dy = cursor.y - ay
    const m = Math.hypot(dx, dy) || 1
    dx /= m; dy /= m

    if (!this.inited) {
      this.bobX = ax + dx * this.len
      this.bobY = ay + dy * this.len
      this.inited = true
    }

    // current reach including the lunge thrust
    let reach = this.len
    if (this.lungeT > 0) {
      this.lungeT = Math.max(0, this.lungeT - dt)
      reach = this.len * (1 + TREE.lungeAmount * (this.lungeT / TREE.lungeDur))
    }

    // muscle spring toward the aim point (inverse mass => heavier aims slower)
    const aimX = ax + dx * reach
    const aimY = ay + dy * reach
    let accX = (aimX - this.bobX) * TREE.stiffness / this.mass
    let accY = (aimY - this.bobY) * TREE.stiffness / this.mass
    // gravity sag — heavier trees droop more
    accY += TREE.gravitySag * (this.mass - 1)

    // swing impulse (tangential to the arm) + a touch of forward lunge velocity
    if (this._pendingSwing) {
      let armx = this.bobX - ax, army = this.bobY - ay
      const am = Math.hypot(armx, army) || 1
      const tx = -army / am, ty = armx / am
      const imp = (TREE.swingImpulse / this.mass) * this._pendingSwing
      this.bvX += tx * imp + dx * imp * 0.3
      this.bvY += ty * imp + dy * imp * 0.3
      this._pendingSwing = 0
    }

    // integrate with damping
    const fr = Math.max(0, 1 - TREE.friction * dt)
    this.bvX = (this.bvX + accX * dt) * fr
    this.bvY = (this.bvY + accY * dt) * fr
    this.bobX += this.bvX * dt
    this.bobY += this.bvY * dt

    // rigid-arm constraint: keep the bob exactly `reach` from the anchor
    let cx = this.bobX - ax, cy = this.bobY - ay
    const d = Math.hypot(cx, cy) || 1
    const nx = cx / d, ny = cy / d
    this.bobX = ax + nx * reach
    this.bobY = ay + ny * reach
    // remove radial velocity so it behaves like a pendulum
    const radial = this.bvX * nx + this.bvY * ny
    this.bvX -= radial * nx
    this.bvY -= radial * ny

    this.tipX = this.bobX
    this.tipY = this.bobY
    this.angle = Math.atan2(ny, nx)
    this.tanX = -ny; this.tanY = nx
    this.tipSpeed = Math.hypot(this.bvX, this.bvY)

    // trunk: stretch a fixed-length rectangle to the current reach
    this.trunk.pos = vec(ax + nx * reach * 0.5, ay + ny * reach * 0.5)
    this.trunk.rotation = this.angle
    this.trunk.scale = vec(reach / this.len, 1)

    // canopy + swing pop
    if (this.canopyPop > 0) this.canopyPop = Math.max(0, this.canopyPop - dt / 0.18)
    const pop = 1 + 0.35 * this.canopyPop
    this.canopy.pos = vec(this.tipX, this.tipY)
    this.canopy.scale = vec(pop, pop)
    this.canopyHi.pos = vec(this.tipX - this.canopyR * 0.3, this.tipY - this.canopyR * 0.3)
    this.canopyHi.scale = vec(pop, pop)
  }
}
