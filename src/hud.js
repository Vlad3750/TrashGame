// Thin DOM overlay over the Excalibur canvas: counters, banners, overlays.
const $ = (id) => document.getElementById(id)

let bannerTimer = 0

export const hud = {
  setSeeds(n, need) {
    $('seedCount').textContent = `${n} / ${need}`
    const pct = Math.min(100, (n / need) * 100)
    $('seedBar').style.width = pct + '%'
  },

  setTree(label, ready) {
    $('treeSize').textContent = label
    $('treeStat').classList.toggle('ready', ready)
    $('treeHint').textContent = ready ? 'BOSS-READY' : `grow to ${'3.0×'}`
  },

  banner(text, kind = 'info') {
    const el = $('banner')
    el.textContent = text
    el.className = 'banner show ' + kind
    clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => { el.className = 'banner' }, 2600)
  },

  showIntro(show) { $('intro').style.display = show ? 'flex' : 'none' },
  showWin(show) { $('win').style.display = show ? 'flex' : 'none' },

  onPlay(cb) { $('playBtn').addEventListener('click', cb) },
  onRestart(cb) { $('restartBtn').addEventListener('click', cb) },
}
