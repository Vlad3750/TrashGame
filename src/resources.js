import { ImageSource, Loader } from 'excalibur'

const char = (name) =>
  new ImageSource(`/CharacterPack-Version1/Character-No-Weapon/Character-NoWeapon-${name}.png`)

export const Resources = {
  blobby1: new ImageSource('/sprites/blobby1.png'),
  blobby2: new ImageSource('/sprites/blobby2.png'),
  charIdle: char('Idle'),
  charRun: char('Run'),
  charJump: char('Jump'),
  charFall: char('fall'),
}

export const loader = new Loader(Object.values(Resources))
loader.suppressPlayButton = true
