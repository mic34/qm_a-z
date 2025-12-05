/* ========================================
   QUANTUM SCRABBLE - GAME BOARD
   ======================================== */

const BoardSystem = {
    size: 13,
    cells: [],
    zoneTypes: ['quantum-well', 'phase-shift', 'decoherence', 'entanglement', 'portal'],
    portalPairs: [],

    // Zone positions (predefined for consistent gameplay)
    zonePositions: {
        'quantum-well': [[2, 2], [2, 10], [10, 2], [10, 10], [6, 0], [6, 12]],
        'phase-shift': [[0, 6], [12, 6], [4, 4], [4, 8], [8, 4], [8, 8]],
        'decoherence': [[1, 1], [1, 11], [11, 1], [11, 11]],
        'entanglement': [[3, 6], [9, 6], [6, 3], [6, 9]],
        'portal': [[0, 0], [12, 12], [0, 12], [12, 0]]
    },

    // Initialize the board
    init() {
        this.cells = [];
        this.portalPairs = [];

        const boardEl = document.getElementById('game-board');
        if (!boardEl) return;

        boardEl.innerHTML = '';

        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                const cell = this.createCell(row, col);
                this.cells.push(cell);
                boardEl.appendChild(cell.element);
            }
        }

        this.applyZones();
        this.setupPortalPairs();
        this.setupDropZones();
    },

    // Create a single cell
    createCell(row, col) {
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.row = row;
        el.dataset.col = col;

        // Center star
        if (row === 6 && col === 6) {
            el.classList.add('center-star');
        }

        return {
            row,
            col,
            element: el,
            tile: null,
            zone: null
        };
    },

    // Apply quantum zones to cells
    applyZones() {
        for (const [zoneType, positions] of Object.entries(this.zonePositions)) {
            for (const [row, col] of positions) {
                const cell = this.getCell(row, col);
                if (cell) {
                    cell.zone = zoneType;
                    cell.element.classList.add(zoneType);
                }
            }
        }
    },

    // Setup portal pairs
    setupPortalPairs() {
        const portalPositions = this.zonePositions['portal'];
        this.portalPairs = [
            { a: portalPositions[0], b: portalPositions[1] },
            { a: portalPositions[2], b: portalPositions[3] }
        ];
    },

    // Get cell at position
    getCell(row, col) {
        return this.cells.find(c => c.row === row && c.col === col);
    },

    // Get portal partner
    getPortalPartner(row, col) {
        for (const pair of this.portalPairs) {
            if (pair.a[0] === row && pair.a[1] === col) {
                return this.getCell(pair.b[0], pair.b[1]);
            }
            if (pair.b[0] === row && pair.b[1] === col) {
                return this.getCell(pair.a[0], pair.a[1]);
            }
        }
        return null;
    },

    // Setup drag and drop zones
    setupDropZones() {
        for (const cell of this.cells) {
            cell.element.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!cell.tile) {
                    cell.element.classList.add('valid-drop');
                }
            });

            cell.element.addEventListener('dragleave', () => {
                cell.element.classList.remove('valid-drop');
            });

            cell.element.addEventListener('drop', (e) => {
                e.preventDefault();
                cell.element.classList.remove('valid-drop');

                const tileId = e.dataTransfer.getData('text/plain');
                if (tileId && !cell.tile) {
                    Game.placeTile(parseInt(tileId), cell.row, cell.col);
                }
            });

            // Click handler for click-to-place
            cell.element.addEventListener('click', () => {
                if (Game.selectedTile && !cell.tile) {
                    const tileId = Game.selectedTile.id;
                    Game.selectedTile.element?.classList.remove('selected');
                    Game.selectedTile = null;
                    Game.placeTile(tileId, cell.row, cell.col);
                }
            });
        }
    },

    // Place tile on cell
    placeTile(cell, tile) {
        if (cell.tile) return false;

        cell.tile = tile;
        cell.element.classList.add('has-tile');

        // Remove tile element from rack and add to cell
        if (tile.element.parentElement) {
            tile.element.parentElement.removeChild(tile.element);
        }

        // Adjust tile size for board
        tile.element.style.width = 'calc(100% - 4px)';
        tile.element.style.height = 'calc(100% - 4px)';
        cell.element.appendChild(tile.element);

        return true;
    },

    // Remove tile from cell
    removeTile(cell) {
        if (!cell.tile) return null;

        const tile = cell.tile;
        cell.tile = null;
        cell.element.classList.remove('has-tile');

        if (tile.element.parentElement === cell.element) {
            cell.element.removeChild(tile.element);
        }

        return tile;
    },

    // Get adjacent cells
    getAdjacentCells(row, col) {
        const adjacent = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            const cell = this.getCell(row + dr, col + dc);
            if (cell) adjacent.push(cell);
        }

        return adjacent;
    },

    // Check if cell has any adjacent tile
    hasAdjacentTile(row, col) {
        const adjacent = this.getAdjacentCells(row, col);
        return adjacent.some(c => c.tile !== null);
    },

    // Check if placement is valid (must be adjacent to existing tiles or center)
    isValidPlacement(row, col, isFirstMove) {
        const cell = this.getCell(row, col);
        if (!cell || cell.tile) return false;

        // First move must be on center
        if (isFirstMove) {
            return row === 6 && col === 6;
        }

        // Must be adjacent to an existing tile
        const adjacent = this.getAdjacentCells(row, col);
        return adjacent.some(c => c.tile !== null);
    },

    // Get all placed tiles this turn
    getNewTiles() {
        return this.cells.filter(c => c.tile && c.tile.placedThisTurn);
    },

    // Clear new tile markers
    clearNewTileMarkers() {
        for (const cell of this.cells) {
            if (cell.tile) {
                cell.tile.placedThisTurn = false;
            }
        }
    },

    // Reset board
    reset() {
        for (const cell of this.cells) {
            if (cell.tile) {
                this.removeTile(cell);
            }
        }
    },

    // Randomize zones (for Chaos mode)
    randomizeZones() {
        // Clear existing zones
        for (const cell of this.cells) {
            if (cell.zone) {
                cell.element.classList.remove(cell.zone);
                cell.zone = null;
            }
        }

        // Apply random zones
        const zoneCount = {
            'quantum-well': 6,
            'phase-shift': 6,
            'decoherence': 4,
            'entanglement': 4,
            'portal': 4
        };

        for (const [zoneType, count] of Object.entries(zoneCount)) {
            let placed = 0;
            while (placed < count) {
                const row = Math.floor(Math.random() * this.size);
                const col = Math.floor(Math.random() * this.size);
                const cell = this.getCell(row, col);

                if (cell && !cell.zone && !(row === 6 && col === 6)) {
                    cell.zone = zoneType;
                    cell.element.classList.add(zoneType);
                    placed++;
                }
            }
        }

        // Setup new portal pairs
        const portals = this.cells.filter(c => c.zone === 'portal');
        this.portalPairs = [];
        for (let i = 0; i < portals.length; i += 2) {
            if (portals[i + 1]) {
                this.portalPairs.push({
                    a: [portals[i].row, portals[i].col],
                    b: [portals[i + 1].row, portals[i + 1].col]
                });
            }
        }
    }
};
