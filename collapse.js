/* ========================================
   QUANTUM SCRABBLE - COLLAPSE SYSTEM
   ======================================== */

const CollapseSystem = {
    pendingCollapses: [],
    entangledTiles: new Map(), // Map entangleId -> tiles

    // Register a tile for potential entanglement tracking
    registerTile(tile) {
        if (tile.type === TileSystem.TYPES.ENTANGLED) {
            const existing = this.entangledTiles.get(tile.entangleId) || [];
            existing.push(tile);
            this.entangledTiles.set(tile.entangleId, existing);
        }
    },

    // Main collapse function
    async collapseTile(tile, cell) {
        if (tile.collapsed) return tile;

        // Apply animations
        tile.element.classList.add('collapsing');
        await this.delay(300);

        // Determine collapse based on zone
        if (cell.zone) {
            await this.handleZoneCollapse(tile, cell);
        } else if (tile.type === TileSystem.TYPES.ENTANGLED) {
            await this.handleEntangledCollapse(tile, cell);
        } else {
            await this.handleStandardCollapse(tile, cell);
        }

        // Update tile element
        tile.collapsed = true;
        tile.value = WordSystem.getLetterValue(tile.letter);
        TileSystem.updateTileElement(tile);
        tile.element.classList.remove('collapsing');

        // Create particles
        this.createCollapseParticles(cell.element);

        return tile;
    },

    // Handle zone-specific collapse
    async handleZoneCollapse(tile, cell) {
        switch (cell.zone) {
            case 'quantum-well':
                // Delays collapse - choose best letter after delay
                await this.delay(500);
                tile.letter = this.chooseBestLetter(tile, cell);
                Game.showNotification('Quantum Well delayed collapse', 'info');
                break;

            case 'phase-shift':
                // Swaps letter order - picks the second letter
                tile.letter = tile.letters ? tile.letters[1] : this.chooseBestLetter(tile, cell);
                Game.showNotification('Phase-Shift swapped outcome!', 'warning');
                break;

            case 'decoherence':
                // Immediate random collapse
                tile.letter = tile.letters ? tile.letters[Math.floor(Math.random() * 2)] : this.getRandomLetter();
                Game.showNotification('Decoherence forced random collapse!', 'warning');
                break;

            case 'entanglement':
                // Links to a random tile from rack
                await this.handleEntanglementNode(tile, cell);
                break;

            case 'portal':
                // Teleport to partner portal
                await this.handlePortalTeleport(tile, cell);
                break;

            default:
                tile.letter = this.chooseBestLetter(tile, cell);
        }
    },

    // Handle entangled tile collapse
    async handleEntangledCollapse(tile, cell) {
        const partners = this.entangledTiles.get(tile.entangleId) || [];
        const partner = partners.find(t => t.id !== tile.id);

        const letter = this.chooseBestLetter(tile, cell);
        tile.letter = letter;

        if (partner && !partner.collapsed) {
            switch (tile.entangleType) {
                case 'same':
                    partner.letter = letter;
                    break;
                case 'opposite':
                    partner.letter = tile.letters[tile.letters.indexOf(letter) === 0 ? 1 : 0];
                    break;
                case 'complement':
                    // Next letter in alphabet
                    const code = letter.charCodeAt(0);
                    partner.letter = String.fromCharCode(code >= 90 ? 65 : code + 1);
                    break;
            }
            partner.collapsed = true;
            partner.value = WordSystem.getLetterValue(partner.letter);
            TileSystem.updateTileElement(partner);
            Game.showNotification(`Entanglement resolved: ${tile.entangleType}!`, 'bonus');
        }
    },

    // Standard collapse - choose best outcome
    async handleStandardCollapse(tile, cell) {
        tile.letter = this.chooseBestLetter(tile, cell);
    },

    // Choose the best letter based on context
    chooseBestLetter(tile, cell) {
        if (tile.type === TileSystem.TYPES.WILD) {
            return this.chooseWildLetter(cell);
        }

        if (!tile.letters) {
            return TileSystem.getRandomLetter();
        }

        // Evaluate both options
        const adjacentLetters = this.getAdjacentLetters(cell);
        let bestLetter = tile.letters[0];
        let bestScore = -1;

        for (const letter of tile.letters) {
            const score = this.evaluateLetterScore(letter, adjacentLetters);
            if (score > bestScore) {
                bestScore = score;
                bestLetter = letter;
            }
        }

        return bestLetter;
    },

    // Choose letter for wild tile based on context
    chooseWildLetter(cell) {
        const adjacent = this.getAdjacentLetters(cell);
        if (adjacent.length === 0) {
            return 'E'; // Most common letter
        }

        // Try common vowels and consonants that might complete words
        const candidates = ['E', 'A', 'I', 'O', 'U', 'S', 'T', 'R', 'N'];
        for (const letter of candidates) {
            if (this.evaluateLetterScore(letter, adjacent) > 0) {
                return letter;
            }
        }
        return 'E';
    },

    // Get letters from adjacent cells
    getAdjacentLetters(cell) {
        const adjacent = BoardSystem.getAdjacentCells(cell.row, cell.col);
        return adjacent
            .filter(c => c.tile && c.tile.letter)
            .map(c => ({ letter: c.tile.letter, direction: this.getDirection(cell, c) }));
    },

    getDirection(from, to) {
        if (to.row < from.row) return 'up';
        if (to.row > from.row) return 'down';
        if (to.col < from.col) return 'left';
        return 'right';
    },

    // Evaluate potential score for a letter choice
    evaluateLetterScore(letter, adjacentLetters) {
        let score = WordSystem.getLetterValue(letter);

        // Bonus for vowels when adjacent to consonants
        const vowels = 'AEIOU';
        const isVowel = vowels.includes(letter);

        for (const adj of adjacentLetters) {
            const adjIsVowel = vowels.includes(adj.letter);
            if (isVowel !== adjIsVowel) {
                score += 2; // Vowel-consonant pairs are often useful
            }
        }

        return score;
    },

    // Handle entanglement node zone
    async handleEntanglementNode(tile, cell) {
        // Create entanglement with a random rack tile
        const rackTiles = Game.rack.filter(t => !t.collapsed && t.type !== TileSystem.TYPES.STABLE);

        if (rackTiles.length > 0) {
            const partner = rackTiles[Math.floor(Math.random() * rackTiles.length)];
            const entangleId = TileSystem.nextEntangleId++;

            tile.entangleId = entangleId;
            partner.entangleId = entangleId;
            tile.entangleType = 'same';
            partner.entangleType = 'same';

            this.registerTile(tile);
            this.registerTile(partner);

            Game.showNotification('Entanglement created with rack tile!', 'bonus');
        }

        tile.letter = this.chooseBestLetter(tile, cell);
    },

    // Handle portal teleportation
    async handlePortalTeleport(tile, cell) {
        const partner = BoardSystem.getPortalPartner(cell.row, cell.col);

        if (partner && !partner.tile) {
            // Teleport tile to partner portal
            BoardSystem.removeTile(cell);
            BoardSystem.placeTile(partner, tile);

            tile.letter = this.chooseBestLetter(tile, partner);
            tile.usedPortal = true;

            Game.showNotification('Tile teleported through portal!', 'bonus');
            this.createPortalParticles(cell.element, partner.element);
        } else {
            tile.letter = this.chooseBestLetter(tile, cell);
        }
    },

    getRandomLetter() {
        return TileSystem.getRandomLetter();
    },

    // Create collapse particle effect
    createCollapseParticles(element) {
        const rect = element.getBoundingClientRect();
        const colors = ['#00f7ff', '#a855f7', '#ec4899'];

        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = rect.left + rect.width / 2 + 'px';
            particle.style.top = rect.top + rect.height / 2 + 'px';
            particle.style.width = '8px';
            particle.style.height = '8px';
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            particle.style.setProperty('--tx', (Math.random() - 0.5) * 100 + 'px');
            particle.style.setProperty('--ty', (Math.random() - 0.5) * 100 + 'px');

            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
    },

    // Create portal teleport effect
    createPortalParticles(fromEl, toEl) {
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = fromRect.left + fromRect.width / 2 + 'px';
            particle.style.top = fromRect.top + fromRect.height / 2 + 'px';
            particle.style.width = '6px';
            particle.style.height = '6px';
            particle.style.background = '#f97316';
            particle.style.setProperty('--tx', (toRect.left - fromRect.left) + 'px');
            particle.style.setProperty('--ty', (toRect.top - fromRect.top) + 'px');

            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Reset collapse system
    reset() {
        this.pendingCollapses = [];
        this.entangledTiles.clear();
    }
};
