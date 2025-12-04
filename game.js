/* ========================================
   QUANTUM SCRABBLE - MAIN GAME CONTROLLER
   ======================================== */

const Game = {
    // Game state
    mode: 'classic',
    score: 0,
    round: 1,
    rack: [],
    placedThisTurn: [],
    isFirstMove: true,
    gameActive: false,
    selectedTile: null, // For click-to-place functionality

    // Timer state (for time attack mode)
    timer: null,
    timeRemaining: 90,

    // Stats
    stats: {
        wordsPlayed: 0,
        bestWord: { word: '', score: 0 },
        collapseCount: 0
    },

    // Initialize the game
    init() {
        this.setupEventListeners();
        AudioSystem.init();
        this.showModeSelection();
    },

    // Show mode selection modal
    showModeSelection() {
        const modal = document.getElementById('mode-modal');
        modal.classList.add('active');

        modal.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.mode = btn.dataset.mode;
                modal.classList.remove('active');
                this.startGame();
            });
        });
    },

    // Start a new game
    startGame() {
        this.score = 0;
        this.round = 1;
        this.isFirstMove = true;
        this.gameActive = true;
        this.placedThisTurn = [];
        this.stats = { wordsPlayed: 0, bestWord: { word: '', score: 0 }, collapseCount: 0 };

        // Reset systems
        BoardSystem.init();
        PowerSystem.reset();
        CollapseSystem.reset();

        // Apply mode-specific settings
        if (this.mode === 'time-attack') {
            this.timeRemaining = 90;
            this.startTimer();
            document.getElementById('timer-container').classList.add('active');
        } else {
            document.getElementById('timer-container').classList.remove('active');
        }

        if (this.mode === 'chaos') {
            BoardSystem.randomizeZones();
        }

        // Generate initial rack
        this.rack = TileSystem.generateRack(7);
        this.renderRack();

        // Update UI
        this.updateScoreDisplay();

        this.showNotification(`${this.getModeDisplayName()} started! Place tiles on the center star.`, 'success');
    },

    getModeDisplayName() {
        const names = {
            'classic': 'Classic Quantum',
            'time-attack': 'Time Attack',
            'chaos': 'Quantum Chaos',
            'zen': 'Zen Mode'
        };
        return names[this.mode] || 'Quantum Scrabble';
    },

    // Setup event listeners
    setupEventListeners() {
        // Rack controls
        document.getElementById('shuffle-rack')?.addEventListener('click', () => this.shuffleRack());
        document.getElementById('submit-word')?.addEventListener('click', () => this.submitWord());
        document.getElementById('recall-tiles')?.addEventListener('click', () => this.recallTiles());
        document.getElementById('play-again')?.addEventListener('click', () => this.restartGame());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (PowerSystem.activePower === 'entropy' && PowerSystem.selectedTiles.length > 0) {
                    PowerSystem.finalizeEntropy();
                } else {
                    this.submitWord();
                }
            } else if (e.key === 'Escape') {
                PowerSystem.deactivatePower();
                this.recallTiles();
            }
        });
    },

    // Render tile rack
    renderRack() {
        const rackEl = document.getElementById('tile-rack');
        rackEl.innerHTML = '';

        for (const tile of this.rack) {
            const slotEl = document.createElement('div');
            slotEl.className = 'rack-slot';

            const tileEl = TileSystem.createTileElement(tile);

            // Setup drag events
            tileEl.addEventListener('dragstart', (e) => {
                if (tile.collapsed && !PowerSystem.activePower) {
                    e.preventDefault();
                    return;
                }
                tileEl.classList.add('dragging');
                e.dataTransfer.setData('text/plain', tile.id.toString());
                e.dataTransfer.effectAllowed = 'move';
            });

            tileEl.addEventListener('dragend', () => {
                tileEl.classList.remove('dragging');
            });

            // Click for powers or selection
            tileEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (PowerSystem.activePower) {
                    const cell = this.findTileCell(tile);
                    if (cell) {
                        PowerSystem.handleTileClick(tile, cell);
                    }
                } else {
                    // Click-to-select mode
                    this.selectTile(tile);
                }
            });

            // Register entangled tiles
            CollapseSystem.registerTile(tile);

            slotEl.appendChild(tileEl);
            rackEl.appendChild(slotEl);
        }
    },

    // Select a tile for click-to-place
    selectTile(tile) {
        // Deselect previous 
        if (this.selectedTile) {
            if (this.selectedTile.element) {
                this.selectedTile.element.classList.remove('selected');
            }
        }

        if (this.selectedTile === tile) {
            // Toggle off
            this.selectedTile = null;
            this.showNotification('Tile deselected', 'info');
        } else {
            this.selectedTile = tile;
            if (tile.element) {
                tile.element.classList.add('selected');
            }
            this.showNotification('Tile selected! Click a cell to place it.', 'info');
        }
    },

    // Find cell containing a tile
    findTileCell(tile) {
        return BoardSystem.cells.find(c => c.tile && c.tile.id === tile.id);
    },

    // Place tile on board
    async placeTile(tileId, row, col) {
        const tile = this.rack.find(t => t.id === tileId) ||
            BoardSystem.cells.find(c => c.tile?.id === tileId)?.tile;

        if (!tile) return;

        const cell = BoardSystem.getCell(row, col);
        if (!cell || cell.tile) return;

        // Check valid placement
        if (!BoardSystem.isValidPlacement(row, col, this.isFirstMove)) {
            this.showNotification('Invalid placement! Must be adjacent to existing tiles.', 'error');
            AudioSystem.play('error');
            return;
        }

        // Remove from rack if present
        const rackIndex = this.rack.indexOf(tile);
        if (rackIndex >= 0) {
            this.rack.splice(rackIndex, 1);
        }

        // Place on board
        BoardSystem.placeTile(cell, tile);
        tile.placedThisTurn = true;
        this.placedThisTurn.push({ tile, cell });

        AudioSystem.play('place');

        // Save state for undo
        PowerSystem.saveCollapseState(tile, cell);

        // Collapse the tile
        if (!tile.collapsed) {
            await CollapseSystem.collapseTile(tile, cell);
            this.stats.collapseCount++;
            AudioSystem.play('collapse');
        }

        this.isFirstMove = false;
        this.renderRack();
        this.updateWordPreview();
    },

    // Update word preview
    updateWordPreview() {
        const wordInfoEl = document.getElementById('word-info');

        if (this.placedThisTurn.length === 0) {
            wordInfoEl.classList.remove('active');
            return;
        }

        const newTiles = this.placedThisTurn.map(p => ({ row: p.cell.row, col: p.cell.col }));
        const { validWords, invalidWords } = WordSystem.validateNewWords(BoardSystem.cells, newTiles);

        if (validWords.length > 0) {
            const totalScore = validWords.reduce((sum, w) => sum + WordSystem.calculateWordScore(w.word).finalScore, 0);
            wordInfoEl.innerHTML = `
                <span class="word-formed">${validWords.map(w => w.word).join(', ')}</span>
                <span class="word-score">+${totalScore} pts</span>
            `;
            wordInfoEl.classList.add('active');
        } else if (invalidWords.length > 0) {
            wordInfoEl.innerHTML = `
                <span class="word-formed" style="color: #ef4444;">${invalidWords.map(w => w.word).join(', ')}</span>
                <span class="word-score">Invalid!</span>
            `;
            wordInfoEl.classList.add('active');
        } else {
            wordInfoEl.classList.remove('active');
        }
    },

    // Submit word
    async submitWord() {
        if (this.placedThisTurn.length === 0) {
            this.showNotification('Place some tiles first!', 'warning');
            return;
        }

        const newTiles = this.placedThisTurn.map(p => ({ row: p.cell.row, col: p.cell.col }));
        const { validWords, invalidWords } = WordSystem.validateNewWords(BoardSystem.cells, newTiles);

        if (invalidWords.length > 0) {
            this.showNotification(`Invalid word: ${invalidWords[0].word}`, 'error');
            AudioSystem.play('error');
            return;
        }

        if (validWords.length === 0) {
            this.showNotification('No valid words formed!', 'error');
            AudioSystem.play('error');
            return;
        }

        // Calculate score with bonuses
        let totalScore = 0;
        const bonusInfo = {
            superpositionCount: this.placedThisTurn.filter(p => p.tile.type === TileSystem.TYPES.SUPERPOSITION).length,
            hasEntangledPair: this.placedThisTurn.some(p => p.tile.type === TileSystem.TYPES.ENTANGLED),
            allCleanCollapses: true,
            usedPortal: this.placedThisTurn.some(p => p.tile.usedPortal)
        };

        for (const wordInfo of validWords) {
            const result = WordSystem.calculateWordScore(wordInfo.word, bonusInfo);
            totalScore += result.finalScore;

            // Track best word
            if (result.finalScore > this.stats.bestWord.score) {
                this.stats.bestWord = { word: wordInfo.word, score: result.finalScore };
            }

            // Show bonuses
            for (const bonus of result.bonuses) {
                this.showNotification(`${bonus.name}: ${bonus.bonus}`, 'bonus');
            }
        }

        // Apply Zen mode (no penalties)
        if (this.mode === 'zen') {
            totalScore = Math.max(0, totalScore);
        }

        this.score += totalScore;
        this.stats.wordsPlayed += validWords.length;

        AudioSystem.play('score');
        if (bonusInfo.hasEntangledPair || bonusInfo.superpositionCount >= 3) {
            AudioSystem.play('bonus');
        }

        this.showNotification(`+${totalScore} points! (${validWords.map(w => w.word).join(', ')})`, 'success');

        // End turn
        this.endTurn();
    },

    // End turn
    endTurn() {
        this.placedThisTurn = [];
        BoardSystem.clearNewTileMarkers();

        // Refill rack
        this.rack = TileSystem.refillRack(this.rack, 7);
        this.renderRack();

        // Advance cooldowns
        PowerSystem.advanceCooldowns();
        this.round++;

        // Chaos mode - shift zones
        if (this.mode === 'chaos' && this.round % 3 === 0) {
            BoardSystem.randomizeZones();
            this.showNotification('Quantum chaos! Zones shifted!', 'warning');
        }

        this.updateScoreDisplay();
        document.getElementById('word-info').classList.remove('active');

        // Check game end
        if (this.rack.length === 0) {
            this.endGame();
        }
    },

    // Recall tiles back to rack
    recallTiles() {
        for (const { tile, cell } of this.placedThisTurn) {
            BoardSystem.removeTile(cell);

            // Reset tile state
            if (!tile.originallyCollapsed) {
                tile.collapsed = false;
                tile.letter = null;
            }

            this.rack.push(tile);
        }

        this.placedThisTurn = [];
        this.renderRack();
        document.getElementById('word-info').classList.remove('active');
    },

    // Shuffle rack
    shuffleRack() {
        for (let i = this.rack.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.rack[i], this.rack[j]] = [this.rack[j], this.rack[i]];
        }
        this.renderRack();
        AudioSystem.play('tick');
    },

    // Update score display
    updateScoreDisplay() {
        document.getElementById('current-score').textContent = this.score;
        document.getElementById('current-round').textContent = this.round;
    },

    // Timer functions
    startTimer() {
        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 10) {
                AudioSystem.play('tick');
            }

            if (this.timeRemaining <= 0) {
                this.endGame();
            }
        }, 1000);
    },

    updateTimerDisplay() {
        const mins = Math.floor(this.timeRemaining / 60);
        const secs = this.timeRemaining % 60;
        document.getElementById('timer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // End game
    endGame() {
        this.gameActive = false;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        // Show game over modal
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('total-words').textContent = this.stats.wordsPlayed;
        document.getElementById('best-word').textContent = this.stats.bestWord.word || '--';
        document.getElementById('total-collapses').textContent = this.stats.collapseCount;

        document.getElementById('game-over-modal').classList.add('active');
    },

    // Restart game
    restartGame() {
        document.getElementById('game-over-modal').classList.remove('active');
        BoardSystem.reset();
        this.showModeSelection();
    },

    // Show notification
    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};

// Start game when DOM is ready
document.addEventListener('DOMContentLoaded', () => Game.init());
