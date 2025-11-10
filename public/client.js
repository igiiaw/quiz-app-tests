const socket = io();

let currentRoom = null;
let playerName = null;
let isHost = false;
let questionStartTime = null;
let timerInterval = null;
let myScore = 0;

function showPage(pageNumber) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`page${pageNumber}`).classList.add('active');
}

function showError(message) {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
    setTimeout(() => {
        errorMsg.classList.add('hidden');
    }, 3000);
}

function showCreateRoom() {
    const nameInput = document.getElementById('playerName');
    playerName = nameInput.value.trim();
    
    if (!playerName) {
        showError('Please enter your name');
        return;
    }
    
    isHost = true;
    socket.emit('createRoom', playerName);
}

function showJoinRoom() {
    document.getElementById('joinRoomForm').classList.remove('hidden');
}

function joinRoom() {
    const nameInput = document.getElementById('playerName');
    const codeInput = document.getElementById('roomCodeInput');
    
    playerName = nameInput.value.trim();
    const roomCode = codeInput.value.trim().toUpperCase();
    
    if (!playerName) {
        showError('Enter your name');
        return;
    }
    
    if (!roomCode || roomCode.length !== 6) {
        showError('Enter valid room code (6 characters)');
        return;
    }
    
    socket.emit('joinRoom', { roomCode, playerName });
}

function startGame() {
    socket.emit('startGame', currentRoom);
}

function selectOption(index) {
    const options = document.querySelectorAll('.option');
    
    if (options[0].classList.contains('disabled')) {
        return;
    }
    
    options.forEach(opt => {
        opt.classList.add('disabled');
        opt.classList.remove('selected');
    });
    
    options[index].classList.add('selected');
    
    const timeElapsed = Date.now() - questionStartTime;
    socket.emit('submitAnswer', {
        roomCode: currentRoom,
        answerIndex: index,
        timeElapsed
    });
}

function startQuestionTimer() {
    let timeLeft = 30;
    const timerEl = document.getElementById('timer');
    timerEl.classList.remove('warning');
    
    clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        
        if (timeLeft <= 10) {
            timerEl.classList.add('warning');
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            document.querySelectorAll('.option').forEach(opt => {
                opt.classList.add('disabled');
            });
        }
    }, 1000);
}

socket.on('roomCreated', ({ roomCode }) => {
    currentRoom = roomCode;
    document.getElementById('roomCodeDisplay').textContent = roomCode;
    document.getElementById('startGameBtn').classList.remove('hidden');
    document.getElementById('waitingMessage').classList.add('hidden');
    showPage(2);
});

socket.on('roomJoined', ({ roomCode }) => {
    currentRoom = roomCode;
    document.getElementById('roomCodeDisplay').textContent = roomCode;
    showPage(2);
});

socket.on('playersUpdate', (players) => {
    const playersList = document.getElementById('playersList');
    const playerCount = document.getElementById('playerCount');
    
    playerCount.textContent = players.length;
    playersList.innerHTML = '';
    
    players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        if (player.isHost) {
            card.classList.add('host');
        }
        
        card.innerHTML = `
            <span>${player.name}</span>
        `;
        
        playersList.appendChild(card);
    });
});

socket.on('gameStarted', () => {
    showPage(3);
});

socket.on('question', (data) => {
    showPage(3);
    
    const progress = (data.questionNumber / data.totalQuestions) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
    
    document.getElementById('questionCounter').textContent = 
        `Question ${data.questionNumber}/${data.totalQuestions}`;
    
    document.getElementById('questionText').textContent = data.question;
    
    const optionsGrid = document.getElementById('optionsGrid');
    optionsGrid.innerHTML = '';
    
    data.options.forEach((option, index) => {
        const div = document.createElement('div');
        div.className = 'option';
        div.textContent = option;
        div.onclick = () => selectOption(index);
        optionsGrid.appendChild(div);
    });
    
    document.getElementById('currentScore').textContent = myScore;
    
    questionStartTime = Date.now();
    document.getElementById('timer').textContent = '30';
    startQuestionTimer();
});

socket.on('showCorrectAnswer', (data) => {
    clearInterval(timerInterval);
    
    const options = document.querySelectorAll('.option');
    options.forEach((opt, index) => {
        opt.classList.add('disabled');
        
        if (index === data.correctAnswer) {
            opt.classList.add('correct');
        } else if (opt.classList.contains('selected')) {
            opt.classList.add('incorrect');
        }
    });
    
    if (options[data.correctAnswer].classList.contains('selected')) {
        const timeElapsed = Date.now() - questionStartTime;
        const maxTime = 30000;
        const timeBonus = Math.max(0, maxTime - timeElapsed);
        const points = Math.floor(500 + (timeBonus / maxTime) * 500);
        myScore += points;
        document.getElementById('currentScore').textContent = myScore;
    }
});

socket.on('gameEnd', (results) => {
    clearInterval(timerInterval);
    showPage(4);
    
    const places = ['place1', 'place2', 'place3'];
    results.slice(0, 3).forEach((player, index) => {
        const placeEl = document.getElementById(places[index]);
        placeEl.querySelector('.player-name').textContent = player.name;
        placeEl.querySelector('.player-score').textContent = `${player.score} points`;
    });
    
    for (let i = results.length; i < 3; i++) {
        const placeEl = document.getElementById(places[i]);
        placeEl.querySelector('.player-name').textContent = '---';
        placeEl.querySelector('.player-score').textContent = '0 points';
    }
    
    const fullResultsList = document.getElementById('fullResultsList');
    fullResultsList.innerHTML = '';
    
    results.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'result-item';
        if (index < 3) {
            div.classList.add('top-three');
        }
        
        div.innerHTML = `
            <span>${index + 1}. ${player.name}</span>
            <span>${player.score} points</span>
        `;
        
        fullResultsList.appendChild(div);
    });
});

socket.on('error', (message) => {
    showError(message);
});

socket.on('hostLeft', () => {
    alert('Host left the game. Room closed.');
    location.reload();
});
