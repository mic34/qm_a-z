/* ========================================
   QUANTUM SCRABBLE - AUDIO SYSTEM
   ======================================== */

const AudioSystem = {
    enabled: true,
    volume: 0.5,
    context: null,

    // Audio frequencies for synthesis
    sounds: {
        collapse: { freq: 800, duration: 0.15, type: 'sine' },
        place: { freq: 400, duration: 0.1, type: 'triangle' },
        score: { freq: 600, duration: 0.2, type: 'sine' },
        bonus: { freq: [523, 659, 784], duration: 0.3, type: 'sine' },
        error: { freq: 200, duration: 0.2, type: 'sawtooth' },
        power: { freq: 1000, duration: 0.25, type: 'square' },
        portal: { freq: [300, 600, 1200], duration: 0.4, type: 'sine' },
        tick: { freq: 1200, duration: 0.05, type: 'square' }
    },

    init() {
        // Create audio context on first user interaction
        document.addEventListener('click', () => this.initContext(), { once: true });
    },

    initContext() {
        if (this.context) return;
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not available');
            this.enabled = false;
        }
    },

    play(soundName) {
        if (!this.enabled || !this.context) return;

        const sound = this.sounds[soundName];
        if (!sound) return;

        try {
            if (Array.isArray(sound.freq)) {
                // Chord or arpeggio
                sound.freq.forEach((freq, i) => {
                    setTimeout(() => this.playTone(freq, sound.duration, sound.type), i * 50);
                });
            } else {
                this.playTone(sound.freq, sound.duration, sound.type);
            }
        } catch (e) {
            // Ignore audio errors
        }
    },

    playTone(frequency, duration, type = 'sine') {
        if (!this.context) return;

        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);

        gainNode.gain.setValueAtTime(this.volume * 0.3, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);

        oscillator.start();
        oscillator.stop(this.context.currentTime + duration);
    },

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    },

    toggle() {
        this.enabled = !this.enabled;
    }
};
