/**
 * Subtle Web Audio API notification sounds — no asset files required.
 * A shared AudioContext is reused across calls to avoid per-call cost.
 */

let audioCtx = null

function getCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      return null
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/** Play a single soft tone. */
function tone(ctx, freq, startTime, duration, peakGain, type = 'sine') {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.01)
}

/**
 * Short rising "send" sweep — like an iMessage whoosh.
 * Very subtle: 340 → 600 Hz over 140 ms at low volume.
 */
export function playSendSound() {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(340, t)
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.12)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.07, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.16)
}

/**
 * Soft two-note chime for incoming messages.
 * 660 Hz → 830 Hz staggered by 70 ms, both decaying quietly.
 */
export function playReceiveSound() {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, 660, t, 0.22, 0.07)
  tone(ctx, 830, t + 0.07, 0.22, 0.055)
}
