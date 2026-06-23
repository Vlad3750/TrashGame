import { ImageSource, Loader } from 'excalibur'

const char = (name) =>
  new ImageSource(`/CharacterPack-Version1/Character-No-Weapon/Character-NoWeapon-${name}.png`)

export const Resources = {
  blobby1: new ImageSource('/sprites/blobby1.png'),
  blobby2: new ImageSource('/sprites/blobby2.png'),
  tree: new ImageSource('/sprites/tree.png'),
  background: new ImageSource('/backgrounds/Free%20Pixel%20Art%20Forest/Preview/Background.png'),
  plasticBottle: new ImageSource('/sprites/plastic_bottle.png'),
  oilCanister: new ImageSource('/sprites/oil_canister.png'),
  charIdle: char('Idle'),
  charRun: char('Run'),
  charJump: char('Jump'),
  charFall: char('fall'),
  charSlide: char('Slide'),
}

export const loader = new Loader(Object.values(Resources))
loader.suppressPlayButton = true
