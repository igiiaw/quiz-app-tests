const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = new Map();

const questions = [
    {
        question: "What is the capital of France?",
        options: ["London", "Paris", "Berlin", "Madrid"],
        correct: 1
    },
    {
        question: "How many planets are in the Solar System?",
        options: ["7", "8", "9", "10"],
        correct: 1
    },
    {
        question: "Who wrote 'War and Peace'?",
        options: ["Dostoevsky", "Tolstoy", "Chekhov", "Pushkin"],
        correct: 1
    },
    {
        question: "Which element has the symbol 'O'?",
        options: ["Gold", "Oxygen", "Osmium", "Tin"],
        correct: 1
    },
    {
        question: "In what year was the October Revolution?",
        options: ["1905", "1914", "1917", "1922"],
        correct: 2
    },
    {
        question: "What is the largest planet in the Solar System?",
        options: ["Earth", "Saturn", "Jupiter", "Uranus"],
        correct: 2
    },
    {
        question: "How many continents are there on Earth?",
        options: ["5", "6", "7", "8"],
        correct: 2
    },
    {
        question: "Which ocean is the largest?",
        options: ["Atlantic", "Indian", "Pacific", "Arctic"],
        correct: 2
    },
    {
        question: "Who invented the light bulb?",
        options: ["Nikola Tesla", "Thomas Edison", "Alexander Bell", "Benjamin Franklin"],
        correct: 1
    },
    {
        question: "Which country gifted the Statue of Liberty to the USA?",
        options: ["England", "Germany", "France", "Spain"],
        correct: 2
    },
    {
        question: "How many days are in a leap year?",
        options: ["365", "366", "364", "367"],
        correct: 1
    },
    {
        question: "Which gas is essential for breathing?",
        options: ["Nitrogen", "Oxygen", "Carbon Dioxide", "Hydrogen"],
        correct: 1
    },
    {
        question: "What is the longest river in the world?",
        options: ["Nile", "Amazon", "Yangtze", "Mississippi"],
        correct: 0
    },
    {
        question: "How many strings does a standard guitar have?",
        options: ["4", "5", "6", "7"],
        correct: 2
    },
    {
        question: "What is the highest mountain in the world?",
        options: ["K2", "Everest", "Kangchenjunga", "Kilimanjaro"],
        correct: 1
    },
    {
        question: "In what year did World War II begin?",
        options: ["1937", "1939", "1941", "1945"],
        correct: 1
    },
    {
        question: "What is the lightest metal?",
        options: ["Aluminum", "Lithium", "Magnesium", "Titanium"],
        correct: 1
    },
    {
        question: "How many colors are in a rainbow?",
        options: ["5", "6", "7", "8"],
        correct: 2
    },
    {
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correct: 1
    },
    {
        question: "How many bones are in the adult human body?",
        options: ["186", "206", "226", "246"],
        correct: 1
    }
];

io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    socket.on('createRoom', (playerName) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            host: socket.id,
            players: new Map(),
            started: false,
            currentQuestion: 0,
            questionStartTime: null,
            answers: new Map()
        };
        
        room.players.set(socket.id, {
            id: socket.id,
            name: playerName,
            score: 0,
            isHost: true
        });

        rooms.set(roomCode, room);
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, playerName });
        updateRoomPlayers(roomCode);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (room.started) {
            socket.emit('error', 'Game already started');
            return;
        }

        room.players.set(socket.id, {
            id: socket.id,
            name: playerName,
            score: 0,
            isHost: false
        });

        socket.join(roomCode);
        socket.emit('roomJoined', { roomCode, playerName });
        updateRoomPlayers(roomCode);
    });

    socket.on('startGame', (roomCode) => {
        const room = rooms.get(roomCode);
        
        if (!room || room.host !== socket.id) {
            return;
        }

        if (room.players.size < 2) {
            socket.emit('error', 'Need at least 2 players');
            return;
        }

        room.started = true;
        room.currentQuestion = 0;
        io.to(roomCode).emit('gameStarted');
        
        setTimeout(() => {
            sendQuestion(roomCode);
        }, 1000);
    });

    socket.on('submitAnswer', ({ roomCode, answerIndex, timeElapsed }) => {
        const room = rooms.get(roomCode);
        
        if (!room || !room.started) {
            return;
        }

        const player = room.players.get(socket.id);
        if (!player || room.answers.has(socket.id)) {
            return;
        }

        const currentQ = questions[room.currentQuestion];
        const isCorrect = answerIndex === currentQ.correct;
        
        let points = 0;
        if (isCorrect) {
            const maxTime = 30000;
            const timeBonus = Math.max(0, maxTime - timeElapsed);
            points = Math.floor(500 + (timeBonus / maxTime) * 500);
        }

        player.score += points;
        room.answers.set(socket.id, {
            answerIndex,
            isCorrect,
            points,
            timeElapsed
        });

        if (room.answers.size === room.players.size) {
            setTimeout(() => {
                nextQuestion(roomCode);
            }, 2000);
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);
        
        rooms.forEach((room, roomCode) => {
            if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                
                if (room.host === socket.id) {
                    io.to(roomCode).emit('hostLeft');
                    rooms.delete(roomCode);
                } else {
                    updateRoomPlayers(roomCode);
                }
            }
        });
    });
});

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function updateRoomPlayers(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const playerList = Array.from(room.players.values());
    io.to(roomCode).emit('playersUpdate', playerList);
}

function sendQuestion(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const question = questions[room.currentQuestion];
    room.questionStartTime = Date.now();
    room.answers.clear();

    io.to(roomCode).emit('question', {
        questionNumber: room.currentQuestion + 1,
        totalQuestions: questions.length,
        question: question.question,
        options: question.options
    });

    setTimeout(() => {
        if (room.started && room.answers.size < room.players.size) {
            nextQuestion(roomCode);
        }
    }, 30000);
}

function nextQuestion(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const currentQ = questions[room.currentQuestion];
    
    io.to(roomCode).emit('showCorrectAnswer', {
        correctAnswer: currentQ.correct,
        correctText: currentQ.options[currentQ.correct]
    });

    setTimeout(() => {
        room.currentQuestion++;

        if (room.currentQuestion < questions.length) {
            sendQuestion(roomCode);
        } else {
            endGame(roomCode);
        }
    }, 3000);
}

function endGame(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const finalResults = Array.from(room.players.values())
        .map(player => ({
            name: player.name,
            score: player.score
        }))
        .sort((a, b) => b.score - a.score);

    io.to(roomCode).emit('gameEnd', finalResults);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
