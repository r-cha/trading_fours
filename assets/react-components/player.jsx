import React, { useEffect, useRef, useState } from "react";

export const Player = ({ sequence }) => {
  const canvasRef = useRef(null);
  const [midiEvents, setMidiEvents] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef(null);
  const oscillatorsRef = useRef(new Map());

  useEffect(() => {
    try {
      // Handle both string and object format (for safety)
      const parsedSequence = typeof sequence === 'string' ? JSON.parse(sequence) : sequence;
      
      // Ensure we have an array to work with
      if (Array.isArray(parsedSequence)) {
        // Check for any sustainOn events at the beginning
        const hasSustainOnEvent = parsedSequence.some(event => event.type === "sustainOn");
        
        if (hasSustainOnEvent) {
          console.log("Detected sustainOn event in sequence");
          // Handle sustain pedal state in playback
          // This will be implemented in the playSequence function
        }
        
        setMidiEvents(parsedSequence);
      } else {
        setMidiEvents([]);
      }
    } catch (error) {
      console.error("Error parsing sequence:", error);
      setMidiEvents([]);
    }
  }, [sequence]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && midiEvents && midiEvents.length > 0) {
      drawMiniPianoRoll(canvas, midiEvents);
    }
  }, [midiEvents]);

  const drawMiniPianoRoll = (canvas, midiEvents) => {
    if (!midiEvents || midiEvents.length === 0) {
      return;
    }
    
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate note range
    const noteNumbers = midiEvents.map((event) => event.note).filter(n => n !== undefined);
    
    if (noteNumbers.length === 0) {
      // Draw message if no valid notes
      ctx.fillStyle = "#666";
      ctx.font = "12px sans-serif";
      ctx.fillText("No valid notes in sequence", 10, height/2);
      return;
    }
    
    const minNote = Math.min(...noteNumbers);
    const maxNote = Math.max(...noteNumbers);
    const noteRange = Math.max(maxNote - minNote + 1, 12); // At least an octave
    const noteHeight = height / noteRange;

    // Calculate time scale
    // Normalize timestamps by subtracting the first timestamp
    const firstTimestamp = Math.min(...midiEvents.map(e => e.timestamp));
    const adjustedEvents = midiEvents.map(e => ({
      ...e,
      adjustedTime: e.timestamp - firstTimestamp
    }));
    
    const maxTime = Math.max(...adjustedEvents.map(e => e.adjustedTime));
    const timeScale = maxTime > 0 ? (width - 40) / maxTime : 1;

    // Draw notes
    ctx.fillStyle = "#a3be8c"; // Nord theme green
    const noteState = new Map(); // Track note on/off state

    adjustedEvents.forEach((event) => {
      const isNoteOn = event.type === "noteOn";
      const noteNumber = event.note;
      
      if (noteNumber === undefined) return;
      
      const x = 10 + (event.adjustedTime * timeScale);
      const y = height - ((noteNumber - minNote + 1) * noteHeight); // Flip Y axis for better visualization

      if (isNoteOn) {
        noteState.set(noteNumber, x); // Store start position
      } else {
        const startX = noteState.get(noteNumber);
        if (startX !== undefined) {
          const noteWidth = Math.max(x - startX, 3); // Ensure notes have minimum width
          ctx.fillRect(startX, y, noteWidth, noteHeight - 1);
          noteState.delete(noteNumber);
        }
      }
    });
    
    // Draw any remaining "on" notes that don't have an "off" event
    noteState.forEach((startX, noteNumber) => {
      const y = height - ((noteNumber - minNote + 1) * noteHeight);
      ctx.fillRect(startX, y, width - startX - 10, noteHeight - 1);
    });
  };

  const getMidiNoteName = (midiNumber) => {
    const notes = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;
    return `${notes[noteIndex]}${octave}`;
  };

  const midiToFrequency = (note) => {
    return 440 * Math.pow(2, (note - 69) / 12);
  };

  const playSequence = async (midiEvents) => {
    if (!midiEvents || midiEvents.length === 0) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    
    const audioContext = audioContextRef.current;
    setIsPlaying(true);
    
    // Track and handle sustain pedal events
    let sustainActive = false;
    // Filter out sustain events from playback events
    const playbackEvents = midiEvents.filter(event => {
      return event.type !== "sustainOn" && event.type !== "sustainOff";
    });
    
    // Sort events by timestamp and normalize timestamps
    const firstTimestamp = Math.min(...playbackEvents.map(e => e.timestamp));
    const sortedEvents = [...playbackEvents]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(e => ({
        ...e,
        adjustedTime: e.timestamp - firstTimestamp
      }));
    
    // Check if sustain is active at the start
    const initialSustainState = midiEvents.find(e => 
      (e.type === "sustainOn" || e.type === "sustainOff") &&
      e.timestamp <= firstTimestamp + 10
    )?.type === "sustainOn";

    // Create a function to process sustain pedal changes during playback
    const processSustainChange = async (midiEvents, currentTime, forceCheck = false) => {
      // Find all sustain pedal events
      const sustainEvents = midiEvents
        .filter(event => event.type === "sustainOn" || event.type === "sustainOff");
      
      if (sustainEvents.length === 0) return;
      
      // Sort by time
      const sortedSustainEvents = [...sustainEvents].sort((a, b) => a.timestamp - b.timestamp);
      
      // Find any events that should be processed at this time
      // Consider an event "for this time" if it occurs before or at the current timestamp
      const eventsToProcess = sortedSustainEvents.filter(event => {
        if (forceCheck) return true; // Process all when doing a full check
        
        // Process if timestamp is between firstTimestamp and currentTime
        return event.timestamp >= firstTimestamp && event.timestamp <= currentTime;
      });
      
      // Process these events in order
      for (const event of eventsToProcess) {
        if (event.type === "sustainOff") {
          console.log("Processing sustainOff event at time", event.timestamp);
          sustainActive = false;
          
          // Release all sustained notes
          const sustainedNotes = [];
          for (const [noteNumber, data] of oscillatorsRef.current.entries()) {
            if (data.sustained) {
              sustainedNotes.push(noteNumber);
            }
          }
          
          // Now release each sustained note
          for (const noteNumber of sustainedNotes) {
            const data = oscillatorsRef.current.get(noteNumber);
            if (data) {
              console.log(`Releasing sustained note ${noteNumber}`);
              data.gain.gain.setValueAtTime(data.gain.gain.value, audioContext.currentTime);
              data.gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05);
              // Schedule stop slightly later to avoid clicks
              setTimeout(() => {
                try {
                  data.osc.stop();
                  data.osc.disconnect();
                  oscillatorsRef.current.delete(noteNumber);
                } catch (e) {
                  // Ignore errors from already stopped oscillators
                }
              }, 60);
            }
          }
        } else if (event.type === "sustainOn") {
          console.log("Processing sustainOn event at time", event.timestamp);
          sustainActive = true;
        }
      }
    };
    
    // Initialize with the correct sustain state
    if (initialSustainState) {
      console.log("Starting playback with sustain active");
      sustainActive = true;
    }
    
    try {
      // Process any initial sustain events
      await processSustainChange(midiEvents, firstTimestamp);
      
      for (let i = 0; i < sortedEvents.length; i++) {
        const event = sortedEvents[i];
        const isNoteOn = event.type === "noteOn";
        const noteNumber = event.note;
        
        if (noteNumber === undefined) continue;
        
        const frequency = midiToFrequency(noteNumber);
        if (!isFinite(frequency)) continue;

        if (isNoteOn) {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
          gain.gain.setValueAtTime(0, audioContext.currentTime);
          gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
          osc.connect(gain).connect(audioContext.destination);
          osc.start();
          oscillatorsRef.current.set(noteNumber, { osc, gain });
        } else {
          const { osc, gain } = oscillatorsRef.current.get(noteNumber) || {};
          if (osc && gain) {
            // If sustain is active, don't stop the note immediately
            if (sustainActive) {
              // We still track that the note was released
              // But we don't stop the oscillator yet
              console.log(`Sustain active, holding note ${noteNumber}`);
              
              // Mark this note as sustained so we can release it when sustain pedal is released
              oscillatorsRef.current.set(noteNumber, {
                osc, gain, sustained: true
              });
            } else {
              gain.gain.setValueAtTime(gain.gain.value, audioContext.currentTime);
              gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.01);
              osc.stop(audioContext.currentTime + 0.01);
              oscillatorsRef.current.delete(noteNumber);
            }
          }
        }

        if (i < sortedEvents.length - 1) {
          const waitTime = sortedEvents[i + 1].adjustedTime - event.adjustedTime;
          // Cap the waitTime to prevent extremely long pauses
          const cappedWaitTime = Math.min(waitTime, 2000);
          
          // Check if any sustain pedal events should occur during this wait time
          const currentTimestamp = event.timestamp;
          const nextEventTime = sortedEvents[i + 1].timestamp;
          await processSustainChange(midiEvents, nextEventTime);
          
          // Wait for the next note
          await new Promise((resolve) => setTimeout(resolve, cappedWaitTime));
        }
      }
    } catch (error) {
      console.error("Error playing sequence:", error);
    } finally {
      // Make sure to release all notes and clean up when playback ends
      const notesToRelease = Array.from(oscillatorsRef.current.keys());
      
      for (const noteNumber of notesToRelease) {
        const data = oscillatorsRef.current.get(noteNumber);
        if (data && data.osc && data.gain) {
          try {
            data.gain.gain.setValueAtTime(data.gain.gain.value, audioContext.currentTime);
            data.gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05);
            setTimeout(() => {
              try {
                data.osc.stop();
                data.osc.disconnect();
              } catch (e) {
                // Ignore errors from already stopped oscillators
              }
            }, 60);
          } catch (e) {
            console.error("Error releasing note", e);
          }
        }
      }
      
      // Clear all oscillators
      oscillatorsRef.current.clear();
      setIsPlaying(false);
    }
  };

  return (
    <div className="w-full">
      <div className="bg-[#434c5e] rounded-md p-1">
        <div className="flex flex-col sm:flex-row items-center">
          <canvas 
            ref={canvasRef} 
            className="w-full sm:flex-grow border border-[#3b4252] rounded bg-[#3b4252]" 
            width={240} 
            height={60} 
          />
          <button 
            onClick={() => playSequence(midiEvents)} 
            disabled={isPlaying || !midiEvents || midiEvents.length === 0}
            className={`mt-2 sm:mt-0 sm:ml-2 px-3 py-1 rounded text-sm whitespace-nowrap ${isPlaying 
              ? 'bg-[#bf616a] text-white cursor-not-allowed' 
              : 'bg-[#8fbcbb] text-white hover:bg-opacity-90'}`}
          >
            {isPlaying ? "Stop" : "Play"}
          </button>
        </div>
      </div>
    </div>
  );
};
