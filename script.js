document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & Assets ---
    const width = 8;
    const tileImages = [
        'url("Seismic.jpg")',
        'url("Noxx.jpg")',
        'url("pk.jpg")',
        'url("sagar.jpg")',
        'url("bharat.jpg")',
        'url("naina.jpg")'
    ];
    
    // --- DOM Elements ---
    const boardContainer = document.getElementById('game-board');
    const scoreDisplay = document.getElementById('score-display');
    const movesDisplay = document.getElementById('moves-display');
    const levelDisplay = document.getElementById('level-display');
    const targetScoreDisplay = document.getElementById('target-score');
    const playerNameDisplay = document.getElementById('player-name-display');
    
    // Screens
    const homeScreen = document.getElementById('home-screen');
    const gameScreen = document.getElementById('game-screen');
    const usernameInput = document.getElementById('username-input');
    const startBtn = document.getElementById('start-btn');
    
    // Web3 Elements
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const sendTxBtn = document.getElementById('send-tx-btn');
    const walletStatus = document.getElementById('wallet-status');
    
    let provider;
    let signer;
    let userAddress;
    
    // Modals
    const modalOverlay = document.getElementById('modal-overlay');
    const settingsModal = document.getElementById('settings-modal');
    const levelCompleteModal = document.getElementById('level-complete-modal');
    const gameOverModal = document.getElementById('game-over-modal');
    
    // Buttons
    const settingsBtn = document.getElementById('settings-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const homeReturnBtn = document.getElementById('home-return-btn');
    const nextLevelBtn = document.getElementById('next-level-btn');
    const retryBtn = document.getElementById('retry-btn');
    const quitBtn = document.getElementById('quit-btn');
    
    // Game State
    let squares = [];
    let score = 0;
    let level = 1;
    let moves = 20;
    let targetScore = 100;
    let isProcessing = false;
    let draggedTile;
    let replacedTile;
    let dragStartX, dragStartY;
    
    // --- Web3 Integration ---
    const BASE_BUILDER_CODE = "bc_3xzi5e5s";
    
    // Hex encode the builder code
    function getEncodedBuilderCode() {
        if (typeof ethers !== 'undefined') {
            return ethers.hexlify(ethers.toUtf8Bytes(BASE_BUILDER_CODE));
        }
        return "0x";
    }

    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', async () => {
            if (typeof window.ethereum !== 'undefined') {
                try {
                    provider = new ethers.BrowserProvider(window.ethereum);
                    // Request account access
                    await provider.send("eth_requestAccounts", []);
                    
                    // Switch to Base Mainnet
                    try {
                        await provider.send('wallet_switchEthereumChain', [{ chainId: '0x2105' }]);
                    } catch (switchError) {
                        // This error code indicates that the chain has not been added to MetaMask.
                        if (switchError.code === 4902) {
                            try {
                                await provider.send('wallet_addEthereumChain', [
                                    {
                                        chainId: '0x2105',
                                        chainName: 'Base',
                                        rpcUrls: ['https://mainnet.base.org'],
                                        nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
                                        blockExplorerUrls: ['https://basescan.org']
                                    }
                                ]);
                            } catch (addError) {
                                console.error('Error adding Base network:', addError);
                            }
                        } else {
                            console.error('Error switching to Base network:', switchError);
                        }
                    }

                    signer = await provider.getSigner();
                    userAddress = await signer.getAddress();
                    
                    walletStatus.textContent = `Connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
                    walletStatus.style.color = "#4CAF50";
                    connectWalletBtn.classList.add('hidden');
                    sendTxBtn.classList.remove('hidden');
                    sendTxBtn.style.display = "block";
                    
                } catch (error) {
                    console.error("User denied account access or error occurred", error);
                    walletStatus.textContent = "Connection failed";
                    walletStatus.style.color = "#F44336";
                }
            } else {
                walletStatus.textContent = "Please install MetaMask or Coinbase Wallet";
            }
        });
    }

    if (sendTxBtn) {
        sendTxBtn.addEventListener('click', async () => {
            if (!signer) return;
            
            try {
                sendTxBtn.disabled = true;
                sendTxBtn.textContent = "Sending...";
                
                const dataHex = getEncodedBuilderCode();
                
                // Construct the transaction
                const tx = {
                    to: userAddress, // Send 0 ETH to themselves
                    value: 0,
                    data: dataHex // Append builder code
                };
                
                // Send the transaction
                const txResponse = await signer.sendTransaction(tx);
                walletStatus.textContent = `Tx Sent: ${txResponse.hash.substring(0, 8)}...`;
                
                // Wait for confirmation
                await txResponse.wait();
                walletStatus.textContent = "Transaction Confirmed!";
                
            } catch (error) {
                console.error("Transaction failed", error);
                walletStatus.textContent = "Transaction failed (Check Console)";
            } finally {
                sendTxBtn.disabled = false;
                sendTxBtn.textContent = "Send Test Tx (Base)";
            }
        });
    }

    // --- Initialization ---
    
    startBtn.addEventListener('click', () => {
        initAudio();
        const username = usernameInput.value.trim() || 'Guest';
        playerNameDisplay.textContent = username;
        homeScreen.classList.remove('active');
        gameScreen.classList.add('active');
        startGame();
    });

    function startGame() {
        level = 1;
        initLevel();
    }

    function initLevel() {
        score = 0;
        moves = 20 + Math.floor(level / 5) * 5; // Extra moves every 5 levels
        targetScore = 100 + (level - 1) * 150; // Scaling difficulty
        
        scoreDisplay.textContent = score;
        movesDisplay.textContent = moves;
        levelDisplay.textContent = level;
        targetScoreDisplay.textContent = targetScore;
        
        createBoard();
        isProcessing = false;
    }

    // --- Board Creation ---
    
    function createBoard() {
        boardContainer.innerHTML = '';
        squares = [];
        
        for (let i = 0; i < width * width; i++) {
            const tile = document.createElement('div');
            tile.setAttribute('draggable', true);
            tile.setAttribute('id', i);
            tile.classList.add('tile');
            
            // Random image, ensuring no initial matches
            let randomImg;
            do {
                randomImg = Math.floor(Math.random() * tileImages.length);
            } while (createsInitialMatch(i, tileImages[randomImg]));
            
            tile.style.backgroundImage = tileImages[randomImg];
            
            // Event Listeners for drag
            tile.addEventListener('dragstart', dragStart);
            tile.addEventListener('dragover', dragOver);
            tile.addEventListener('dragenter', dragEnter);
            tile.addEventListener('dragleave', dragLeave);
            tile.addEventListener('drop', dragDrop);
            tile.addEventListener('dragend', dragEnd);
            
            // Touch support
            tile.addEventListener('touchstart', touchStart, {passive: false});
            tile.addEventListener('touchmove', touchMove, {passive: false});
            tile.addEventListener('touchend', touchEnd, {passive: false});
            
            boardContainer.appendChild(tile);
            squares.push(tile);
        }
        
        // Ensure playable board
        if (!hasPossibleMoves()) {
            shuffleBoard();
        }
    }

    function createsInitialMatch(index, imgUrl) {
        // Check left 2
        if (index % width >= 2) {
            if (squares[index - 1].style.backgroundImage === imgUrl && 
                squares[index - 2].style.backgroundImage === imgUrl) {
                return true;
            }
        }
        // Check top 2
        if (index >= width * 2) {
            if (squares[index - width].style.backgroundImage === imgUrl && 
                squares[index - width * 2].style.backgroundImage === imgUrl) {
                return true;
            }
        }
        return false;
    }

    // --- Drag & Drop Interaction ---
    
    let colorDragged, colorReplaced;
    let squareIdDragged, squareIdReplaced;

    function dragStart() {
        if (isProcessing) return;
        initAudio();
        draggedTile = this;
        colorDragged = this.style.backgroundImage;
        squareIdDragged = parseInt(this.id);
    }
    
    function dragOver(e) { e.preventDefault(); }
    function dragEnter(e) { e.preventDefault(); }
    function dragLeave() {}
    
    function dragDrop() {
        if (isProcessing) return;
        replacedTile = this;
        colorReplaced = this.style.backgroundImage;
        squareIdReplaced = parseInt(this.id);
    }
    
    function dragEnd() {
        if (isProcessing || !replacedTile) return;
        
        // Valid moves are adjacent
        let validMoves = [
            squareIdDragged - 1,
            squareIdDragged + 1,
            squareIdDragged - width,
            squareIdDragged + width
        ];
        
        // Edge cases for wrapping
        if (squareIdDragged % width === 0) validMoves = validMoves.filter(m => m !== squareIdDragged - 1);
        if (squareIdDragged % width === width - 1) validMoves = validMoves.filter(m => m !== squareIdDragged + 1);
        
        let isValidMove = validMoves.includes(squareIdReplaced);
        
        if (squareIdReplaced !== undefined && isValidMove) {
            isProcessing = true;
            // Swap visuals
            draggedTile.style.backgroundImage = colorReplaced;
            replacedTile.style.backgroundImage = colorDragged;
            
            // Check for match
            setTimeout(() => {
                const matches = checkMatches();
                if (matches.indices.length > 0) {
                    moves--;
                    movesDisplay.textContent = moves;
                    processMatches(matches);
                } else {
                    // Revert swap
                    draggedTile.style.backgroundImage = colorDragged;
                    replacedTile.style.backgroundImage = colorReplaced;
                    isProcessing = false;
                }
            }, 200);
            
        }
        replacedTile = null;
    }

    // --- Touch Support ---
    function touchStart(e) {
        if (isProcessing) return;
        initAudio();
        // e.preventDefault();
        draggedTile = e.target;
        colorDragged = draggedTile.style.backgroundImage;
        squareIdDragged = parseInt(draggedTile.id);
        const touch = e.touches[0];
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
    }

    function touchMove(e) {
        if (isProcessing) return;
        e.preventDefault(); // Prevent scrolling while swiping tiles
    }

    function touchEnd(e) {
        if (isProcessing || !draggedTile) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;
        
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // Tap, not swipe
        
        let targetId = squareIdDragged;
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal swipe
            if (dx > 0 && squareIdDragged % width !== width - 1) targetId += 1;
            else if (dx < 0 && squareIdDragged % width !== 0) targetId -= 1;
        } else {
            // Vertical swipe
            if (dy > 0 && squareIdDragged < width * (width - 1)) targetId += width;
            else if (dy < 0 && squareIdDragged >= width) targetId -= width;
        }
        
        if (targetId !== squareIdDragged) {
            replacedTile = squares[targetId];
            colorReplaced = replacedTile.style.backgroundImage;
            squareIdReplaced = targetId;
            
            // Simulate dragEnd logic directly to avoid code duplication
            let validMoves = [
                squareIdDragged - 1,
                squareIdDragged + 1,
                squareIdDragged - width,
                squareIdDragged + width
            ];
            
            let isValidMove = validMoves.includes(squareIdReplaced);
            
            if (isValidMove) {
                isProcessing = true;
                draggedTile.style.backgroundImage = colorReplaced;
                replacedTile.style.backgroundImage = colorDragged;
                
                setTimeout(() => {
                    const matches = checkMatches();
                    if (matches.indices.length > 0) {
                        moves--;
                        movesDisplay.textContent = moves;
                        processMatches(matches);
                    } else {
                        // Revert
                        draggedTile.style.backgroundImage = colorDragged;
                        replacedTile.style.backgroundImage = colorReplaced;
                        isProcessing = false;
                    }
                }, 200);
            }
        }
        draggedTile = null;
        replacedTile = null;
    }

    // --- Game Logic ---
    
    function checkMatches() {
        let matchedIndices = new Set();
        let matchGroups = [];

        // Check rows
        for (let i = 0; i < 64; i++) {
            let row = [i, i+1, i+2];
            let decidedColor = squares[i].style.backgroundImage;
            const isBlank = decidedColor === '';
            const notValid = [6, 7, 14, 15, 22, 23, 30, 31, 38, 39, 46, 47, 54, 55, 62, 63];
            
            if (isBlank) continue;
            if (notValid.includes(i)) continue;
            
            let matchLength = 1;
            for(let j=1; j<width - (i%width); j++) {
                 if (squares[i+j].style.backgroundImage === decidedColor) {
                     matchLength++;
                 } else break;
            }
            
            if (matchLength >= 3) {
                let group = [];
                for(let j=0; j<matchLength; j++) {
                    matchedIndices.add(i+j);
                    group.push(i+j);
                }
                matchGroups.push(group);
            }
        }

        // Check columns
        for (let i = 0; i < 48; i++) {
            let decidedColor = squares[i].style.backgroundImage;
            const isBlank = decidedColor === '';
            
            if (isBlank) continue;
            
            let matchLength = 1;
            for(let j=1; j<width - Math.floor(i/width); j++) {
                 if (squares[i+j*width].style.backgroundImage === decidedColor) {
                     matchLength++;
                 } else break;
            }
            
            if (matchLength >= 3) {
                let group = [];
                for(let j=0; j<matchLength; j++) {
                    matchedIndices.add(i+j*width);
                    group.push(i+j*width);
                }
                matchGroups.push(group);
            }
        }
        
        return { indices: Array.from(matchedIndices), groups: matchGroups };
    }

    function processMatches(matchData) {
        if (!matchData || matchData.indices.length === 0) {
            // End of cascade cascade
            checkWinLoss();
            if (!isProcessing) return; // if game over/win triggered
            
            if (!hasPossibleMoves()) {
                shuffleBoard();
            } else {
                isProcessing = false;
            }
            return;
        }

        let pts = 0;
        let isComet = false;
        
        // Calculate Score & Special Effects
        matchData.groups.forEach(group => {
            if (group.length === 3) pts += 30;
            else if (group.length === 4) pts += 80; // 2x bonus-ish
            else if (group.length >= 5) {
                pts += 200;
                isComet = true;
            }
        });
        
        score += pts;
        scoreDisplay.textContent = score;
        
        playMatchSound(isComet);

        // Visual Blast
        matchData.indices.forEach(index => {
            squares[index].classList.add(isComet ? 'comet-blasting' : 'blasting');
            createSparkles(squares[index]);
        });

        setTimeout(() => {
            matchData.indices.forEach(index => {
                squares[index].style.backgroundImage = '';
                squares[index].classList.remove('blasting', 'comet-blasting');
            });
            moveDown();
        }, 300);
    }

    function moveDown() {
        // Simple gravity: pull down empty spaces
        let moved = false;
        for (let i = 55; i >= 0; i--) {
            if (squares[i + width].style.backgroundImage === '') {
                squares[i + width].style.backgroundImage = squares[i].style.backgroundImage;
                squares[i].style.backgroundImage = '';
                if(squares[i + width].style.backgroundImage !== '') moved = true;
            }
        }
        
        // Spawn top row
        for (let i = 0; i < width; i++) {
            if (squares[i].style.backgroundImage === '') {
                let randomImg = Math.floor(Math.random() * tileImages.length);
                squares[i].style.backgroundImage = tileImages[randomImg];
                moved = true;
            }
        }
        
        if (moved) {
            setTimeout(moveDown, 100);
        } else {
            // Finished moving, check again
            setTimeout(() => {
                const newMatches = checkMatches();
                processMatches(newMatches);
            }, 150);
        }
    }

    // --- Validation & Utility ---

    function hasPossibleMoves() {
        // Clone board to test
        for (let i = 0; i < 64; i++) {
            // Test right swap
            if (i % width < width - 1) {
                if (testSwap(i, i + 1)) return true;
            }
            // Test down swap
            if (i < 56) {
                if (testSwap(i, i + width)) return true;
            }
        }
        return false;
    }

    function testSwap(i, j) {
        let temp = squares[i].style.backgroundImage;
        squares[i].style.backgroundImage = squares[j].style.backgroundImage;
        squares[j].style.backgroundImage = temp;
        
        let hasMatch = checkMatches().indices.length > 0;
        
        // revert
        squares[j].style.backgroundImage = squares[i].style.backgroundImage;
        squares[i].style.backgroundImage = temp;
        
        return hasMatch;
    }

    function shuffleBoard() {
        // Simple shuffle: randomize images until no matches and has moves
        let valid = false;
        while (!valid) {
            let imgs = squares.map(s => s.style.backgroundImage);
            imgs.sort(() => Math.random() - 0.5);
            for(let i=0; i<64; i++) squares[i].style.backgroundImage = imgs[i];
            
            if (checkMatches().indices.length === 0 && hasPossibleMoves()) {
                valid = true;
            }
        }
    }

    function checkWinLoss() {
        if (score >= targetScore) {
            isProcessing = true;
            setTimeout(() => showLevelComplete(), 500);
        } else if (moves <= 0) {
            isProcessing = true;
            setTimeout(() => showGameOver(), 500);
        }
    }

    // --- UI Controls & Modals ---

    settingsBtn.addEventListener('click', () => {
        if (!isProcessing) {
            modalOverlay.classList.remove('hidden');
            settingsModal.classList.remove('hidden');
        }
    });

    resumeBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        settingsModal.classList.add('hidden');
    });

    homeReturnBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        settingsModal.classList.add('hidden');
        gameScreen.classList.remove('active');
        homeScreen.classList.add('active');
    });

    function showLevelComplete() {
        document.getElementById('final-score-win').textContent = score;
        modalOverlay.classList.remove('hidden');
        levelCompleteModal.classList.remove('hidden');
    }

    nextLevelBtn.addEventListener('click', () => {
        level++;
        if (level > 30) {
            // You beat the game!
            alert("Congratulations! You've beaten all 30 levels!");
            level = 1;
        }
        modalOverlay.classList.add('hidden');
        levelCompleteModal.classList.add('hidden');
        initLevel();
    });

    function showGameOver() {
        document.getElementById('failed-target').textContent = targetScore;
        modalOverlay.classList.remove('hidden');
        gameOverModal.classList.remove('hidden');
    }

    retryBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        gameOverModal.classList.add('hidden');
        initLevel(); // restart same level
    });

    quitBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        gameOverModal.classList.add('hidden');
        gameScreen.classList.remove('active');
        homeScreen.classList.add('active');
    });

    // --- Magic Sparkles ---
    function createSparkles(tile) {
        const tileRect = tile.getBoundingClientRect();
        const boardRect = boardContainer.getBoundingClientRect();
        
        // Create 3-5 sparkles per tile
        const numSparkles = 3 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < numSparkles; i++) {
            const sparkle = document.createElement('div');
            sparkle.classList.add('sparkle-star');
            
            const size = 15 + Math.random() * 20; // 15px to 35px
            sparkle.style.width = size + 'px';
            sparkle.style.height = size + 'px';
            
            // Random offset within the tile area
            const tileCenterX = tileRect.left - boardRect.left + (tileRect.width / 2);
            const tileCenterY = tileRect.top - boardRect.top + (tileRect.height / 2);
            
            const offsetX = (Math.random() - 0.5) * tileRect.width * 1.5;
            const offsetY = (Math.random() - 0.5) * tileRect.height * 1.5;
            
            sparkle.style.left = (tileCenterX + offsetX - size/2) + 'px';
            sparkle.style.top = (tileCenterY + offsetY - size/2) + 'px';
            
            // Random animation delay for staggered effect
            sparkle.style.animationDelay = (Math.random() * 0.2) + 's';
            
            boardContainer.appendChild(sparkle);
            
            // Remove after animation completes
            setTimeout(() => {
                if (sparkle.parentNode) {
                    sparkle.parentNode.removeChild(sparkle);
                }
            }, 600);
        }
    }

    // --- Audio System ---
    let audioCtx;
    
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } else if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playMatchSound(isComet) {
        if (!audioCtx) return;
        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            if (isComet) {
                // Triumphant cascade sound for 5+ matches
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.4);
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.6);
            } else {
                // Smooth sparkling chime for standard matches
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.4);
            }
        } catch(e) {
            console.warn("Audio error:", e);
        }
    }
});
