const MidiPlayer = {
  mounted() {
    const canvas = this.el.querySelector('canvas');
    const sequence = JSON.parse(canvas.dataset.sequence);
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    
    // Draw the mini piano roll
    this.drawMiniPianoRoll(canvas, sequence);
    
    // Set up play button
    const playButton = this.el.querySelector('button');
    playButton.addEventListener('click', () => this.playSequence(sequence, synth, playButton));
  },

  drawMiniPianoRoll(canvas, sequence) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const noteHeight = 4;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background grid
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    for (let i = 0; i < height; i += noteHeight) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }
    
    // Calculate time scale
    const maxTime = Math.max(...sequence.map(note => note.time));
    const timeScale = (width - 40) / (maxTime || 1);
    
    // Draw notes
    ctx.fillStyle = '#4CAF50';
    sequence.forEach(note => {
      const y = this.getNoteY(note.note) * noteHeight;
      const x = note.time * timeScale;
      const width = Math.max(5, note.duration * timeScale);
      ctx.fillRect(x, y, width, noteHeight - 1);
    });
  },

  getNoteY(note) {
    const noteMap = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    const noteName = note.slice(0, -1);
    const octave = parseInt(note.slice(-1)) - 4;
    return (octave * 12 + noteMap[noteName]);
  },

  async playSequence(sequence, synth, button) {
    button.disabled = true;
    button.textContent = 'Playing...';
    
    const sortedNotes = [...sequence].sort((a, b) => a.time - b.time);
    
    for (const note of sortedNotes) {
      synth.triggerAttackRelease(note.note, '8n');
      if (sortedNotes.indexOf(note) < sortedNotes.length - 1) {
        const nextNote = sortedNotes[sortedNotes.indexOf(note) + 1];
        const waitTime = nextNote.time - note.time;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    button.disabled = false;
    button.textContent = 'Play Sequence';
  }
};

export default MidiPlayer;
