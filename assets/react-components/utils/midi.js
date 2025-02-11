/// <reference types="webmidi" />

// Frequency calculation helper
function midiToFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12)
}

export const MIDI_NOTES = {
  a: 60, // Middle C
  s: 62,
  d: 64,
  f: 65,
  g: 67,
  h: 69,
  j: 71,
  k: 72,
  l: 74,
  ";": 76,
  "'": 77,
  w: 61,
  e: 63,
  t: 66,
  y: 68,
  u: 70,
  o: 73,
  p: 75,
}

let audioContext = null
const oscillators = new Map()

export function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

export async function setupMIDI() {
  if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
    console.log("WebMIDI not supported, falling back to Web Audio API")
    return null
  }

  try {
    return await navigator.requestMIDIAccess()
  } catch (err) {
    console.log("MIDI access denied, falling back to Web Audio API")
    return null
  }
}

export function noteOn(midiAccess, note, velocity = 98) {
  if (midiAccess) {
    const outputs = Array.from(midiAccess.outputs.values())
    outputs.forEach((output) => {
      output.send([0x90, note, velocity])
    })
  } else {
    // Web Audio API fallback
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "triangle"
    const frequency = midiToFrequency(note)
    if (isFinite(frequency)) {
      osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    } else {
      console.warn(`Invalid frequency for note ${note}`)
      return
    }

    const safeVelocity = isFinite(velocity) ? velocity : 98
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime((safeVelocity / 127) * 0.3, ctx.currentTime + 0.01)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    oscillators.set(note, osc)
  }
}

export function noteOff(midiAccess, note) {
  if (midiAccess) {
    const outputs = Array.from(midiAccess.outputs.values())
    outputs.forEach((output) => {
      output.send([0x80, note, 0])
    })
  } else {
    // Web Audio API fallback
    const osc = oscillators.get(note)
    if (osc) {
      const ctx = getAudioContext()
      const gain = osc.connect(ctx.createGain())
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.01)
      setTimeout(() => {
        osc.stop()
        osc.disconnect()
      }, 10)
      oscillators.delete(note)
    }
  }
}
