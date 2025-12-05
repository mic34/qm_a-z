/* ========================================
   QUANTUM SCRABBLE - WORD DICTIONARY & SCORING
   ======================================== */

const WordSystem = {
    // Letter values based on the game design doc
    letterValues: {
        'A': 1, 'E': 1, 'I': 1, 'O': 1, 'T': 1, 'R': 1,
        'S': 2, 'N': 2, 'L': 2, 'U': 2, 'H': 2,
        'D': 3, 'G': 3, 'M': 3, 'W': 3, 'C': 3,
        'B': 4, 'P': 4, 'F': 4,
        'V': 5, 'K': 5, 'Y': 5,
        'J': 8, 'X': 8,
        'Q': 10, 'Z': 10,
    },

    // Dictionary will be loaded from JSON
    dictionary: new Set(),
    dictionaryLoaded: false,

    // Load dictionary from global variable (loaded via script tag)
    async loadDictionary() {
        try {
            if (typeof DICTIONARY_DATA !== 'undefined') {
                this.dictionary = new Set(DICTIONARY_DATA.words.map(w => w.toLowerCase()));
                this.dictionaryLoaded = true;
                console.log(`Dictionary loaded: ${this.dictionary.size} words`);
            } else {
                throw new Error('Dictionary data not found');
            }
        } catch (error) {
            console.error('Failed to load dictionary:', error);
            // Fallback minimal dictionary
            this.dictionary = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out']);
        }
    },

    isValidWord(word) {
        if (!word || word.length < 2) return false;
        return this.dictionary.has(word.toLowerCase());
    },

    getLetterValue(letter) {
        return this.letterValues[letter.toUpperCase()] || 1;
    },

    calculateBaseScore(word) {
        let score = 0;
        for (const letter of word.toUpperCase()) {
            score += this.getLetterValue(letter);
        }
        return score;
    },

    calculateWordScore(word, bonusInfo = {}) {
        let score = this.calculateBaseScore(word);
        let bonusMultiplier = 1.0;
        const bonuses = [];
        const penalties = [];

        // Apply bonuses
        if (bonusInfo.superpositionCount >= 3) {
            bonusMultiplier += 0.20;
            bonuses.push({ name: 'Superposition Mastery', bonus: '+20%' });
        }
        if (bonusInfo.hasEntangledPair) {
            bonusMultiplier += 0.30;
            bonuses.push({ name: 'Entanglement Bonus', bonus: '+30%' });
        }
        if (bonusInfo.allCleanCollapses) {
            bonusMultiplier += 0.10;
            bonuses.push({ name: 'Quantum Stability', bonus: '+10%' });
        }
        if (bonusInfo.usedPortal) {
            bonusMultiplier += 0.15;
            bonuses.push({ name: 'Chaotic Word', bonus: '+15%' });
        }
        if (word.length >= 7) {
            bonusMultiplier += 0.25;
            bonuses.push({ name: 'Long Word', bonus: '+25%' });
        } else if (word.length >= 5) {
            bonusMultiplier += 0.10;
            bonuses.push({ name: 'Good Length', bonus: '+10%' });
        }

        // Calculate score with multiplier first
        let finalScore = Math.round(score * bonusMultiplier);

        // Apply penalties (not affected by multiplier, per GDD)
        if (bonusInfo.brokenEntanglement) {
            finalScore -= 10;
            penalties.push({ name: 'Broken Entanglement', penalty: '-10' });
        }
        if (bonusInfo.invalidCollapseState) {
            finalScore -= 5;
            penalties.push({ name: 'Invalid Collapse', penalty: '-5' });
        }

        return {
            baseScore: score,
            finalScore: Math.max(0, finalScore), // Don't go negative
            bonusMultiplier,
            bonuses,
            penalties
        };
    },

    findWordsOnBoard(board, newTiles) {
        const words = [];
        const gridSize = 13;
        const letterGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

        for (const cell of board) {
            if (cell.tile && cell.tile.letter) {
                letterGrid[cell.row][cell.col] = cell.tile.letter;
            }
        }

        // Horizontal words
        for (let row = 0; row < gridSize; row++) {
            let wordStart = -1;
            let currentWord = '';
            for (let col = 0; col <= gridSize; col++) {
                const letter = col < gridSize ? letterGrid[row][col] : null;
                if (letter) {
                    if (wordStart === -1) wordStart = col;
                    currentWord += letter;
                } else {
                    if (currentWord.length >= 2) {
                        words.push({
                            word: currentWord,
                            startRow: row,
                            startCol: wordStart,
                            direction: 'horizontal',
                            cells: this.getWordCells(row, wordStart, currentWord.length, 'horizontal')
                        });
                    }
                    wordStart = -1;
                    currentWord = '';
                }
            }
        }

        // Vertical words
        for (let col = 0; col < gridSize; col++) {
            let wordStart = -1;
            let currentWord = '';
            for (let row = 0; row <= gridSize; row++) {
                const letter = row < gridSize ? letterGrid[row][col] : null;
                if (letter) {
                    if (wordStart === -1) wordStart = row;
                    currentWord += letter;
                } else {
                    if (currentWord.length >= 2) {
                        words.push({
                            word: currentWord,
                            startRow: wordStart,
                            startCol: col,
                            direction: 'vertical',
                            cells: this.getWordCells(wordStart, col, currentWord.length, 'vertical')
                        });
                    }
                    wordStart = -1;
                    currentWord = '';
                }
            }
        }
        return words;
    },

    getWordCells(startRow, startCol, length, direction) {
        const cells = [];
        for (let i = 0; i < length; i++) {
            cells.push(direction === 'horizontal'
                ? { row: startRow, col: startCol + i }
                : { row: startRow + i, col: startCol });
        }
        return cells;
    },

    validateNewWords(board, newTiles) {
        const words = this.findWordsOnBoard(board, newTiles);
        const validWords = [];
        const invalidWords = [];

        for (const wordInfo of words) {
            const includesNewTile = wordInfo.cells.some(cell =>
                newTiles.some(tile => tile.row === cell.row && tile.col === cell.col)
            );
            if (includesNewTile) {
                if (this.isValidWord(wordInfo.word)) {
                    validWords.push(wordInfo);
                } else {
                    invalidWords.push(wordInfo);
                }
            }
        }
        return { validWords, invalidWords };
    }
};
