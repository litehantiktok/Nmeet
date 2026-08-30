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

const publicPath = path.join(__dirname, "public");

app.use(express.static(publicPath));

// Trang chính
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Health check cho Render
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "VMeet"
  });
});

// ===============================
// ROOMS
// ===============================

const rooms = new Map();

function createRoomId() {
  let roomId;

  do {
    roomId = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  } while (rooms.has(roomId));

  return roomId;
}

function getRoom(socket) {
  const roomId = socket.data.roomId;

  if (!roomId) {
    return null;
  }

  return rooms.get(roomId) || null;
}

function getParticipants(room) {
  if (!room) {
    return [];
  }

  return Array.from(room.users.values());
}

function sendParticipants(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  io.to(roomId).emit(
    "participants",
    getParticipants(room)
  );
}

function leaveCurrentRoom(socket, notify = true) {
  const roomId = socket.data.roomId;

  if (!roomId) {
    return;
  }

  const room = rooms.get(roomId);

  socket.leave(roomId);

  socket.data.roomId = null;

  if (!room) {
    return;
  }

  const wasHost = room.hostId === socket.id;

  room.users.delete(socket.id);

  // Chủ phòng rời thì kết thúc phòng
  if (wasHost) {
    io.to(roomId).emit("meeting-ended");

    rooms.delete(roomId);

    console.log(`Room ${roomId} ended.`);

    return;
  }

  if (notify) {
    socket.to(roomId).emit("user-left", {
      id: socket.id
    });
  }

  sendParticipants(roomId);

  // Xóa phòng nếu không còn ai
  if (room.users.size === 0) {
    rooms.delete(roomId);

    console.log(`Room ${roomId} deleted.`);
  }
}

