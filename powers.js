/* ========================================
   QUANTUM SCRABBLE - PLAYER POWERS
   ======================================== */

const PowerSystem = {
    powers: {
        forced: { name: 'Forced Collapse', cooldown: 3, currentCooldown: 0, icon: '⚡' },
        swap: { name: 'Quantum Swap', cooldown: 5, currentCooldown: 0, icon: '🔄' },
        undo: { name: 'Undo Collapse', cooldown: 8, currentCooldown: 0, icon: '↩️' },
        entropy: { name: 'Entropy Burst', cooldown: 6, currentCooldown: 0, icon: '🌀' }
    },

    activePower: null,
    selectedTiles: [],
    lastCollapse: null,

    init() {
        this.setupPowerButtons();
        this.updateUI();
    },

    setupPowerButtons() {
        for (const [id, power] of Object.entries(this.powers)) {
            const btn = document.getElementById(`power-${id}`);
            if (btn) {
                btn.addEventListener('click', () => this.activatePower(id));
            }
        }
    },

    activatePower(powerId) {
        const power = this.powers[powerId];
        if (!power || power.currentCooldown > 0) {
            Game.showNotification(`${power.name} is on cooldown!`, 'warning');
            return;
        }

        if (this.activePower === powerId) {
            this.deactivatePower();
            return;
        }

        this.activePower = powerId;
        this.selectedTiles = [];

        // Update UI
        document.querySelectorAll('.power-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`power-${powerId}`).classList.add('active');

        // Show instructions
        switch (powerId) {
            case 'forced':
                Game.showNotification('Click a superposition tile to force its collapse', 'info');
                break;
            case 'swap':
                Game.showNotification('Click two tiles on the board to swap them', 'info');
                break;
            case 'undo':
                this.executeUndo();
                break;
            case 'entropy':
                Game.showNotification('Click up to 3 tiles to randomize', 'info');
                break;
        }
    },

    deactivatePower() {
        this.activePower = null;
        this.selectedTiles = [];
        document.querySelectorAll('.power-btn').forEach(btn => btn.classList.remove('active'));
    },

    // Handle tile click for power effects
    handleTileClick(tile, cell) {
        if (!this.activePower) return false;

        switch (this.activePower) {
            case 'forced':
                return this.executeForcedCollapse(tile, cell);
            case 'swap':
                return this.executeSwap(tile, cell);
            case 'entropy':
                return this.executeEntropy(tile, cell);
        }
        return false;
    },

    // Forced Collapse - Player chooses the letter
    async executeForcedCollapse(tile, cell) {
        if (tile.collapsed || !tile.letters) {
            Game.showNotification('Select a superposition tile!', 'warning');
            return false;
        }

        // Create letter choice UI
        const choice = await this.showLetterChoice(tile.letters);
        if (choice) {
            tile.letter = choice;
            tile.collapsed = true;
            tile.value = WordSystem.getLetterValue(choice);
            TileSystem.updateTileElement(tile);
            CollapseSystem.createCollapseParticles(cell.element);

            this.usePower('forced');
            Game.showNotification(`Forced collapse to ${choice}!`, 'success');
            return true;
        }
        return false;
    },

    // Show letter choice modal
    showLetterChoice(letters) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'modal active';
            overlay.innerHTML = `
                <div class="modal-content">
                    <h2>Choose Letter</h2>
                    <div style="display: flex; gap: 20px; justify-content: center; margin-top: 20px;">
                        ${letters.map(l => `
                            <button class="control-btn primary letter-choice" data-letter="${l}" style="font-size: 2rem; padding: 20px 40px;">
                                ${l}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            overlay.querySelectorAll('.letter-choice').forEach(btn => {
                btn.addEventListener('click', () => {
                    const letter = btn.dataset.letter;
                    overlay.remove();
                    resolve(letter);
                });
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(null);
                }
            });
        });
    },

    // Quantum Swap - Swap two tiles
    executeSwap(tile, cell) {
        this.selectedTiles.push({ tile, cell });

        if (this.selectedTiles.length === 1) {
            cell.element.style.outline = '3px solid var(--quantum-cyan)';
            Game.showNotification('Select second tile to swap', 'info');
            return false;
        }

        if (this.selectedTiles.length === 2) {
            const [first, second] = this.selectedTiles;

            // Remove outlines
            first.cell.element.style.outline = '';
            second.cell.element.style.outline = '';

            // Perform swap
            first.cell.tile = second.tile;
            second.cell.tile = first.tile;

            // Move elements
            if (first.tile.element.parentElement) {
                first.tile.element.parentElement.removeChild(first.tile.element);
            }
            if (second.tile.element.parentElement) {
                second.tile.element.parentElement.removeChild(second.tile.element);
            }

            first.cell.element.appendChild(second.tile.element);
            second.cell.element.appendChild(first.tile.element);

            this.usePower('swap');
            Game.showNotification('Tiles swapped!', 'success');
            return true;
        }
        return false;
    },

    // Entropy Burst - Randomize tiles
    executeEntropy(tile, cell) {
        if (!tile.collapsed) {
            Game.showNotification('Select a collapsed tile!', 'warning');
            return false;
        }

        this.selectedTiles.push({ tile, cell });
        cell.element.style.outline = '3px solid var(--quantum-orange)';

        if (this.selectedTiles.length >= 3) {
            this.finalizeEntropy();
            return true;
        }

        Game.showNotification(`Selected ${this.selectedTiles.length}/3 tiles. Press Enter or select more.`, 'info');
        return false;
    },

    finalizeEntropy() {
        for (const { tile, cell } of this.selectedTiles) {
            tile.letter = TileSystem.getRandomLetter();
            tile.value = WordSystem.getLetterValue(tile.letter);
            TileSystem.updateTileElement(tile);
            cell.element.style.outline = '';
            CollapseSystem.createCollapseParticles(cell.element);
        }

        this.usePower('entropy');
        Game.showNotification(`Entropy burst! ${this.selectedTiles.length} tiles randomized!`, 'success');
    },

    // Undo Collapse
    executeUndo() {
        if (!this.lastCollapse) {
            Game.showNotification('No collapse to undo!', 'warning');
            this.deactivatePower();
            return;
        }

        const { tile, cell, previousState } = this.lastCollapse;

        // Restore previous state
        tile.collapsed = false;
        tile.letter = null;
        tile.letters = previousState.letters;
        tile.type = previousState.type;

        // Update element
        tile.element.className = `tile ${tile.type}`;
        if (tile.letters) {
            tile.element.innerHTML = `
                <span class="tile-letter">
                    ${tile.letters[0]}
                    <span class="alt-letter">${tile.letters[1]}</span>
                </span>
                <span class="tile-value">${tile.value}</span>
            `;
        }

        this.usePower('undo');
        this.lastCollapse = null;
        Game.showNotification('Collapse undone!', 'success');
        this.deactivatePower();
    },

    // Save state before collapse (for undo)
    saveCollapseState(tile, cell) {
        this.lastCollapse = {
            tile,
            cell,
            previousState: {
                letters: tile.letters ? [...tile.letters] : null,
                type: tile.type
            }
        };
    },

    // Use a power and start cooldown
    usePower(powerId) {
        const power = this.powers[powerId];
        power.currentCooldown = power.cooldown;
        this.deactivatePower();
        this.updateUI();
    },

    // Advance cooldowns (called each round)
    advanceCooldowns() {
        for (const power of Object.values(this.powers)) {
            if (power.currentCooldown > 0) {
                power.currentCooldown--;
            }
        }
        this.updateUI();
    },

    // Update power button UI
    updateUI() {
        for (const [id, power] of Object.entries(this.powers)) {
            const btn = document.getElementById(`power-${id}`);
            if (!btn) continue;

            const cooldownEl = btn.querySelector('.power-cooldown');

            if (power.currentCooldown > 0) {
                btn.classList.add('on-cooldown');
                cooldownEl.textContent = `${power.currentCooldown} rounds`;
            } else {
                btn.classList.remove('on-cooldown');
                cooldownEl.textContent = 'Ready';
            }
        }
    },

    // Reset powers
    reset() {
        for (const power of Object.values(this.powers)) {
            power.currentCooldown = 0;
        }
        this.activePower = null;
        this.selectedTiles = [];
        this.lastCollapse = null;
        this.updateUI();
    }
};
