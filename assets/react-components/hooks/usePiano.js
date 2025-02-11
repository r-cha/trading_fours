import { useState, useEffect, useCallback } from "react"
import { setupMIDI, noteOn, noteOff } from "../utils/midi"

export function usePiano() {
  const [activeNotes, setActiveNotes] = useState(new Set())
  const [sustainedNotes, setSustainedNotes] = useState(new Set())
  const [midiAccess, setMidiAccess] = useState(null)
  const [octave, setOctave] = useState(0)
  const [sustain, setSustain] = useState(false)

  useEffect(() => {
    async function requestMIDIAccess() {
      try {
        const access = await navigator.requestMIDIAccess()
        setMidiAccess(access)
      } catch (err) {
        console.log("MIDI access denied, falling back to Web Audio API")
      }
    }

    if (navigator.requestMIDIAccess) {
      requestMIDIAccess()
    } else {
      console.log("WebMIDI not supported, falling back to Web Audio API")
    }
  }, [])

  const handleNoteOn = useCallback(
    (note) => {
      const adjustedNote = note + octave * 12
      noteOn(midiAccess, adjustedNote)
      setActiveNotes((prev) => new Set(prev).add(adjustedNote))
      if (sustain) {
        setSustainedNotes((prev) => new Set(prev).add(adjustedNote))
      }
    },
    [midiAccess, octave, sustain],
  )

  const handleNoteOff = useCallback(
    (note) => {
      const adjustedNote = note + octave * 12
      setActiveNotes((prev) => {
        const next = new Set(prev)
        next.delete(adjustedNote)
        return next
      })
      if (!sustain) {
        noteOff(midiAccess, adjustedNote)
      } else {
        setSustainedNotes((prev) => new Set(prev).add(adjustedNote))
      }
    },
    [midiAccess, octave, sustain],
  )

  useEffect(() => {
    if (!sustain) {
      setSustainedNotes((prev) => {
        prev.forEach((note) => {
          if (!activeNotes.has(note)) {
            noteOff(midiAccess, note)
          }
        })
        return new Set()
      })
    }
  }, [sustain, midiAccess, activeNotes])

  return {
    activeNotes,
    octave,
    sustain,
    handleNoteOn,
    handleNoteOff,
    setSustain,
    setOctave,
    hasMIDI: !!midiAccess,
  }
}
