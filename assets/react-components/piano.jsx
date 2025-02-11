"use client";

import React, { useEffect, useRef, useState } from "react";
import { MIDI_NOTES } from "./utils/midi";
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
  } = usePiano();

  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [recording, setRecording] = useState([]);

  const handleNoteStart = (note, key) => {
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
  };

  const sendRecording = () => {
    const event = new CustomEvent("phx:send_midi_sequence", {
      detail: { sequence: recording },
    });
    window.dispatchEvent(event);
  };

  const handleMouseDown = (note, key) => (e) => {
    e.preventDefault();
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
    Array.from(e.changedTouches).forEach((touch) => {
      touchRef.current.set(touch.identifier, { note, key });
      handleNoteStart(note, key);
    });
  };

  const handleTouchEnd = (e) => {
    Array.from(e.changedTouches).forEach((touch) => {
      const noteInfo = touchRef.current.get(touch.identifier);
      if (noteInfo) {
        handleNoteEnd(noteInfo.note, noteInfo.key);
        touchRef.current.delete(touch.identifier);
      }
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (MIDI_NOTES[key] && !pressedKeys.has(key)) {
        handleNoteStart(MIDI_NOTES[key], key);
      } else if (key === "tab") {
        e.preventDefault();
        setSustain(true);
      } else if (key === "z") {
        setOctave((o) => Math.max(o - 1, -2));
      } else if (key === "x") {
        setOctave((o) => Math.min(o + 1, 2));
      } else if (key === "enter") {
        sendRecording();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (MIDI_NOTES[key]) {
        handleNoteEnd(MIDI_NOTES[key], key);
      } else if (key === "tab") {
        setSustain(false);
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
    <div className="max-w-4xl mx-auto p-4 bg-zinc-900 rounded-xl shadow-2xl">
      <div className="flex items-center mb-2">
        <span
          className={`inline-block w-3 h-3 rounded-full mr-2 ${
            hasMIDI ? "bg-green-500" : "bg-red-500 animate-pulse"
          }`}
        ></span>
        <span className="text-sm text-zinc-400">MIDI</span>
      </div>

      {/* Piano Keys */}
      <div className="relative">
        <div className="flex">
          {/* White keys */}
          {WHITE_KEYS.map((key) => (
            <div
              key={key}
              className={`relative w-14 h-40 border border-zinc-700 rounded-b ${
                pressedKeys.has(key) ? "bg-blue-500" : "bg-white"
              }`}
              onMouseDown={handleMouseDown(MIDI_NOTES[key], key)}
              onMouseUp={handleMouseUp(MIDI_NOTES[key], key)}
              onMouseLeave={handleMouseLeave(MIDI_NOTES[key], key)}
              onTouchStart={handleTouchStart(MIDI_NOTES[key], key)}
              onTouchEnd={handleTouchEnd}
            >
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm text-zinc-400">
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
                style={{
                  height: "100px",
                }}
                className={`first:ml-7 border-x border-white relative z-10 w-14 rounded-b ${
                  pressedKeys.has(key) ? "bg-blue-500" : "bg-black"
                }`}
                onMouseDown={handleMouseDown(MIDI_NOTES[key], key)}
                onMouseUp={handleMouseUp(MIDI_NOTES[key], key)}
                onMouseLeave={handleMouseLeave(MIDI_NOTES[key], key)}
                onTouchStart={handleTouchStart(MIDI_NOTES[key], key)}
                onTouchEnd={handleTouchEnd}
              >
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm text-zinc-400">
                  {key.toUpperCase()}
                </span>
              </div>
            ) : (
              <div key={`spacer-${index}`} className="w-14" />
            )
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="mt-4 flex items-center gap-4">
        <button
          className={`w-24 h-12 ${sustain ? "bg-green-500" : "bg-green-700"}`}
          onMouseDown={() => setSustain(true)}
          onMouseUp={() => setSustain(false)}
        >
          sustain
          <span className="ml-2 text-xs text-zinc-400">tab</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Octave: C{octave + 2}</span>
          <div className="flex gap-1">
            <button
              className="w-12 h-12 bg-amber-700 hover:bg-amber-600"
              onClick={() => setOctave((o) => Math.max(o - 1, -2))}
            >
              Z
            </button>
            <button
              className="w-12 h-12 bg-amber-700 hover:bg-amber-600"
              onClick={() => setOctave((o) => Math.min(o + 1, 2))}
            >
              X
            </button>
          </div>
        </div>

        <span className="text-zinc-400">Velocity: 98</span>
      </div>

      <button
        phx-click="send_midi"
        phx-value-sequence={JSON.stringify(recording)}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        onClick={sendRecording}
      >
        Send Piano Sequence
      </button>

      <button
        className="w-full bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
        onClick={resetRecording}
      >
        Reset Recording
      </button>
    </div>
  );
}
