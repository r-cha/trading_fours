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

// Create a single shared audio context for the entire application
let sharedAudioContext = null;
const oscillators = new Map();

// Debug flag - set to false to reduce console logs
const DEBUG = false;

// Get or create the audio context - this should be the only place we create an audio context
export function getAudioContext() {
  if (typeof window === 'undefined') return null; // Guard against server-side rendering
  
  if (!sharedAudioContext) {
    try {
      // Create audio context with appropriate constructor
      sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (DEBUG) console.log("Shared audio context created:", sharedAudioContext.state);
      
      // Resume context when created
      if (sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume().then(() => {
          if (DEBUG) console.log('Shared audio context resumed successfully');
        });
      }
      
      // Add event listener to document to resume context on user interaction
      document.addEventListener('click', function resumeAudioContext() {
        if (sharedAudioContext && sharedAudioContext.state !== 'running') {
          sharedAudioContext.resume();
        }
      }, { once: true });
      
    } catch (error) {
      console.error("Failed to create audio context:", error);
    }
  }
  
  return sharedAudioContext;
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

// This function is now only used for Web Audio fallback
export function noteOn(midiAccess, note, velocity = 98) {
  // Skip MIDI hardware path - this is handled directly in usePiano
  // Web Audio API fallback
  try {
    // First, check if there's already an oscillator for this note and stop it
    noteOff(null, note)
      
    const ctx = getAudioContext()
    if (!ctx) {
      if (DEBUG) console.error("No audio context available")
      return
    }
      
    // Make sure context is running
    if (ctx.state !== 'running') {
      ctx.resume().catch(err => console.error("Failed to resume audio context:", err))
    }
      
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    // Store gain node reference on the oscillator for noteOff
    osc.gainNode = gain

    osc.type = "triangle"
    const frequency = midiToFrequency(note)
    if (isFinite(frequency)) {
      osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    } else {
      if (DEBUG) console.warn(`Invalid frequency for note ${note}`)
      return
    }

    const safeVelocity = isFinite(velocity) ? velocity : 98
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime((safeVelocity / 127) * 0.3, ctx.currentTime + 0.01)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    oscillators.set(note, osc)
    if (DEBUG) console.log(`Note ${note} started at freq ${frequency}Hz with Web Audio API`)
  } catch (error) {
    console.error(`Error in noteOn for note ${note}:`, error)
  }
}

// This function is now only used for Web Audio fallback
export function noteOff(midiAccess, note) {
  // Skip MIDI hardware path - this is handled directly in usePiano
  // Web Audio API fallback
  const osc = oscillators.get(note)
  if (osc) {
    try {
      const ctx = getAudioContext()
      if (!ctx) return

      // Get the gain node that's already connected to the oscillator
      const gainNode = osc.gainNode
      if (gainNode) {
        // Set a release envelope
        gainNode.gain.setValueAtTime(gainNode.gain.value || 0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1) // Faster decay

        // Stop the oscillator after the release
        setTimeout(() => {
          try {
            osc.stop()
            osc.disconnect()
            if (DEBUG) console.log(`Note ${note} stopped with Web Audio API`)
          } catch (e) {
            if (DEBUG) console.warn(`Error stopping oscillator for note ${note}:`, e)
          }
        }, 100) // Give time for the release envelope
      } else {
        // Fallback if no gain node is stored
        osc.stop()
        osc.disconnect()
      }
      
      // Remove from active oscillators
      oscillators.delete(note)
    } catch (error) {
      console.error(`Error in noteOff for note ${note}:`, error)
    }
  }
}
