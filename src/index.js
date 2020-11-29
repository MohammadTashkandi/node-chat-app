const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
// express automatically creates the server for us but we have to manually create the server so that we can supply it to socketio.
const io = socketio(server)

// Define paths and variables
const port = process.env.PORT || 5000
const publicDirectoryPath = path.join(__dirname, '../public')
// let count = 0

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
    
    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('Admin', 'Hello, welcome to the chat app'))
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined the room`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (userMsg, callback) => {
        const filter = new Filter()
        if (filter.isProfane(userMsg)) {
            return callback('Profanity isnt allowed!')
        }

        const user = getUser(socket.id)

        if (!user) {
            return callback('User was not found')
        }

        io.to(user.room).emit('message', generateMessage(user.username, userMsg))
        callback()
    })

    socket.on('sendLocation', (location, callback) => {
        const user = getUser(socket.id)

        if (!user) {
            return callback('User was not found')
        }

        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${location.latitude},${location.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left the chat`)) // Here we don't have to user broadcast as the user has already left and wont see the msg
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })

    // socket.emit('countUpdated', count) This line emits an event to only this connection
    //     io.emit('countUpdated', count)
    // however, when called with io, the event will be emitted to all connetions
})


server.listen(port, () => {
    console.log('Server is up and running on port '+port)
})

// socket.emit emits only to this particular connection (i.e. one user)
// io.emit emits to all connections including current connection
// socket.broadcast.emit emits to all connections except current connection

// With the introduction of rooms we have two extra ways of sending messages
// io.to(room).emit emits to everyone in a specific room
// socket.broadcast.to(room).emit emites to everyone in a specific room except current user/connection