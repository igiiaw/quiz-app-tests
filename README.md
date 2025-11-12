# Quiz Master - Multiplayer Quiz Game

Real-time multiplayer quiz game where players can create or join rooms and compete against friends.

## Description

Quiz Master is a web-based multiplayer quiz application that allows players to compete in real-time. Players can create private rooms or join existing ones using a 6-digit code. The game features 10 questions per session with a 15-second timer for each question. Scores are calculated based on answer speed.

## Technologies

### Frontend
- HTML5
- CSS
- Bootstrap 5.3.0
- jQuery 3.6.0

### Backend
- Node.js
- Express.js 5.1.0
- Socket.IO 4.8.1

## Features

- Real-time multiplayer gameplay using WebSocket
- Private room system with unique codes
- 30-second timer per question
- Speed-based scoring system
- Multi-language support (English/Russian)
- Responsive design for all devices
- Animated loading screen
- Form validation with error notifications

## Installation

1. Install dependencies:
```text
npm install
```
2. Start the server:
```text
node server.js
```
3. Open browser:
```text
http://localhost:3000
```
## Project Structure

```text
quiz-master/
├── public/
│ ├── index.html # Main HTML file
│ ├── style.css # Custom styles
│ ├── client.js # Client-side logic
│ ├── translations.js # Language translations
├── questions.json # Quiz questions
├── server.js # Server and Socket.IO
├── package.json # Dependencies
└── README.md
```

## How to Play

1. Enter your name on the welcome screen
2. Create a new room or join an existing room with a code
3. Wait for other players to join
4. Host starts the game
5. Answer 10 questions within 15 seconds each
6. View final scores and winner

## Team Contributions

### Zhan
- Frontend development
- index.html implementation
- style.css design and animations

### Yessen
- Backend development
- server.js with Socket.IO integration
- questions.json database
- package.json configuration

### Madi
- Client-side logic
- client.js with jQuery
- translations.js for localization

## Architecture

The application uses a client-server architecture with WebSocket for real-time communication:

Client Browser <-> Socket.IO <-> Express Server

### Main Events
- createRoom: Host creates new game room
- joinRoom: Player joins existing room
- startGame: Host initiates quiz
- submitAnswer: Player submits answer
- gameOver: Display final results

## Dependencies
```text
{
"express": "^5.1.0",
"socket.io": "^4.8.1"
}
```