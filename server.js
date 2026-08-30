const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ===============================
// STATIC FILES
// ===============================

app.use(express.static(path.join(__dirname, "public")));

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===============================
// ROOMS
// ===============================

const rooms = new Map();

// ===============================
// CREATE ROOM ID
// ===============================

function createRoomId() {
  let id;

  do {
    id = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  } while (rooms.has(id));

  return id;
}

// ===============================
// SEND PARTICIPANTS
// ===============================

function sendParticipants(roomId) {
  const room = rooms.get(roomId);

  if (!room) return;

  io.to(roomId).emit(
    "participants",
    Array.from(room.users.values())
  );
}

// ===============================
// GET ROOM
// ===============================

function getRoom(socket) {
  const roomId = socket.data.room;

  if (!roomId) return null;

  return rooms.get(roomId) || null;
}

// ===============================
// LEAVE ROOM
// ===============================

function leaveRoom(socket, notifyOthers = true) {
  const roomId = socket.data.room;

  if (!roomId) return;

  const room = rooms.get(roomId);

  if (!room) {
    socket.data.room = null;
    return;
  }

  // Chủ phòng rời -> kết thúc phòng
  if (room.host === socket.id) {
    io.to(roomId).emit("meeting-ended");

    rooms.delete(roomId);

    socket.leave(roomId);
    socket.data.room = null;

    console.log("Room ended:", roomId);

    return;
  }

  room.users.delete(socket.id);

  socket.leave(roomId);

  if (notifyOthers) {
    socket.to(roomId).emit("user-left", {
      id: socket.id
    });
  }

  sendParticipants(roomId);

  socket.data.room = null;

  console.log(
    `${socket.data.name || "User"} left room ${roomId}`
  );
}

