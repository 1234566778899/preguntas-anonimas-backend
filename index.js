const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: ['http://localhost:3000', 'https://preguntas-anonimas.vercel.app'],
        credentials: true
    }
});
const port = process.env.PORT || 4000;
let salas = new Map();
io.on('connection', (socket) => {
    socket.on('unirse', (code) => {
        io.emit('validar', { valid: salas.has(code), code });
    });
    socket.on('crear-sala', (data) => {
        salas.set(data, {
            users: [],
            enJuego: false
        })
        const newSocket = io.of(data);
        newSocket.on('connection', (socketSala) => {
            const sala = salas.get(data);

            socketSala.on('enviar-nombre', name => {
                if (sala && sala.users) {
                    if (sala.enJuego) {
                        socketSala.emit('esperar');
                    } else {
                        sala.users.push({
                            id: socketSala.id,
                            name: name
                        })
                        newSocket.emit('lista-usuarios', sala.users);
                    }
                }
            })

            socketSala.on('disconnect', () => {
                if (sala && sala.users) {
                    sala.users = sala.users.filter(x => x.id != socketSala.id);
                    newSocket.emit('lista-usuarios', sala.users);
                    if (sala.users.length === 0) {
                        salas.delete(data);
                    }
                }
            })

            socketSala.on('empezar', () => {
                sala.enJuego = true;
                newSocket.emit('empezar');
            })

            socketSala.on('enviar-pregunta', (pregunta) => {
                let user = sala.users.find(x => x.id == socketSala.id);
                user.pregunta = pregunta;
                for (let u of sala.users) {
                    if (!u.pregunta || u.pregunta.trim() == "") return;
                }
                newSocket.emit('responder-preguntas', sala.users);
            })

            socketSala.on('enviar-respuestas', data => {
                let user = sala.users.find(x => x.id == socketSala.id);
                user.results = data;
                for (let u of sala.users) {
                    if (!u.results || u.results.length <= 0) return;
                }
                newSocket.emit('resultados', sala.users);
            })

            socketSala.on('reiniciar', () => {
                if (sala && sala.users) {
                    for (let user of sala.users) {
                        user.results = [];
                        user.pregunta = '';
                    }
                    sala.enJuego = false;
                    newSocket.emit('reiniciar');
                }

            })
        })
    })
})
app.get('/', (req, res) => {
    res.send('v1.0.4');
})
server.listen(port, () => {
    console.log('server running on port:  ' + port);
});