// ===============================
// SOCKET.IO
// ===============================

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // =============================
  // JOIN ROOM
  // =============================

  socket.on("join-room", (payload = {}) => {
    try {
      let roomId = String(
        payload.room || ""
      )
        .trim()
        .toUpperCase();

      const name = String(
        payload.name || "Khách"
      )
        .trim()
        .substring(0, 40);

      const create = payload.create === true;

      // -----------------------------
      // TẠO PHÒNG
      // -----------------------------

      if (create) {
        // Nếu socket đang ở phòng khác
        if (socket.data.roomId) {
          leaveCurrentRoom(socket);
        }

        roomId = createRoomId();

        rooms.set(roomId, {
          hostId: socket.id,
          locked: false,
          pinned: true,
          users: new Map()
        });

        console.log(
          `Room created: ${roomId}`
        );
      }

      // -----------------------------
      // KIỂM TRA PHÒNG
      // -----------------------------

      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("room-error", {
          message: "Không tìm thấy phòng."
        });

        return;
      }

      // Nếu đang ở phòng khác
      if (
        socket.data.roomId &&
        socket.data.roomId !== roomId
      ) {
        leaveCurrentRoom(socket);
      }

      // Nếu đã ở phòng này
      if (
        socket.data.roomId === roomId
      ) {
        return;
      }

      // Phòng bị khóa
      if (
        room.locked &&
        room.hostId !== socket.id
      ) {
        socket.emit("room-locked", {
          message:
            "Phòng đang bị khóa. Không thể tham gia."
        });

        return;
      }

      // -----------------------------
      // TẠO USER
      // -----------------------------

      const user = {
        id: socket.id,
        name: name || "Khách",
        isHost:
          room.hostId === socket.id,
        micEnabled: true,
        cameraEnabled: true,
        micLocked: false,
        cameraLocked: false
      };

      room.users.set(
        socket.id,
        user
      );

      socket.data.roomId = roomId;
      socket.data.name = user.name;

      socket.join(roomId);

      // -----------------------------
      // BÁO CHO NGƯỜI VỪA VÀO
      // -----------------------------

      socket.emit("room-joined", {
        room: roomId,
        isHost: user.isHost,
        pinned: room.pinned,
        hostId: room.hostId
      });

      // -----------------------------
      // GỬI DANH SÁCH USER HIỆN TẠI
      // -----------------------------

      sendParticipants(roomId);

      // -----------------------------
      // BÁO USER MỚI CHO NGƯỜI CŨ
      // -----------------------------

      socket.to(roomId).emit(
        "user-joined",
        user
      );

      console.log(
        `${user.name} joined ${roomId}`
      );
    } catch (error) {
      console.error(
        "join-room error:",
        error
      );

      socket.emit("room-error", {
        message:
          "Có lỗi khi tham gia phòng."
      });
    }
  });

  // =============================
  // WEBRTC SIGNAL
  // =============================

  socket.on("signal", (payload = {}) => {
    const room = getRoom(socket);

    if (!room) {
      return;
    }

    const to = payload.to;
    const data = payload.data;

    if (!to || !data) {
      return;
    }

    const target =
      io.sockets.sockets.get(to);

    if (!target) {
      return;
    }

    // Không cho signal sang phòng khác
    if (
      target.data.roomId !==
      socket.data.roomId
    ) {
      return;
    }

    target.emit("signal", {
      from: socket.id,
      data
    });
  });

  // =============================
  // CHAT
  // =============================

  socket.on("chat", (payload = {}) => {
    const room = getRoom(socket);

    if (!room) {
      return;
    }

    const user =
      room.users.get(socket.id);

    if (!user) {
      return;
    }

    const text = String(
      payload.text || ""
    )
      .trim()
      .substring(0, 500);

    if (!text) {
      return;
    }

    io.to(socket.data.roomId).emit(
      "chat",
      {
        id: socket.id,
        name: user.name,
        text,
        time: Date.now()
      }
    );
  });

  // =============================
  // HOST: PIN
  // =============================

  socket.on(
    "host-toggle-pin",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      room.pinned = !room.pinned;

      io.to(socket.data.roomId).emit(
        "host-pin-changed",
        {
          pinned: room.pinned,
          hostId: room.hostId
        }
      );
    }
  );

  // =============================
  // HOST: MUTE USER
  // =============================

  socket.on(
    "host-mute-user",
    ({ userId } = {}) => {
      const room = getRoom(socket);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      const user =
        room.users.get(userId);

      if (!user) return;

      user.micEnabled = false;
      user.micLocked = true;

      io.to(userId).emit(
        "force-mute"
      );

      sendParticipants(
        socket.data.roomId
      );
    }
  );

  // =============================
  // HOST: CAMERA OFF USER
  // =============================

  socket.on(
    "host-camera-off",
    ({ userId } = {}) => {
      const room = getRoom(socket);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      const user =
        room.users.get(userId);

      if (!user) return;

      user.cameraEnabled = false;
      user.cameraLocked = true;

      io.to(userId).emit(
        "force-camera-off"
      );

      sendParticipants(
        socket.data.roomId
      );
    }
  );

  // =============================
  // HOST: MUTE ALL
  // =============================

  socket.on(
    "host-mute-all",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      room.users.forEach((user) => {
        if (user.id === socket.id) {
          return;
        }

        user.micEnabled = false;
        user.micLocked = true;

        io.to(user.id).emit(
          "force-mute"
        );
      });

      sendParticipants(
        socket.data.roomId
      );
    }
  );

  // =============================
  // HOST: CAMERA OFF ALL
  // =============================

  socket.on(
    "host-camera-off-all",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      room.users.forEach((user) => {
        if (user.id === socket.id) {
          return;
        }

        user.cameraEnabled = false;
        user.cameraLocked = true;

        io.to(user.id).emit(
          "force-camera-off"
        );
      });

      sendParticipants(
        socket.data.roomId
      );
    }
  );

  // =============================
  // HOST: UNLOCK MIC
  // =============================

  socket.on(
    "host-unlock-all-mic",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      room.users.forEach((user) => {
        user.micLocked = false;

        io.to(user.id).emit(
          "unlock-mic"
        );
      });

      sendParticipants(
        socket.data.roomId
      );
    }
  );

  // =============================
  // HOST: UNLOCK CAMERA
  // =============================

  socket.on(
    "host-unlock-all-camera",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      room.users.forEach((user) => {
        user.cameraLocked = false;

        io.to(user.id).emit(
          "unlock-camera"
        );
      });

      sendParticipants(
        socket.data.roomId
      );
    }
  );

  // =============================
  // HOST: LOCK ROOM
  // =============================

  socket.on(
    "host-toggle-lock",
    () => {
      const room = getRoom(socket);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      room.locked = !room.locked;

      io.to(socket.data.roomId).emit(
        "room-lock-changed",
        {
          locked: room.locked
        }
      );
    }
  );

  // =============================
  // HOST: REMOVE USER
  // =============================

  socket.on(
    "host-remove-user",
    ({ userId } = {}) => {
      const room = getRoom(socket);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      if (
        userId === socket.id
      ) {
        return;
      }

      const user =
        room.users.get(userId);

      if (!user) {
        return;
      }

      room.users.delete(userId);

      const target =
        io.sockets.sockets.get(userId);

      if (target) {
        target.leave(
          socket.data.roomId
        );

        target.data.roomId =
          null;

        target.emit(
          "removed-from-room"
        );
      }

      io.to(socket.data.roomId).emit(
        "user-left",
        {
          id: userId
        }
      );

      sendParticipants(
        socket.data.roomId
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
        socket.data.roomId;

      const room =
        rooms.get(roomId);

      if (!room) return;

      if (
        room.hostId !== socket.id
      ) {
        return;
      }

      io.to(roomId).emit(
        "meeting-ended"
      );

      rooms.delete(roomId);

      console.log(
        `Meeting ended: ${roomId}`
      );
    }
  );

  // =============================
  // LEAVE
  // =============================

  socket.on(
    "leave-room",
    () => {
      leaveCurrentRoom(
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
      console.log(
        "Disconnected:",
        socket.id
      );

      leaveCurrentRoom(
        socket,
        true
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
