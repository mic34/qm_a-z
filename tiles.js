/* ========================================
   QUANTUM SCRABBLE - TILE SYSTEM
   ======================================== */

const TileSystem = {
    // Tile type constants
    TYPES: {
        STABLE: 'stable',
        SUPERPOSITION: 'superposition',
        ENTANGLED: 'entangled',
        WILD: 'wild'
    },

    // Letter frequency distribution (more common letters appear more often)
    letterPool: 'EEEEEEEEEEAAAAAAAAAIIIIIIIIIOOOOOOOOTTTTTTTTRRRRRRRRNNNNNNSSSSSSLLLLLLCCCCUUUUDDDDPPPPMMMMHHHHGGGGBBFFKKWWVVYYJJXQZ',

    // Superposition pairs (common letter pairings)
    superpositionPairs: [
        ['A', 'E'], ['A', 'O'], ['E', 'I'], ['O', 'U'], ['I', 'O'],
        ['T', 'R'], ['N', 'S'], ['L', 'R'], ['C', 'K'], ['D', 'T'],
        ['M', 'N'], ['B', 'P'], ['F', 'V'], ['G', 'J'], ['H', 'W'],
        ['S', 'Z'], ['A', 'I'], ['E', 'O'], ['R', 'S'], ['T', 'S']
    ],

    // Generate unique IDs
    nextTileId: 1,
    nextEntangleId: 1,

    // Create a new tile
    createTile(type = null, options = {}) {
        // Determine tile type if not specified
        if (!type) {
            const rand = Math.random();
            if (rand < 0.4) type = this.TYPES.SUPERPOSITION;
            else if (rand < 0.55) type = this.TYPES.ENTANGLED;
            else if (rand < 0.60) type = this.TYPES.WILD;
            else type = this.TYPES.STABLE;
        }

        const tile = {
            id: this.nextTileId++,
            type: type,
            collapsed: false,
            letter: null,
            value: 0,
            element: null
        };

        switch (type) {
            case this.TYPES.STABLE:
                tile.letter = this.getRandomLetter();
                tile.collapsed = true;
                tile.value = WordSystem.getLetterValue(tile.letter);
                break;

            case this.TYPES.SUPERPOSITION:
                const pair = options.pair || this.getRandomPair();
                tile.letters = pair;
                tile.probabilities = [0.5, 0.5];
                tile.value = Math.round((WordSystem.getLetterValue(pair[0]) + WordSystem.getLetterValue(pair[1])) / 2);
                break;

            case this.TYPES.ENTANGLED:
                tile.entangleId = options.entangleId || this.nextEntangleId++;
                tile.entangleType = options.entangleType || this.getRandomEntangleType();
                const ePair = options.pair || this.getRandomPair();
                tile.letters = ePair;
                tile.probabilities = [0.5, 0.5];
                tile.value = Math.round((WordSystem.getLetterValue(ePair[0]) + WordSystem.getLetterValue(ePair[1])) / 2);
                break;

            case this.TYPES.WILD:
                tile.letter = '?';
                tile.value = 0;
                break;
        }

        return tile;
    },

    // Create an entangled pair
    createEntangledPair() {
        const entangleId = this.nextEntangleId++;
        const entangleType = this.getRandomEntangleType();
        const pair = this.getRandomPair();

        return [
            this.createTile(this.TYPES.ENTANGLED, { entangleId, entangleType, pair }),
            this.createTile(this.TYPES.ENTANGLED, { entangleId, entangleType, pair })
        ];
    },

    getRandomLetter() {
        return this.letterPool[Math.floor(Math.random() * this.letterPool.length)];
    },

    getRandomPair() {
        return this.superpositionPairs[Math.floor(Math.random() * this.superpositionPairs.length)];
    },

    getRandomEntangleType() {
        const types = ['same', 'opposite', 'complement'];
        return types[Math.floor(Math.random() * types.length)];
    },

    // Create tile DOM element
    createTileElement(tile) {
        const el = document.createElement('div');
        el.className = `tile ${tile.type}`;
        el.dataset.tileId = tile.id;
        el.draggable = true;

        if (tile.type === this.TYPES.SUPERPOSITION || tile.type === this.TYPES.ENTANGLED) {
            el.innerHTML = `
                <span class="tile-letter">
                    ${tile.letters[0]}
                    <span class="alt-letter">${tile.letters[1]}</span>
                </span>
                <span class="tile-value">${tile.value}</span>
            `;
        } else if (tile.type === this.TYPES.WILD) {
            el.innerHTML = `
                <span class="tile-letter">?</span>
                <span class="tile-value">★</span>
            `;
        } else {
            el.innerHTML = `
                <span class="tile-letter">${tile.letter}</span>
                <span class="tile-value">${tile.value}</span>
            `;
        }

        tile.element = el;
        return el;
    },

    // Update tile element after collapse
    updateTileElement(tile) {
        if (!tile.element) return;

        tile.element.className = `tile collapsed`;
        tile.element.innerHTML = `
            <span class="tile-letter">${tile.letter}</span>
            <span class="tile-value">${tile.value}</span>
        `;
    },

    // Generate initial rack of tiles
    generateRack(count = 7) {
        const tiles = [];
        let hasEntangled = false;

        for (let i = 0; i < count; i++) {
            // Ensure at least one entangled pair in rack
            if (i === count - 2 && !hasEntangled) {
                const pair = this.createEntangledPair();
                tiles.push(pair[0], pair[1]);
                hasEntangled = true;
                break;
            }

            const tile = this.createTile();
            if (tile.type === this.TYPES.ENTANGLED) {
                hasEntangled = true;
            }
            tiles.push(tile);
        }

        return tiles;
    },

    // Refill rack to target count
    refillRack(currentTiles, targetCount = 7) {
        const needed = targetCount - currentTiles.length;
        for (let i = 0; i < needed; i++) {
            currentTiles.push(this.createTile());
        }
        return currentTiles;
    }
};
