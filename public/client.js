const socket = io();
let currentRoom = null;
let playerName = null;
let isHost = false;
let questionStartTime = null;
let timerInterval = null;
let myScore = 0;
let currentLang = 'en';
let answerSubmitted = false;

$(document).ready(function() {
    // hide loading screen after 1 sec
    setTimeout(() => {
        $('#preloader').addClass('hidden');
    }, 1000);
    
    loadLanguage();
});

function showPage(pageNumber) {
    $('.page').removeClass('active');
    $(`#page${pageNumber}`).addClass('active');
}

function showError(message) {
    $('#errorMsg').text(message).removeClass('hidden');
    setTimeout(() => {
        $('#errorMsg').addClass('hidden');
    }, 3000);
}

function showCreateRoom() {
    playerName = $('#playerName').val().trim();
    if (!playerName) {
        showError(translations[currentLang].enterNameError);
        return;
    }
    isHost = true;
    socket.emit('createRoom', playerName);
}

function showJoinRoom() {
    $('#joinRoomForm').removeClass('hidden');
}

function joinRoom() {
    playerName = $('#playerName').val().trim();
    const roomCode = $('#roomCodeInput').val().trim();
    
    if (!playerName) {
        showError(translations[currentLang].enterNameError);
        return;
    }
    
    if (!roomCode) {
        showError(translations[currentLang].enterRoomCodeError);
        return;
    }
    
    socket.emit('joinRoom', { roomCode, playerName });
}

function startGame() {
    socket.emit('startGame', currentRoom);
}

function selectAnswer(optionIndex) {
    if (answerSubmitted) return;
    
    answerSubmitted = true;
    const timeSpent = Date.now() - questionStartTime;
    socket.emit('submitAnswer', {
        room: currentRoom,
        answer: optionIndex,
        timeSpent: timeSpent
    });
    
    $('.option-btn').prop('disabled', true);
}

function updateTimer(seconds) {
    $('#timer').text(seconds);
    if (seconds <= 5) {
        $('#timer').addClass('warning');
    } else {
        $('#timer').removeClass('warning');
    }
}

// room created by host
socket.on('roomCreated', (data) => {
    currentRoom = data.roomCode;
    $('#roomCode').text(data.roomCode);
    showPage(2);
    updatePlayersList(data.players);
    if (isHost) {
        $('#hostControls').show();
    }
});

// player joined room
socket.on('roomJoined', (data) => {
    currentRoom = data.roomCode;
    $('#roomCode').text(data.roomCode);
    showPage(2);
    updatePlayersList(data.players);
    $('#hostControls').hide();
});

socket.on('updatePlayers', (players) => {
    updatePlayersList(players);
});

function updatePlayersList(players) {
    const list = $('#playersList');
    list.empty();
    players.forEach(player => {
        list.append(`<li class="list-group-item">${player.name}</li>`);
    });
}

// game started
socket.on('gameStarted', (data) => {
    showPage(3);
    $('#totalQuestions').text(data.totalQuestions);
});

// new question received
socket.on('newQuestion', (data) => {
    answerSubmitted = false;
    questionStartTime = Date.now();
    $('#questionNumber').text(data.questionNumber);
    $('#questionText').text(data.question);
    
    // create option buttons
    const optionsContainer = $('#optionsContainer');
    optionsContainer.empty();
    
    data.options.forEach((option, index) => {
        optionsContainer.append(`
            <div class="col-md-6">
                <button class="option-btn" onclick="selectAnswer(${index})" aria-label="Option ${index + 1}">
                    ${option}
                </button>
            </div>
        `);
    });
    
    // start countdown
    let timeLeft = 15;
    updateTimer(timeLeft);
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimer(timeLeft);
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
    
    // update progress bar
    const progress = (data.questionNumber / data.totalQuestions) * 100;
    $('#progressBar').css('width', progress + '%').attr('aria-valuenow', progress);
});

// answer result received
socket.on('answerResult', (data) => {
    clearInterval(timerInterval);
    
    // show correct/wrong answers
    $('.option-btn').each(function(index) {
        $(this).prop('disabled', true);
        if (index === data.correctAnswer) {
            $(this).addClass('correct');
        } else if (index === data.playerAnswer && data.playerAnswer !== -1 && !data.correct) {
            $(this).addClass('wrong');
        }
    });
    
    // update score
    if (data.correct) {
        myScore += data.points;
        $('#myScore').text(myScore);
    }
});

// game ended
socket.on('gameEnded', (results) => {
    showPage(4);
    const tbody = $('#resultsTable');
    tbody.empty();
    
    results.forEach((player, index) => {
        tbody.append(`
            <tr>
                <td>${index + 1}</td>
                <td>${player.name}</td>
                <td>${player.score}</td>
            </tr>
        `);
    });
});

socket.on('error', (message) => {
    showError(message);
});

// language switching
function switchLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    
    $('.lang-btn').removeClass('active');
    $(`#btn-${lang}`).addClass('active');
    
    loadLanguage();
}

function loadLanguage() {
    const savedLang = localStorage.getItem('language');
    if (savedLang) {
        currentLang = savedLang;
        $('.lang-btn').removeClass('active');
        $(`#btn-${savedLang}`).addClass('active');
    }
    
    // apply translations
    $('[data-i18n]').each(function() {
        const key = $(this).data('i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            $(this).text(translations[currentLang][key]);
        }
    });
}
