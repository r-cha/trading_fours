class PianoRoll {
    constructor(pianoRollElement, pianoKeysElement) {
        this.pianoRoll = pianoRollElement || document.getElementById("pianoRoll");
        this.pianoKeys = pianoKeysElement || document.getElementById("pianoKeys");
        this.rollCtx = this.pianoRoll.getContext("2d");
        this.keysCtx = this.pianoKeys.getContext("2d");

        this.notes = [];
        this.pressedKeys = new Set();
        this.octaves = 2;
        this.noteHeight = 20;
        this.whiteKeyWidth = 40;
        this.blackKeyWidth = 24;
        this.gridColor = "#2a2a2a";

        this.isRecording = false;
        this.recordingStartTime = null;
        this.recordedNotes = [];
        this.timeScale = 1;

        this.keyboardMap = {
            // Lower octave
            'a': 'C4', 's': 'D4', 'd': 'E4', 'f': 'F4', 
            'g': 'G4', 'h': 'A4', 'j': 'B4',
            'w': 'C#4', 'e': 'D#4', 't': 'F#4', 
            'y': 'G#4', 'u': 'A#4',
            // Upper octave
            'k': 'C5', 'l': 'D5', ';': 'E5', "'": 'F5',
            'o': 'C#5', 'p': 'D#5'
        };

        this.setupCanvas();
        this.setupEventListeners();
        this.setupSynth();
        this.render();
    }

    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.pianoRoll.parentElement;
            const width = container.clientWidth;

            this.pianoRoll.width = width;
            this.pianoRoll.height = 300;
            this.pianoKeys.width = width;
            this.pianoKeys.height = 120;

            this.render();
        };

        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();
    }

    setupSynth() {
        this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
    }

    setupEventListeners() {
        let isMouseDown = false;

        this.pianoKeys.addEventListener("mousedown", (e) => {
            isMouseDown = true;
            const note = this.getNoteFromClick(e);
            if (note) {
                this.playNote(note);
            }
        });

        this.pianoKeys.addEventListener("mousemove", (e) => {
            if (!isMouseDown) return;
            const note = this.getNoteFromClick(e);
            if (note && !this.pressedKeys.has(note)) {
                this.playNote(note);
            }
        });

        document.addEventListener("mouseup", () => {
            isMouseDown = false;
            this.pressedKeys.forEach((note) => {
                this.synth.triggerRelease(note);
            });
            this.pressedKeys.clear();
            this.render();
        });

        document.getElementById("playButton").addEventListener("click", () => {
            if (this.recordedNotes.length > 0) {
                this.playRecording();
            }
        });

        document.getElementById("clearButton").addEventListener("click", () => {
            this.recordedNotes = [];
            this.isRecording = false;
            this.recordingStartTime = null;
            this.render();
        });

        document.addEventListener("keydown", (e) => {
            if (e.repeat) return; // Prevent key repeat
            const note = this.keyboardMap[e.key.toLowerCase()];
            if (note && !this.pressedKeys.has(note)) {
                this.playNote(note);
            }
        });

        document.addEventListener("keyup", (e) => {
            const note = this.keyboardMap[e.key.toLowerCase()];
            if (note) {
                this.pressedKeys.delete(note);
                this.synth.triggerRelease(note);
                this.render();
            }
        });
    }

    playNote(note) {
        this.pressedKeys.add(note);
        this.synth.triggerAttack(note);

        if (!this.isRecording) {
            this.isRecording = true;
            this.recordingStartTime = Date.now();
        }

        const time = Date.now() - this.recordingStartTime;
        this.recordedNotes.push({
            note,
            time: time, // Remove quantization
            duration: this.whiteKeyWidth,
        });

        // Update time scale based on total duration
        const maxTime = Math.max(...this.recordedNotes.map((n) => n.time));
        if (maxTime > 0) {
            this.timeScale =
                (this.pianoRoll.width - this.whiteKeyWidth) / maxTime;
        }

        this.render();
    }

    async playRecording() {
        const playButton = document.getElementById("playButton");
        playButton.disabled = true;
        playButton.textContent = "Playing...";

        const sortedNotes = [...this.recordedNotes].sort(
            (a, b) => a.time - b.time,
        );

        for (const note of sortedNotes) {
            this.synth.triggerAttackRelease(note.note, "8n");
            if (sortedNotes.indexOf(note) < sortedNotes.length - 1) {
                const nextNote = sortedNotes[sortedNotes.indexOf(note) + 1];
                const waitTime = nextNote.time - note.time;
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
        }

        playButton.disabled = false;
        playButton.textContent = "Play";
    }

    getNoteFromClick(e) {
        const rect = this.pianoKeys.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const octaveWidth = 7 * this.whiteKeyWidth;
        const octave = Math.floor(x / octaveWidth);
        const position = x % octaveWidth;

        const whiteKeys = ["C", "D", "E", "F", "G", "A", "B"];
        const blackKeys = ["C#", "D#", null, "F#", "G#", "A#", null];

        // Check black keys first with improved hit detection
        if (y < this.pianoKeys.height * 0.6) {
            // Calculate black key positions
            const blackKeyPositions = [
                this.whiteKeyWidth - this.blackKeyWidth / 2, // C#
                this.whiteKeyWidth * 2 - this.blackKeyWidth / 2, // D#
                this.whiteKeyWidth * 4 - this.blackKeyWidth / 2, // F#
                this.whiteKeyWidth * 5 - this.blackKeyWidth / 2, // G#
                this.whiteKeyWidth * 6 - this.blackKeyWidth / 2, // A#
            ];

            // Find which black key was clicked
            for (let i = 0; i < blackKeyPositions.length; i++) {
                const keyX = blackKeyPositions[i];
                if (Math.abs(position - keyX) < this.blackKeyWidth / 2) {
                    const note = ["C#", "D#", "F#", "G#", "A#"][i];
                    return `${note}${octave + 4}`;
                }
            }
        }

        // Check white keys
        const whiteKeyIndex = Math.floor(position / this.whiteKeyWidth);
        if (whiteKeyIndex >= 0 && whiteKeyIndex < whiteKeys.length) {
            return `${whiteKeys[whiteKeyIndex]}${octave + 4}`;
        }

        return null;
    }

    render() {
        this.renderPianoRoll();
        this.renderPianoKeys();
    }

    renderPianoRoll() {
        const ctx = this.rollCtx;
        ctx.clearRect(0, 0, this.pianoRoll.width, this.pianoRoll.height);

        // Draw grid
        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 1;

        // Horizontal lines (notes)
        for (let i = 0; i <= this.octaves * 12; i++) {
            const y = i * this.noteHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.pianoRoll.width, y);
            ctx.stroke();
        }

        // Draw recorded notes with scaled positions
        if (this.recordedNotes.length > 0) {
            ctx.fillStyle = "#4CAF50";
            this.recordedNotes.forEach((note) => {
                const y = this.getNoteY(note.note);
                const x = note.time * this.timeScale;
                const width = Math.max(5, this.whiteKeyWidth * this.timeScale); // Minimum width for visibility
                ctx.fillRect(x, y, width, this.noteHeight - 1);
            });
        }
    }

    renderPianoKeys() {
        const ctx = this.keysCtx;
        ctx.clearRect(0, 0, this.pianoKeys.width, this.pianoKeys.height);

        const getKeyForNote = (note) => {
            return Object.entries(this.keyboardMap).find(([_, n]) => n === note)?.[0];
        };

        // Draw white keys
        for (let octave = 0; octave < this.octaves; octave++) {
            for (let i = 0; i < 7; i++) {
                const x = (octave * 7 + i) * this.whiteKeyWidth;
                const note = `${["C", "D", "E", "F", "G", "A", "B"][i]}${octave + 4}`;
                const isPressed = this.pressedKeys.has(
                    `${["C", "D", "E", "F", "G", "A", "B"][i]}${octave + 4}`,
                );

                ctx.fillStyle = isPressed ? "#cccccc" : "#ffffff";
                ctx.fillRect(
                    x,
                    0,
                    this.whiteKeyWidth - 1,
                    this.pianoKeys.height,
                );
                ctx.strokeStyle = "#000000";
                ctx.strokeRect(
                    x,
                    0,
                    this.whiteKeyWidth - 1,
                    this.pianoKeys.height,
                );

                const keyLabel = getKeyForNote(note);
                if (keyLabel) {
                    ctx.fillStyle = "#000000";
                    ctx.font = "12px Arial";
                    ctx.fillText(keyLabel.toUpperCase(), 
                        x + this.whiteKeyWidth/2 - 5, 
                        this.pianoKeys.height - 15);
                }
            }
        }

        // Draw black keys
        for (let octave = 0; octave < this.octaves; octave++) {
            const blackKeyPositions = [1, 2, 4, 5, 6];
            blackKeyPositions.forEach((pos, index) => {
                const x =
                    (octave * 7 + pos) * this.whiteKeyWidth -
                    this.blackKeyWidth / 2;
                const note = `${["C#", "D#", "F#", "G#", "A#"][index]}${octave + 4}`;
                const isPressed = this.pressedKeys.has(note);

                ctx.fillStyle = isPressed ? "#666666" : "#000000";
                ctx.fillRect(
                    x,
                    0,
                    this.blackKeyWidth,
                    this.pianoKeys.height * 0.6,
                );

                const keyLabel = getKeyForNote(note);
                if (keyLabel) {
                    ctx.fillStyle = "#ffffff";
                    ctx.font = "10px Arial";
                    ctx.fillText(keyLabel.toUpperCase(), 
                        x + this.blackKeyWidth/2 - 4, 
                        this.pianoKeys.height * 0.4);
                }
            });
        }
    }

    getNoteY(note) {
        const noteMap = {
            C: 0,
            "C#": 1,
            D: 2,
            "D#": 3,
            E: 4,
            F: 5,
            "F#": 6,
            G: 7,
            "G#": 8,
            A: 9,
            "A#": 10,
            B: 11,
        };
        const noteName = note.slice(0, -1);
        const octave = parseInt(note.slice(-1)) - 4;
        return (octave * 12 + noteMap[noteName]) * this.noteHeight;
    }

    getRecordedNotes() {
        return this.recordedNotes.map(note => ({
            note: note.note,
            time: note.time,
            duration: note.duration
        }));
    }
}

export default PianoRoll;
