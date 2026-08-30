const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function createRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function sendParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  io.to(roomId).emit("participants", Array.from(room.users.values()));
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ room, name, create }) => {
    name = String(name || "Khách").trim().substring(0, 40);

    if (create === true) {
      room = createRoomId();
      rooms.set(room, {
        host: socket.id,
        locked: false,
        pinnedForAll: true,
        users: new Map()
      });
      console.log("Room created:", room);
    }

    room = String(room || "").trim().toUpperCase();
    const currentRoom = rooms.get(room);

    if (!currentRoom) {
      socket.emit("room-error", { message: "Không tìm thấy phòng." });
      return;
    }

    if (currentRoom.locked && currentRoom.host !== socket.id) {
      socket.emit("room-locked", { message: "Phòng đang bị khóa." });
      return;
    }

    const user = {
      id: socket.id,
      name: name || "Khách",
      isHost: currentRoom.host === socket.id,
      micEnabled: true,
      cameraEnabled: true,
      micLocked: false,
      cameraLocked: false
    };

    currentRoom.users.set(socket.id, user);
    socket.data.room = room;
    socket.data.name = user.name;
    socket.join(room);

    socket.emit("room-joined", {
      room: room,
      isHost: user.isHost,
      pinnedForAll: currentRoom.pinnedForAll
    });

    socket.to(room).emit("user-joined", user);
    sendParticipants(room);
    console.log(`${user.name} joined ${room}`);
  });

  socket.on("signal", ({ to, data }) => {
    if (!to) return;
    io.to(to).emit("signal", { from: socket.id, data: data });
  });

  socket.on("chat", ({ text }) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const user = room.users.get(socket.id);
    if (!user) return;

    text = String(text || "").trim().substring(0, 500);
    if (!text) return;

    io.to(socket.data.room).emit("chat", { name: user.name, text: text });
  });

  socket.on("host-toggle-pin", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== socket.id) return;

    room.pinnedForAll = !room.pinnedForAll;
    io.to(socket.data.room).emit("host-pin-changed", {
      pinned: room.pinnedForAll,
      hostId: room.host
    });
  });

  socket.on("host-mute-user", ({ userId }) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== socket.id) return;
    const user = room.users.get(userId);
    if (!user) return;

    user.micEnabled = false;
    user.micLocked = true;
    io.to(userId).emit("force-mute", { locked: true });
    sendParticipants(socket.data.room);
  });

  socket.on("host-camera-off", ({ userId }) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== socket.id) return;
    const user = room.users.get(userId);
    if (!user) return;

    user.cameraEnabled = false;
    user.cameraLocked = true;
    io.to(userId).emit("force-camera-off", { locked: true });
    sendParticipants(socket.data.room);
  });

  socket.on("host-mute-all", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== socket.id) return;

    room.users.forEach((user) => {
      if (user.id === socket.id) return;
      user.micEnabled = false;
      user.micLocked = true;
      io.to(user.id).emit("force-mute", { locked: true });
    });
    sendParticipants(socket.data.room);
  });

  socket.on("host-camera-off-all", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== socket.id) return;

    room.users.forEach((user) => {
      if (user.id === socket.id) return;
      user.cameraEnabled = false;
      user.cameraLocked = true;
      io.to(user.id).emit("force-camera-off", { locked: true });
    });
    sendParticipants(socket.data.room);
  });

  socket.on("host-unlock-all-mic", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== socket.id) return;

    room.users.forEach((user) => {
      user.micLocked = false;
      io.to(user.id).emit("unlock-mic");
    });
    sendParticipants(socket.data.room);
  });

  socket.on("host-unlock-all-camera", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== socket.id) return;

    room.users.forEach((user) => {
      user.cameraLocked = false;
      io.to(user.id).emit("unlock-camera");
    });
    sendParticipants(socket.data.room);
  });

  socket.on("host-remove-user", ({ userId }) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== socket.id || userId === socket.id) return;

    room.users.delete(userId);
    const target = io.sockets.sockets.get(userId);
    if (target) {
      target.leave(socket.data.room);
      target.data.room = null;
      target.emit("removed-from-room");
    }
    sendParticipants(socket.data.room);
  });

  socket.on("host-toggle-lock", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== socket.id) return;

    room.locked = !room.locked;
    io.to(socket.data.room).emit("room-lock-changed", { locked: room.locked });
  });

  socket.on("end-meeting", () => {
    const roomId = socket.data.room;
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;

    io.to(roomId).emit("meeting-ended");
    rooms.delete(roomId);
    console.log("Meeting ended:", roomId);
  });

  socket.on("leave-room", () => {
    leaveRoom(socket);
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
    console.log("User disconnected:", socket.id);
  });
});

function leaveRoom(socket) {
  const roomId = socket.data.room;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) {
    socket.data.room = null;
    return;
  }

  if (room.host === socket.id) {
    io.to(roomId).emit("meeting-ended");
    rooms.delete(roomId);
    socket.data.room = null;
    return;
  }

  room.users.delete(socket.id);
  socket.leave(roomId);
  io.to(roomId).emit("user-left", { id: socket.id });
  sendParticipants(roomId);
  socket.data.room = null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`VMeet server running on port ${PORT}`);
});
