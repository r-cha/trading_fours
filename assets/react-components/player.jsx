import React, { useEffect, useRef, useState } from "react";

export const Player = ({ sequence }) => {
  const canvasRef = useRef(null);
  const midiEvents = JSON.parse(sequence);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef(null);
  const oscillatorsRef = useRef(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawMiniPianoRoll(canvas, midiEvents);
  }, [midiEvents]);

  const drawMiniPianoRoll = (canvas, midiEvents) => {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Calculate note range
    const noteNumbers = midiEvents.map((event) => event.note);
    const minNote = Math.min(...noteNumbers);
    const maxNote = Math.max(...noteNumbers);
    const noteRange = maxNote - minNote + 1;
    const noteHeight = height / noteRange;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!midiEvents || midiEvents.length === 0) {
      return;
    }

    // Calculate time scale
    const maxTime = Math.max(...midiEvents.map((event) => event.timestamp));
    const timeScale = (width - 40) / (maxTime || 1);

    // Draw notes
    ctx.fillStyle = "#4CAF50";
    const noteState = new Map(); // Track note on/off state

    midiEvents.forEach((event) => {
      const isNoteOn = event.type === "noteOn";
      const noteNumber = event.note;
      const x = event.timestamp * timeScale;
      const y = (noteNumber - minNote) * noteHeight; // Adjust based on minNote being the starting note

      if (isNoteOn) {
        noteState.set(noteNumber, x); // Store start position
      } else {
        const startX = noteState.get(noteNumber);
        if (startX !== undefined) {
          const width = x - startX;
          ctx.fillRect(startX, y, width, noteHeight - 1);
          noteState.delete(noteNumber);
        }
      }
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
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;
    setIsPlaying(true);

    const sortedEvents = [...midiEvents].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      const isNoteOn = event.type === "noteOn";
      const noteNumber = event.note;
      const frequency = midiToFrequency(noteNumber);

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
          gain.gain.setValueAtTime(gain.gain.value, audioContext.currentTime);
          gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.01);
          osc.stop(audioContext.currentTime + 0.01);
          oscillatorsRef.current.delete(noteNumber);
        }
      }

      if (i < sortedEvents.length - 1) {
        const waitTime = sortedEvents[i + 1].timestamp - event.timestamp;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    setIsPlaying(false);
  };

  return (
    <div className="w-fit">
      <canvas ref={canvasRef} data-sequence={sequence} width={300} height={150} ></canvas>
      <button onClick={() => playSequence(midiEvents)} disabled={isPlaying}>
        {isPlaying ? "Playing..." : "Play Sequence"}
      </button>
    </div>
  );
};
