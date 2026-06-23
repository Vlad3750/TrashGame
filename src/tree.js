import { Actor, Circle, CollisionType, Rectangle, vec } from 'excalibur'
import { COL, TREE } from './config.js'

// The tree is a weapon that sprouts from the player and points at the cursor.
// Trunk = rotated rectangle (root at player, tip at canopy). Canopy = circle.
// Both length and canopy size scale with collected seeds.
export class Tree {
  constructor() {
    const noPhysics = { collisionType: CollisionType.PreventCollision }
    this.trunk = new Actor({ z: 60, ...noPhysics })
    this.canopy = new Actor({ z: 61, ...noPhysics })
    this.canopyHi = new Actor({ z: 62, ...noPhysics })

    this.len = TREE.baseLen
    this.canopyR = TREE.baseCanopy
    this.tipX = 0
    this.tipY = 0
    this._seeds = -1
    this.setSeeds(0)
  }

  addTo(scene) {
    scene.add(this.trunk)
    scene.add(this.canopy)
    scene.add(this.canopyHi)
  }

  // Rebuild graphics only when the seed count changes.
  setSeeds(seeds) {
    if (seeds === this._seeds) return
    this._seeds = seeds
    const g = Math.min(seeds, TREE.maxSeedsForGrowth)
    this.len = TREE.baseLen + g * TREE.lenPerSeed
    this.canopyR = TREE.baseCanopy + g * TREE.canopyPerSeed
    const thickness = 10 + g * 0.5

    this.trunk.graphics.use(new Rectangle({ width: this.len, height: thickness, color: COL.trunk }))
    this.canopy.graphics.use(new Circle({ radius: this.canopyR, color: COL.canopy }))
    this.canopyHi.graphics.use(new Circle({ radius: this.canopyR * 0.55, color: COL.canopyHi }))
  }

  // multiple of player height, e.g. "3.8×"
  sizeLabel(playerH) {
    return (this.len / playerH).toFixed(1) + '×'
  }

  // Aim from the player's "hands" toward the cursor world position.
  aim(playerPos, cursor) {
    const ax = playerPos.x
    const ay = playerPos.y - 6
    let dx = cursor.x - ax
    let dy = cursor.y - ay
    const m = Math.hypot(dx, dy) || 1
    dx /= m; dy /= m

    this.tipX = ax + dx * this.len
    this.tipY = ay + dy * this.len

    this.trunk.pos = vec(ax + dx * this.len * 0.5, ay + dy * this.len * 0.5)
    this.trunk.rotation = Math.atan2(dy, dx)

    this.canopy.pos = vec(this.tipX, this.tipY)
    this.canopyHi.pos = vec(this.tipX - this.canopyR * 0.3, this.tipY - this.canopyR * 0.3)
  }
}
