import { useState, useEffect, useCallback, useRef } from "react"
import { setupMIDI, noteOn, noteOff } from "../utils/midi"

export function usePiano() {
  const [activeNotes, setActiveNotes] = useState(new Set())
  const [sustainedNotes, setSustainedNotes] = useState(new Set())
  const [midiAccess, setMidiAccess] = useState(null)
  const [octave, setOctave] = useState(0)
  const [sustain, setSustain] = useState(false)
  const [midiState, setMidiState] = useState({ status: "checking" }) // possible values: checking, available, denied, unsupported
  
  // Create refs for tracking seen messages and handling dependencies
  const handleNoteOnRef = useRef(null);
  const handleNoteOffRef = useRef(null);

  // Track seen MIDI messages to deduplicate
  const seenMessages = useRef(new Map());
  
  // Handle incoming MIDI messages from hardware devices
  const handleMIDIMessage = useCallback((message) => {
    const [status, note, velocity] = message.data;
    const channel = status & 0x0F; // Extract MIDI channel (0-15)
    
    // Create a message ID to deduplicate multiple events from different inputs
    const messageId = `${status}-${note}-${velocity}`;
    
    // Check if we've seen this exact message in the past 10ms (debounce)
    const now = Date.now();
    if (seenMessages.current.has(messageId)) {
      const lastTime = seenMessages.current.get(messageId);
      if (now - lastTime < 10) {
        // Skip this duplicate message
        return;
      }
    }
    // Record this message timestamp
    seenMessages.current.set(messageId, now);
    
    // Clean up old entries from the map every second
    if (now % 1000 < 16) { // Only run cleanup occasionally
      for (const [key, timestamp] of seenMessages.current.entries()) {
        if (now - timestamp > 1000) {
          seenMessages.current.delete(key);
        }
      }
    }
    
    // Note on (0x90) with velocity > 0
    if ((status & 0xf0) === 0x90 && velocity > 0) {
      // Get the note number
      console.log(`MIDI note on: ${note} (velocity: ${velocity})`);
      // We dispatch a custom event just once to record MIDI input
      const event = new CustomEvent("midi:note_on", {
        detail: { note, velocity }
      });
      window.dispatchEvent(event);
      // Also handle the note for audio output - use the ref to get the latest version
      if (handleNoteOnRef.current) {
        handleNoteOnRef.current(note);
      }
    }
    // Note off (0x80) or Note on with velocity 0
    else if ((status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0)) {
      console.log(`MIDI note off: ${note}`);
      // We dispatch a custom event just once to record MIDI input
      const event = new CustomEvent("midi:note_off", {
        detail: { note }
      });
      window.dispatchEvent(event);
      // Also handle the note for audio output - use the ref to get the latest version
      if (handleNoteOffRef.current) {
        handleNoteOffRef.current(note);
      }
    }
    // Sustain pedal (0xB0, controller 64)
    else if ((status & 0xf0) === 0xB0 && note === 64) {
      // Pedal on (127 or > 63), off (0 or <= 63)
      const pedalOn = velocity >= 64;
      console.log(`MIDI sustain pedal: ${pedalOn ? 'on' : 'off'}`);
      setSustain(pedalOn);
      
      // Dispatch custom event for sustain pedal changes to record in sequences
      const event = new CustomEvent(pedalOn ? "midi:sustain_on" : "midi:sustain_off", {
        detail: { timestamp: Date.now() }
      });
      window.dispatchEvent(event);
    }
    // Octave shift via program change or other controllers
    else if ((status & 0xf0) === 0xB0) {
      // Program change for octave up (CC 112+)
      if (note === 112 || note === 113) {
        console.log(`MIDI octave up`);
        setOctave((o) => Math.min(o + 1, 2));
      }
      // Program change for octave down (CC 114+)
      else if (note === 114 || note === 115) {
        console.log(`MIDI octave down`);
        setOctave((o) => Math.max(o - 1, -2));
      }
      // Log other control changes for debugging
      else {
        console.log(`MIDI controller: CC${note} value: ${velocity}`);
      }
    }
    // Other MIDI messages (for debugging)
    else {
      console.log(`MIDI message: [${message.data.join(', ')}]`);
    }
  }, []);

  useEffect(() => {
    async function requestMIDIAccess() {
      try {
        // Use sysex: false to request minimal permissions
        const options = { sysex: false }
        const access = await navigator.requestMIDIAccess(options)
        setMidiAccess(access)
        setMidiState({ 
          status: "available", 
          inputs: access.inputs.size,
          outputs: access.outputs.size 
        })
        
        // Set up MIDI input handlers for connected devices
        access.inputs.forEach(input => {
          console.log(`Setting up MIDI input: ${input.name}`)
          input.onmidimessage = handleMIDIMessage
        })
        
        // Listen for state changes
        access.onstatechange = (e) => {
          if (e.port.state === "disconnected") {
            console.log(`MIDI port ${e.port.name} was disconnected`)
          } else if (e.port.state === "connected") {
            console.log(`MIDI port ${e.port.name} was connected`)
            // Set up MIDI input for newly connected devices
            if (e.port.type === 'input') {
              console.log(`Setting up MIDI input for newly connected device: ${e.port.name}`)
              e.port.onmidimessage = handleMIDIMessage
            }
          }
        }
      } catch (err) {
        console.log("MIDI access denied, falling back to Web Audio API", err)
        setMidiState({ 
          status: "denied", 
          error: err.message || "Permission denied"
        })
      }
    }

    if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
      requestMIDIAccess()
    } else {
      console.log("WebMIDI not supported, falling back to Web Audio API")
      setMidiState({ status: "unsupported" })
    }
  }, [])

  const handleNoteOn = useCallback(
    (note) => {
      const adjustedNote = note + octave * 12
      
      // Always use Web Audio (never output to MIDI devices)
      noteOn(null, adjustedNote)
      
      setActiveNotes((prev) => new Set(prev).add(adjustedNote))
      if (sustain) {
        setSustainedNotes((prev) => new Set(prev).add(adjustedNote))
      }
    },
    [octave, sustain],
  )
  
  // Store the latest version of handleNoteOn in a ref to avoid dependency issues
  useEffect(() => {
    handleNoteOnRef.current = handleNoteOn;
  }, [handleNoteOn]);

  const handleNoteOff = useCallback(
    (note) => {
      const adjustedNote = note + octave * 12
      setActiveNotes((prev) => {
        const next = new Set(prev)
        next.delete(adjustedNote)
        return next
      })
      
      if (!sustain) {
        // Always use Web Audio (never output to MIDI devices)
        noteOff(null, adjustedNote)
      } else {
        setSustainedNotes((prev) => new Set(prev).add(adjustedNote))
      }
    },
    [octave, sustain],
  )
  
  // Store the latest version of handleNoteOff in a ref to avoid dependency issues
  useEffect(() => {
    handleNoteOffRef.current = handleNoteOff;
  }, [handleNoteOff]);

  useEffect(() => {
    if (!sustain) {
      setSustainedNotes((prev) => {
        prev.forEach((note) => {
          if (!activeNotes.has(note)) {
            // Always use Web Audio (never output to MIDI devices)
            noteOff(null, note)
          }
        })
        return new Set()
      })
    }
  }, [sustain, activeNotes])

  return {
    activeNotes,
    octave,
    sustain,
    handleNoteOn,
    handleNoteOff,
    setSustain,
    setOctave,
    hasMIDI: !!midiAccess,
    midiState
  }
}