// ===============================
// SOCKET.IO
// ===============================

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // =============================
  // JOIN / CREATE ROOM
  // =============================

  socket.on("join-room", (payload = {}) => {
    let {
      room,
      name,
      create
    } = payload;

    name = String(name || "Khách")
      .trim()
      .substring(0, 40);

    // -----------------------------
    // CREATE NEW ROOM
    // -----------------------------

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

    room = String(room || "")
      .trim()
      .toUpperCase();

    // -----------------------------
    // CHECK ROOM
    // -----------------------------

    const currentRoom = rooms.get(room);

    if (!currentRoom) {
      socket.emit("room-error", {
        message: "Không tìm thấy phòng."
      });

      return;
    }

    // -----------------------------
    // LOCKED ROOM
    // -----------------------------

    if (
      currentRoom.locked &&
      currentRoom.host !== socket.id
    ) {
      socket.emit("room-locked", {
        message: "Phòng đang bị khóa."
      });

      return;
    }

    // -----------------------------
    // LEAVE OLD ROOM
    // -----------------------------

    if (
      socket.data.room &&
      socket.data.room !== room
    ) {
      leaveRoom(socket, false);
    }

    // -----------------------------
    // USER
    // -----------------------------

    const user = {
      id: socket.id,
      name: name || "Khách",

      isHost:
        currentRoom.host === socket.id,

      micEnabled: true,
      cameraEnabled: true,

      micLocked: false,
      cameraLocked: false
    };

    currentRoom.users.set(
      socket.id,
      user
    );

    socket.data.room = room;
    socket.data.name = user.name;

    socket.join(room);

    // -----------------------------
    // JOINED
    // -----------------------------

    socket.emit("room-joined", {
      room,
      isHost: user.isHost,
      pinnedForAll:
        currentRoom.pinnedForAll,
      hostId:
        currentRoom.host
    });

    // -----------------------------
    // TELL OTHERS
    // -----------------------------

    socket.to(room).emit(
      "user-joined",
      user
    );

    // -----------------------------
    // PARTICIPANTS
    // -----------------------------

    sendParticipants(room);

    console.log(
      `${user.name} joined ${room}`
    );
  });

  // =============================
  // WEBRTC SIGNAL
  // =============================

  socket.on(
    "signal",
    ({ to, data } = {}) => {
      if (!to || !data) return;

      const room = getRoom(socket);

      if (!room) return;

      const target =
        io.sockets.sockets.get(to);

      if (!target) return;

      // Không cho signal khác phòng
      if (
        target.data.room !==
        socket.data.room
      ) {
        return;
      }

      io.to(to).emit("signal", {
        from: socket.id,
        data
      });
    }
  );

  // =============================
  // CHAT
  // =============================

  socket.on(
    "chat",
    ({ text } = {}) => {
      const room = getRoom(socket);

      if (!room) return;

      const user =
        room.users.get(socket.id);

      if (!user) return;

      text = String(text || "")
        .trim()
        .substring(0, 500);

      if (!text) return;

      io.to(socket.data.room).emit(
        "chat",
        {
          name: user.name,
          text
        }
      );
    }
  );

  // =============================
  // HOST PIN
  // =============================

  socket.on(
    "host-toggle-pin",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (room.host !== socket.id) {
        return;
      }

      room.pinnedForAll =
        !room.pinnedForAll;

      io.to(socket.data.room).emit(
        "host-pin-changed",
        {
          pinned:
            room.pinnedForAll,
          hostId:
            room.host
        }
      );
    }
  );

  // =============================
  // HOST MUTE USER
  // =============================

  socket.on(
    "host-mute-user",
    ({ userId } = {}) => {
      const room = getRoom(socket);

      if (!room) return;

      if (room.host !== socket.id) {
        return;
      }

      const user =
        room.users.get(userId);

      if (!user) return;

      user.micEnabled = false;
      user.micLocked = true;

      io.to(userId).emit(
        "force-mute",
        {
          locked: true
        }
      );

      sendParticipants(
        socket.data.room
      );
    }
  );

  // =============================
  // HOST CAMERA OFF USER
  // =============================

  socket.on(
    "host-camera-off",
    ({ userId } = {}) => {
      const room = getRoom(socket);

      if (!room) return;

      if (room.host !== socket.id) {
        return;
      }

      const user =
        room.users.get(userId);

      if (!user) return;

      user.cameraEnabled = false;
      user.cameraLocked = true;

      io.to(userId).emit(
        "force-camera-off",
        {
          locked: true
        }
      );

      sendParticipants(
        socket.data.room
      );
    }
  );

  // =============================
  // HOST MUTE ALL
  // =============================

  socket.on(
    "host-mute-all",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (room.host !== socket.id) {
        return;
      }

      room.users.forEach(
        (user) => {
          if (
            user.id === socket.id
          ) {
            return;
          }

          user.micEnabled = false;
          user.micLocked = true;

          io.to(user.id).emit(
            "force-mute",
            {
              locked: true
            }
          );
        }
      );

      sendParticipants(
        socket.data.room
      );
    }
  );

  // =============================
  // HOST CAMERA OFF ALL
  // =============================

  socket.on(
    "host-camera-off-all",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (room.host !== socket.id) {
        return;
      }

      room.users.forEach(
        (user) => {
          if (
            user.id === socket.id
          ) {
            return;
          }

          user.cameraEnabled = false;
          user.cameraLocked = true;

          io.to(user.id).emit(
            "force-camera-off",
            {
              locked: true
            }
          );
        }
      );

      sendParticipants(
        socket.data.room
      );
    }
  );

  // =============================
  // UNLOCK MIC
  // =============================

  socket.on(
    "host-unlock-all-mic",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (room.host !== socket.id) {
        return;
      }

      room.users.forEach(
        (user) => {
          user.micLocked = false;

          io.to(user.id).emit(
            "unlock-mic"
          );
        }
      );

      sendParticipants(
        socket.data.room
      );
    }
  );

  // =============================
  // UNLOCK CAMERA
  // =============================

  socket.on(
    "host-unlock-all-camera",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (room.host !== socket.id) {
        return;
      }

      room.users.forEach(
        (user) => {
          user.cameraLocked = false;

          io.to(user.id).emit(
            "unlock-camera"
          );
        }
      );

      sendParticipants(
        socket.data.room
      );
    }
  );

  // =============================
  // REMOVE USER
  // =============================

  socket.on(
    "host-remove-user",
    ({ userId } = {}) => {
      const room = getRoom(socket);

      if (!room) return;

      if (room.host !== socket.id) {
        return;
      }

      if (userId === socket.id) {
        return;
      }

      const target =
        io.sockets.sockets.get(userId);

      room.users.delete(userId);

      if (target) {
        target.leave(
          socket.data.room
        );

        target.data.room = null;

        target.emit(
          "removed-from-room"
        );
      }

      io.to(socket.data.room).emit(
        "user-left",
        {
          id: userId
        }
      );

      sendParticipants(
        socket.data.room
      );
    }
  );

  // =============================
  // LOCK ROOM
  // =============================

  socket.on(
    "host-toggle-lock",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (room.host !== socket.id) {
        return;
      }

      room.locked =
        !room.locked;

      io.to(socket.data.room).emit(
        "room-lock-changed",
        {
          locked: room.locked
        }
      );
    }
  );

  // =============================
  // END MEETING
  // =============================

  socket.on(
    "end-meeting",
    () => {
      const roomId =
        socket.data.room;

      const room =
        rooms.get(roomId);

      if (!room) return;

      if (
        room.host !== socket.id
      ) {
        return;
      }

      io.to(roomId).emit(
        "meeting-ended"
      );

      rooms.delete(roomId);

      console.log(
        "Meeting ended:",
        roomId
      );
    }
  );

  // =============================
  // LEAVE
  // =============================

  socket.on(
    "leave-room",
    () => {
      leaveRoom(
        socket,
        true
      );
    }
  );

  // =============================
  // DISCONNECT
  // =============================

  socket.on(
    "disconnect",
    () => {
      leaveRoom(
        socket,
        true
      );

      console.log(
        "Disconnected:",
        socket.id
      );
    }
  );
});

// ===============================
// SERVER
// ===============================

const PORT =
  process.env.PORT || 3000;

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `VMeet server running on port ${PORT}`
    );
  }
);
