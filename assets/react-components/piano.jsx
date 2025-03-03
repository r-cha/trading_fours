"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { MIDI_NOTES, getAudioContext } from "./utils/midi";
import { usePiano } from "./hooks/usePiano";

const WHITE_KEYS = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"];
const BLACK_KEYS = ["w", "e", "", "t", "y", "u", "", "o", "p", ""];

export function Piano() {
  const {
    activeNotes,
    octave,
    sustain,
    handleNoteOn,
    handleNoteOff,
    handlePitchBend,
    setSustain,
    setOctave,
    hasMIDI,
    midiState,
  } = usePiano();

  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [recording, setRecording] = useState([]);
  
  // Listen for MIDI events from hardware devices
  useEffect(() => {
    const handleMidiNoteOn = (e) => {
      const { note, velocity } = e.detail;
      
      // If this is the first event, start a new recording and check sustain state
      if (recording.length === 0) {
        startRecording();
      }
      
      // Record the note in the piano roll (without affecting pressedKeys since it's from MIDI)
      setRecording((prev) => [
        ...prev,
        { type: "noteOn", note: note, timestamp: Date.now() },
      ]);
    };
    
    const handleMidiNoteOff = (e) => {
      const { note } = e.detail;
      // Record the note off in the piano roll
      setRecording((prev) => [
        ...prev,
        { type: "noteOff", note: note, timestamp: Date.now() },
      ]);
    };
    
    const handleMidiSustainOn = (e) => {
      // Record the sustain on event
      setRecording((prev) => [
        ...prev,
        { type: "sustainOn", timestamp: e.detail.timestamp },
      ]);
    };
    
    const handleMidiSustainOff = (e) => {
      // Record the sustain off event
      setRecording((prev) => [
        ...prev,
        { type: "sustainOff", timestamp: e.detail.timestamp },
      ]);
    };
    
    // Add event listeners
    window.addEventListener("midi:note_on", handleMidiNoteOn);
    window.addEventListener("midi:note_off", handleMidiNoteOff);
    window.addEventListener("midi:sustain_on", handleMidiSustainOn);
    window.addEventListener("midi:sustain_off", handleMidiSustainOff);
    
    // Clean up
    return () => {
      window.removeEventListener("midi:note_on", handleMidiNoteOn);
      window.removeEventListener("midi:note_off", handleMidiNoteOff);
      window.removeEventListener("midi:sustain_on", handleMidiSustainOn);
      window.removeEventListener("midi:sustain_off", handleMidiSustainOff);
    };
  }, []);

  const handleNoteStart = (note, key) => {
    // If this is the first note, start a new recording and check sustain state
    if (recording.length === 0) {
      startRecording();
    }
    
    handleNoteOn(note);
    setPressedKeys((prev) => new Set(prev).add(key));
    setRecording((prev) => [
      ...prev,
      { type: "noteOn", note, timestamp: Date.now() },
    ]);
  };

  const handleNoteEnd = (note, key) => {
    handleNoteOff(note);
    setPressedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setRecording((prev) => [
      ...prev,
      { type: "noteOff", note, timestamp: Date.now() },
    ]);
  };

  const resetRecording = () => {
    setRecording([]);
    
    // Clear the piano roll canvas
    const canvas = pianoRollCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  
  const startRecording = () => {
    resetRecording();
    
    // If sustain is already active when starting recording, add a sustainOn event
    if (sustain) {
      setRecording([{ 
        type: "sustainOn", 
        timestamp: Date.now() 
      }]);
    }
  };

  const sendRecording = () => {
    if (recording.length === 0) return;
    
    // Close all notes that might still be playing
    const playingNotes = new Set([...activeNotes]);
    
    // Turn off all active notes
    playingNotes.forEach(note => {
      handleNoteOff(note);
    });
    
    // Make sure there are note-off events for any note-on without a corresponding note-off
    const notesOn = new Set();
    const recordingWithClosedNotes = [...recording];
    
    // Find any notes that were turned on but never turned off
    recording.forEach(event => {
      if (event.type === "noteOn") {
        notesOn.add(event.note);
      } else if (event.type === "noteOff") {
        notesOn.delete(event.note);
      }
    });
    
    // Add note-off events for any notes still on at the end
    const lastTimestamp = recording.length > 0 
      ? Math.max(...recording.map(e => e.timestamp))
      : Date.now();
    
    notesOn.forEach(note => {
      recordingWithClosedNotes.push({
        type: "noteOff",
        note: note,
        timestamp: lastTimestamp + 10 // Add a small delay
      });
    });
    
    // If sustain was on at the end, automatically add a sustainOff event
    let sustainState = false;
    for (const event of recording) {
      if (event.type === "sustainOn") sustainState = true;
      else if (event.type === "sustainOff") sustainState = false;
    }
    
    if (sustainState) {
      console.log("Adding automatic sustainOff at end of recording");
      recordingWithClosedNotes.push({
        type: "sustainOff",
        timestamp: lastTimestamp + 20 // Add after note offs
      });
      
      // Also update the actual sustain state
      setSustain(false);
    }
    
    try {
      // Dispatch the event with the fixed recording
      console.log("Sending MIDI sequence with", recordingWithClosedNotes.length, "events");
      const event = new CustomEvent("phx:send_midi_sequence", {
        detail: { sequence: recordingWithClosedNotes },
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error("Error sending MIDI sequence:", error);
    }
    
    // Reset recording after sending
    resetRecording();
  };

  const handleMouseDown = (note, key) => (e) => {
    e.preventDefault();
    wakeupAudio(); // Wake up audio on mouse interaction
    handleNoteStart(note, key);
  };

  const handleMouseUp = (note, key) => (e) => {
    e.preventDefault();
    handleNoteEnd(note, key);
  };

  const handleMouseLeave = (note, key) => (e) => {
    if (pressedKeys.has(key)) {
      handleNoteEnd(note, key);
    }
  };

  const touchRef = useRef(new Map());

  const handleTouchStart = (note, key) => (e) => {
    wakeupAudio(); // Wake up audio on touch interaction
    
    // Only handle if this touch isn't already being tracked
    Array.from(e.changedTouches).forEach((touch) => {
      if (!touchRef.current.has(touch.identifier)) {
        touchRef.current.set(touch.identifier, { note, key });
        handleNoteStart(note, key);
      }
    });
  };

  const handleTouchMove = (e) => {
    // Get touch target elements
    const touches = Array.from(e.changedTouches);
    touches.forEach(touch => {
      const touchId = touch.identifier;
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Skip if element not found or doesn't have a data-note attribute
      if (!element) return;
      
      // Find keyboard key from element or its parent
      const keyElement = element.closest('[data-note]');
      if (!keyElement) return;
      
      const note = parseInt(keyElement.getAttribute('data-note'), 10);
      const key = keyElement.getAttribute('data-key');
      
      if (isNaN(note)) return;
      
      // Get currently playing note for this touch
      const currentlyPlaying = touchRef.current.get(touchId);
      
      // If moved to a different note
      if (currentlyPlaying && (currentlyPlaying.note !== note)) {
        // End the current note
        handleNoteEnd(currentlyPlaying.note, currentlyPlaying.key);
        
        // Start the new note
        handleNoteStart(note, key);
        touchRef.current.set(touchId, { note, key });
      } else if (!currentlyPlaying && note) {
        // Touch moved onto a key without previously being tracked
        handleNoteStart(note, key);
        touchRef.current.set(touchId, { note, key });
      }
    });
  };
  
  const handleTouchEnd = (e) => {
    e.preventDefault(); // Prevent default to avoid mouse events being triggered
    
    Array.from(e.changedTouches).forEach((touch) => {
      const noteInfo = touchRef.current.get(touch.identifier);
      if (noteInfo) {
        handleNoteEnd(noteInfo.note, noteInfo.key);
        touchRef.current.delete(touch.identifier);
      }
    });
  };

  // Wake up the audio context on user interaction
  const wakeupAudio = () => {
    // Get the shared audio context
    const audioContext = getAudioContext();
    if (audioContext && audioContext.state !== 'running') {
      audioContext.resume();
    }
  };

  // Create a canvas ref for the piano roll display
  const pianoRollCanvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Use the shared oscillators map from midi.js
  const oscillatorsRef = useRef(new Map());
  
  // Draw the recorded notes on the piano roll
  const drawPianoRoll = useCallback(() => {
    const canvas = pianoRollCanvasRef.current;
    if (!canvas || recording.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Find min and max notes to determine the vertical range
    const noteNumbers = recording
      .filter(event => event.note !== undefined)
      .map(event => event.note);
    
    if (noteNumbers.length === 0 && recording.some(e => e.type === "sustainOn" || e.type === "sustainOff")) {
      // If we have sustain events but no notes, still draw something
      ctx.fillStyle = "#888";
      ctx.font = "12px sans-serif";
      ctx.fillText("Sustain events recorded", 10, height/2);
      return;
    } else if (noteNumbers.length === 0) {
      return;
    }
    
    const minNote = Math.min(...noteNumbers);
    const maxNote = Math.max(...noteNumbers);
    const noteRange = Math.max(maxNote - minNote + 1, 12);
    const noteHeight = height / noteRange;
    
    // Find the time range
    const firstTimestamp = Math.min(...recording.map(e => e.timestamp));
    const lastTimestamp = Math.max(...recording.map(e => e.timestamp));
    const timeRange = lastTimestamp - firstTimestamp;
    const timeScale = timeRange > 0 ? width / timeRange : 1;
    
    // Create color mapping for notes using Nord theme colors
    const colors = [
      "#a3be8c", // Green
      "#81a1c1", // Blue
      "#ebcb8b", // Yellow
      "#b48ead", // Purple
      "#d08770", // Orange
    ];
    
    // Track note start positions for drawing
    const noteStarts = new Map();
    
    // Track sustain pedal state for visualization
    let sustainActive = false;
    
    // Draw notes and sustain events
    recording.forEach(event => {
      // Handle sustain pedal events
      if (event.type === "sustainOn") {
        sustainActive = true;
        
        // Draw a subtle sustain indicator at the bottom
        const x = (event.timestamp - firstTimestamp) * timeScale;
        ctx.fillStyle = "rgba(163, 190, 140, 0.3)"; // Green with transparency
        ctx.fillRect(x, height - 5, 5, 5);
        return;
      } else if (event.type === "sustainOff") {
        sustainActive = false;
        
        // Draw a subtle sustain-off indicator at the bottom
        const x = (event.timestamp - firstTimestamp) * timeScale;
        ctx.fillStyle = "rgba(191, 97, 106, 0.3)"; // Red with transparency
        ctx.fillRect(x, height - 5, 5, 5);
        return;
      }
      
      // Handle note events
      const isNoteOn = event.type === "noteOn";
      const note = event.note;
      if (note === undefined) return;
      
      const x = (event.timestamp - firstTimestamp) * timeScale;
      const y = height - ((note - minNote + 1) * noteHeight);
      
      // Assign consistent colors based on note
      const colorIndex = note % colors.length;
      const color = colors[colorIndex];
      
      if (isNoteOn) {
        // Store the sustain state along with the note
        noteStarts.set(note, { x, color, sustainAtStart: sustainActive });
      } else {
        const start = noteStarts.get(note);
        if (start) {
          const width = Math.max(x - start.x, 3);
          ctx.fillStyle = start.color;
          
          // Draw the note bar
          ctx.fillRect(start.x, y, width, noteHeight - 1);
          
          // If currently sustained, add a visual indicator
          if (sustainActive) {
            ctx.fillStyle = "rgba(163, 190, 140, 0.2)"; // Green with more transparency
            ctx.fillRect(x, y, 10, noteHeight - 1); // Small extension to show sustain
          }
          
          noteStarts.delete(note);
        }
      }
    });
    
    // Draw any notes that are still on
    noteStarts.forEach((start, note) => {
      const y = height - ((note - minNote + 1) * noteHeight);
      ctx.fillStyle = start.color;
      ctx.fillRect(start.x, y, width - start.x, noteHeight - 1);
      
      // If sustain is active, indicate it
      if (sustainActive) {
        ctx.fillStyle = "rgba(163, 190, 140, 0.2)"; // Green with transparency
        ctx.fillRect(width - 10, y, 10, noteHeight - 1); // Small indicator on the right
      }
    });
    
    // Draw the sustain state indicator
    if (sustainActive) {
      ctx.fillStyle = "rgba(163, 190, 140, 0.5)";
      ctx.fillRect(width - 15, height - 15, 15, 15);
    }
    
    // Draw a time indicator line
    ctx.strokeStyle = "#88c0d0";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [recording]);
  
  // Reference to hold the current playback cancelation flag
  const cancelPlaybackRef = useRef(false);
  
  // Forward declarations to handle circular dependencies
  const playRecordingFn = useRef(null);
  
  // Stop any current playback
  const stopPlayback = useCallback(() => {
    // Set cancel flag to stop current playback
    cancelPlaybackRef.current = true;
    
    // Clean up any active oscillators
    oscillatorsRef.current.forEach((data) => {
      try {
        data.osc.stop();
        data.osc.disconnect();
      } catch (e) {
        // Ignore errors from already stopped oscillators
      }
    });
    oscillatorsRef.current.clear();
    
    // Reset playing state
    setIsPlaying(false);
  }, []);
  
  // Using function declaration to avoid closure/dependency issues
  function handlePlayButtonClick() {
    console.log("Play/pause toggled, isPlaying:", isPlaying);
    if (isPlaying) {
      // If currently playing, stop playback
      stopPlayback();
    } else if (recording.length > 0) {
      // Simple wrapper to start playback
      playRecording();
    }
  }
  
  // Play back the recording using the shared audio context
  const playRecording = useCallback(async () => {
    if (recording.length === 0) return;
    
    // Stop any existing playback first
    if (isPlaying) {
      stopPlayback();
      // We'd normally return here, but we want to simplify the playback flow
      // Let a small delay happen to ensure all oscillators are cleaned up
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Reset cancel flag
    cancelPlaybackRef.current = false;
    setIsPlaying(true);
    
    // Get the shared audio context
    const ctx = getAudioContext();
    if (!ctx) {
      console.error("Could not get audio context for playback");
      setIsPlaying(false);
      return;
    }
    
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
        console.log("Audio context resumed for playback");
      } catch (err) {
        console.error("Failed to resume audio context:", err);
        setIsPlaying(false);
        return;
      }
    }
    
    try {
      // Sort events by time
      const sortedEvents = [...recording].sort((a, b) => a.timestamp - b.timestamp);
      if (sortedEvents.length === 0) {
        setIsPlaying(false);
        return;
      }
      
      const startTime = sortedEvents[0].timestamp;
      
      // Function to convert MIDI note to frequency
      const midiToFrequency = (note) => 440 * Math.pow(2, (note - 69) / 12);
      
      // Clear any existing oscillators
      oscillatorsRef.current.forEach((data, note) => {
        try {
          data.osc.stop();
          data.osc.disconnect();
        } catch (e) {
          // Ignore errors from already stopped oscillators
        }
      });
      oscillatorsRef.current.clear();
      
      for (let i = 0; i < sortedEvents.length; i++) {
        // Check if playback was cancelled
        if (cancelPlaybackRef.current) {
          break;
        }
        
        const event = sortedEvents[i];
        const note = event.note;
        const isNoteOn = event.type === "noteOn";
        
        if (note === undefined) continue;
        
        if (isNoteOn) {
          // Start a new oscillator
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = "triangle";
          const frequency = midiToFrequency(note);
          osc.frequency.value = frequency;
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start();
          oscillatorsRef.current.set(note, { osc, gain });
        } else {
          // Stop the oscillator
          const oscillator = oscillatorsRef.current.get(note);
          if (oscillator) {
            const { osc, gain } = oscillator;
            
            gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
            
            setTimeout(() => {
              try {
                if (!cancelPlaybackRef.current) {
                  osc.stop();
                  osc.disconnect();
                }
              } catch (e) {
                // Ignore errors from already stopped oscillators
              }
            }, 100);
            
            oscillatorsRef.current.delete(note);
          }
        }
        
        // Wait for the next event, but check for cancelation
        if (i < sortedEvents.length - 1 && !cancelPlaybackRef.current) {
          const waitTime = sortedEvents[i + 1].timestamp - event.timestamp;
          // Cap the wait time to prevent extremely long pauses
          const cappedWaitTime = Math.min(waitTime, 2000);
          if (cappedWaitTime > 0) {
            try {
              await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(resolve, cappedWaitTime);
                
                // Create an interval to check for cancellation during long waits
                const checkInterval = setInterval(() => {
                  if (cancelPlaybackRef.current) {
                    clearTimeout(timeoutId);
                    clearInterval(checkInterval);
                    resolve(); // Resolve early to continue the loop and hit the cancelation check
                  }
                }, 100);
                
                // Clean up interval after timeout completes
                setTimeout(() => clearInterval(checkInterval), cappedWaitTime + 10);
              });
            } catch (e) {
              // Ignore timeout errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Error during playback:", error);
    } finally {
      // Make sure we clean up all oscillators
      oscillatorsRef.current.forEach((data, note) => {
        try {
          data.osc.stop();
          data.osc.disconnect();
        } catch (e) {
          // Ignore errors from already stopped oscillators
        }
      });
      oscillatorsRef.current.clear();
      setIsPlaying(false);
    }
  }, [recording, isPlaying]);
  
  // Draw piano roll when recording changes
  useEffect(() => {
    drawPianoRoll();
  }, [recording, drawPianoRoll]);
  
  // We don't need this anymore since we're using handlePlayButtonClick directly
  // Keeping the ref for future use if needed
  useEffect(() => {
    playRecordingFn.current = handlePlayButtonClick;
  }, []);
  
  useEffect(() => {
    // Wake up audio on initial render
    wakeupAudio();
    
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      
      // Wake up audio context on any key press
      wakeupAudio();
      
      if (MIDI_NOTES[key] && !pressedKeys.has(key)) {
        handleNoteStart(MIDI_NOTES[key], key);
      } else if (key === "tab") {
        e.preventDefault();
        setSustain(true);
        
        // Add a sustainOn event to the recording
        setRecording((prev) => [
          ...prev,
          { type: "sustainOn", timestamp: Date.now() },
        ]);
      } else if (key === "z") {
        setOctave((o) => Math.max(o - 1, -2));
      } else if (key === "x") {
        setOctave((o) => Math.min(o + 1, 2));
      } else if (key === "enter") {
        sendRecording();
      } else if (key === " ") { // Spacebar to play/pause
        e.preventDefault();
        // Simply call the toggle function directly - it will handle both play and stop
        console.log("Spacebar pressed, calling toggle with isPlaying:", isPlaying);
        document.activeElement.blur(); // Remove focus from any button to ensure keyboard shortcuts work
        handlePlayButtonClick();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (MIDI_NOTES[key]) {
        handleNoteEnd(MIDI_NOTES[key], key);
      } else if (key === "tab") {
        setSustain(false);
        
        // Add a sustainOff event to the recording
        setRecording((prev) => [
          ...prev,
          { type: "sustainOff", timestamp: Date.now() },
        ]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pressedKeys, setOctave, setSustain]);

  return (
    <div className="w-full bg-[#4c566a] rounded-xl shadow-2xl p-3">
      {/* MIDI Status + Controls in a horizontal layout */}
      <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
        <div className="flex items-center">
          <span
            className={`inline-block w-3 h-3 rounded-full mr-2 ${
              midiState.status === "available" 
                ? "bg-[#a3be8c]" 
                : midiState.status === "checking"
                  ? "bg-[#ebcb8b] animate-pulse"
                  : "bg-[#bf616a]"
            }`}
          ></span>
          <span className="text-sm text-white">
            MIDI: {
              midiState.status === "available" 
                ? `Connected` 
                : midiState.status === "checking"
                  ? "Checking..."
                  : midiState.status === "denied"
                    ? "Permission denied"
                    : "Not supported"
            }
          </span>
        </div>
        <div className="text-xs text-white">
          <span className="mr-2">Octave: C{octave + 2}</span>
          <button
            className="px-2 py-1 bg-[#5e81ac] hover:bg-[#81a1c1] rounded text-white text-xs mr-1"
            onClick={() => setOctave((o) => Math.max(o - 1, -2))}
          >
            Z
          </button>
          <button
            className="px-2 py-1 bg-[#5e81ac] hover:bg-[#81a1c1] rounded text-white text-xs"
            onClick={() => setOctave((o) => Math.min(o + 1, 2))}
          >
            X
          </button>
        </div>
        <div>
          <button
            className={`px-2 py-1 rounded text-white text-xs ${sustain ? "bg-[#a3be8c]" : "bg-[#5e81ac]"}`}
            onMouseDown={() => setSustain(true)}
            onMouseUp={() => setSustain(false)}
          >
            Sustain (Tab)
          </button>
        </div>
      </div>
      
      {/* Main content area - responsive layout */}
      <div className="md:flex block">
        {/* Piano and piano roll - takes full width on mobile, 3/4 width on desktop */}
        <div className="md:w-3/4 w-full md:pr-2">
          {/* Thin Piano Roll Display */}
          <div className="mb-2 bg-[#3b4252] rounded-lg p-1">
            <canvas 
              ref={pianoRollCanvasRef} 
              className="w-full bg-[#3b4252] rounded-lg" 
              width={600} 
              height={60}
            ></canvas>
            
            {recording.length === 0 && (
              <div className="text-center py-1 text-white text-xs italic">
                Play notes to see them appear here
              </div>
            )}
          </div>

          {/* Piano Keys - responsive sizing */}
          <div className="relative">
            <div className="flex">
              {/* White keys */}
              {WHITE_KEYS.map((key) => (
                <div
                  key={key}
                  data-note={MIDI_NOTES[key]}
                  data-key={key}
                  className={`relative w-8 sm:w-9 md:w-10 lg:w-12 h-24 sm:h-28 border border-zinc-700 rounded-b ${
                    pressedKeys.has(key) ? "bg-blue-500" : "bg-white"
                  }`}
                  onMouseDown={handleMouseDown(MIDI_NOTES[key], key)}
                  onMouseUp={handleMouseUp(MIDI_NOTES[key], key)}
                  onMouseLeave={handleMouseLeave(MIDI_NOTES[key], key)}
                  onTouchStart={handleTouchStart(MIDI_NOTES[key], key)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-zinc-400">
                    {key.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* Black keys */}
            <div className="absolute top-0 left-0 flex">
              {BLACK_KEYS.map((key, index) =>
                key ? (
                  <div
                    key={key}
                    data-note={MIDI_NOTES[key]}
                    data-key={key}
                    style={{
                      height: "60px",
                    }}
                    className={`first:ml-4 sm:first:ml-5 md:first:ml-5 lg:first:ml-6 border-x border-white relative z-10 w-8 sm:w-9 md:w-10 lg:w-12 rounded-b ${
                      pressedKeys.has(key) ? "bg-blue-500" : "bg-black"
                    }`}
                    onMouseDown={handleMouseDown(MIDI_NOTES[key], key)}
                    onMouseUp={handleMouseUp(MIDI_NOTES[key], key)}
                    onMouseLeave={handleMouseLeave(MIDI_NOTES[key], key)}
                    onTouchStart={handleTouchStart(MIDI_NOTES[key], key)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-zinc-400">
                      {key.toUpperCase()}
                    </span>
                  </div>
                ) : (
                  <div key={`spacer-${index}`} className="w-8 sm:w-9 md:w-10 lg:w-12" />
                )
              )}
            </div>
          </div>
        </div>
        
        {/* Controls - column on desktop, row on mobile */}
        <div className="md:w-1/4 w-full md:pl-2 md:mt-0 mt-3">
          <div className="md:flex md:flex-col md:space-y-2 md:space-x-0 flex flex-row space-x-2 space-y-0">
            <button
              onClick={handlePlayButtonClick}
              className={`md:w-full flex-1 py-2 px-2 rounded font-medium ${
                isPlaying 
                  ? 'bg-[#bf616a] text-white hover:bg-opacity-90' 
                  : 'bg-[#8fbcbb] text-white hover:bg-opacity-90'
              }`}
            >
              {isPlaying ? "Stop" : "Play"}
            </button>
            
            <button
              phx-click="send_midi"
              phx-value-sequence={JSON.stringify(recording)}
              className="md:w-full flex-1 bg-[#a3be8c] text-white py-2 px-2 rounded font-medium hover:bg-opacity-90 transition"
              onClick={() => {
                sendRecording();
                document.body.focus();
              }}
              disabled={recording.length === 0}
            >
              Send
            </button>
            
            <button
              className="md:w-full flex-1 bg-[#bf616a] text-white py-2 px-2 rounded font-medium hover:bg-opacity-90 transition"
              onClick={resetRecording}
              disabled={recording.length === 0}
            >
              Clear
            </button>
          </div>
          
          <div className="text-xs text-white text-center mt-2 hidden md:block">
            <div>Spacebar: Play/Pause</div>
            <div>Tab: Sustain</div>
            <div>Enter: Send</div>
          </div>
        </div>
      </div>
      
      {/* Mobile keyboard shortcuts removed as requested */}
      
      {midiState.status === "denied" && (
        <div className="mt-2 p-2 bg-[#ebcb8b] border border-[#d08770] rounded text-xs text-[#2e3440]">
          <strong>MIDI access denied.</strong> Reset permissions in your browser settings.
        </div>
      )}
    </div>
  );
}
