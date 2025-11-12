const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

app.use(express.static('public'));

const rooms = new Map();
let questions = [];

// load questions from json file
fs.readFile(path.join(__dirname, 'questions.json'), 'utf8', (err, data) => {
    if (err) {
        console.error('Error loading questions:', err);
        return;
    }
    questions = JSON.parse(data);
    console.log(`Loaded ${questions.length} questions`);
});

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // create new room
    socket.on('createRoom', (playerName) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            host: socket.id,
            players: [{ id: socket.id, name: playerName, score: 0 }],
            gameStarted: false,
            currentQuestion: 0,
            answers: new Map(),
            questionTimeout: null
        };
        
        rooms.set(roomCode, room);
        socket.join(roomCode);
        
        socket.emit('roomCreated', {
            roomCode: roomCode,
            players: room.players
        });
    });

    // join existing room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }
        
        if (room.gameStarted) {
            socket.emit('error', 'Game already started');
            return;
        }
        
        room.players.push({ id: socket.id, name: playerName, score: 0 });
        socket.join(roomCode);
        
        socket.emit('roomJoined', {
            roomCode: roomCode,
            players: room.players
        });
        
        io.to(roomCode).emit('updatePlayers', room.players);
    });

    // start game
    socket.on('startGame', (roomCode) => {
        const room = rooms.get(roomCode);
        
        if (!room || room.host !== socket.id) {
            return;
        }
        
        room.gameStarted = true;
        room.currentQuestion = 0;
        
        io.to(roomCode).emit('gameStarted', {
            totalQuestions: questions.length
        });
        
        setTimeout(() => sendQuestion(roomCode), 1000);
    });

    // player submitted answer
    socket.on('submitAnswer', ({ room: roomCode, answer, timeSpent }) => {
        const room = rooms.get(roomCode);
        if (!room) return;
        
        if (!room.answers.has(room.currentQuestion)) {
            room.answers.set(room.currentQuestion, new Map());
        }
        
        // prevent double submission
        if (room.answers.get(room.currentQuestion).has(socket.id)) {
            return;
        }
        
        const currentQ = questions[room.currentQuestion];
        const correct = answer === currentQ.correct;
        
        // calculate points
        let points = 0;
        if (correct && answer !== -1) {
            const timeBonus = Math.max(0, 15 - Math.floor(timeSpent / 1000));
            points = 10 + timeBonus;
            
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.score += points;
            }
        }
        
        socket.emit('answerResult', {
            correct: correct,
            correctAnswer: currentQ.correct,
            playerAnswer: answer,
            points: points
        });
        
        room.answers.get(room.currentQuestion).set(socket.id, answer);
        
        // all players answered, move to next question
        if (room.answers.get(room.currentQuestion).size === room.players.length) {
            if (room.questionTimeout) {
                clearTimeout(room.questionTimeout);
            }
            
            setTimeout(() => {
                room.currentQuestion++;
                if (room.currentQuestion < questions.length) {
                    sendQuestion(roomCode);
                } else {
                    endGame(roomCode);
                }
            }, 3000);
        }
    });

    // player disconnected
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        rooms.forEach((room, code) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    if (room.questionTimeout) {
                        clearTimeout(room.questionTimeout);
                    }
                    rooms.delete(code);
                } else {
                    if (room.host === socket.id) {
                        room.host = room.players[0].id;
                    }
                    io.to(code).emit('updatePlayers', room.players);
                }
            }
        });
    });
});

function sendQuestion(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const question = questions[room.currentQuestion];
    
    io.to(roomCode).emit('newQuestion', {
        questionNumber: room.currentQuestion + 1,
        totalQuestions: questions.length,
        question: question.question,
        options: question.options
    });
    
    // timeout if no one answers
    room.questionTimeout = setTimeout(() => {
        room.players.forEach(player => {
            if (!room.answers.has(room.currentQuestion) || 
                !room.answers.get(room.currentQuestion).has(player.id)) {
                
                const currentQ = questions[room.currentQuestion];
                io.to(player.id).emit('answerResult', {
                    correct: false,
                    correctAnswer: currentQ.correct,
                    playerAnswer: -1,
                    points: 0
                });
                
                if (!room.answers.has(room.currentQuestion)) {
                    room.answers.set(room.currentQuestion, new Map());
                }
                room.answers.get(room.currentQuestion).set(player.id, -1);
            }
        });
        
        setTimeout(() => {
            room.currentQuestion++;
            if (room.currentQuestion < questions.length) {
                sendQuestion(roomCode);
            } else {
                endGame(roomCode);
            }
        }, 3000);
    }, 15000);
}

function endGame(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    if (room.questionTimeout) {
        clearTimeout(room.questionTimeout);
    }
    
    // sort players by score
    const results = room.players
        .sort((a, b) => b.score - a.score)
        .map(p => ({ name: p.name, score: p.score }));
    
    io.to(roomCode).emit('gameEnded', results);
    
    // delete room after 1 minute
    setTimeout(() => {
        rooms.delete(roomCode);
    }, 60000);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});