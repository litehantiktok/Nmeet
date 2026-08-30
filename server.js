const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  socket.on("join-room", ({ room, name }) => {
    socket.join(room);
    socket.data.room = room;
    socket.data.name = name || "Khách";
    socket.to(room).emit("user-joined", { id: socket.id, name: socket.data.name });

    const roomSockets = io.sockets.adapter.rooms.get(room) || new Set();
    const users = [...roomSockets]
      .filter(id => id !== socket.id)
      .map(id => ({ id, name: io.sockets.sockets.get(id)?.data.name || "Khách" }));
    socket.emit("existing-users", users);
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("chat", ({ room, name, text }) => {
    if (!text?.trim()) return;
    io.to(room).emit("chat", { name: name || "Khách", text: text.trim() });
  });

  socket.on("disconnect", () => {
    if (socket.data.room) {
      socket.to(socket.data.room).emit("user-left", { id: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`VMeet running at http://localhost:${PORT}`));