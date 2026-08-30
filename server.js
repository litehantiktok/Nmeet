const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

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

function sendParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  io.to(roomId).emit(
    "participants",
    Array.from(room.users.values())
  );
}

function getRoomOfSocket(socket) {
  return socket.data.room
    ? rooms.get(socket.data.room)
    : null;
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // =========================
  // THAM GIA PHÒNG
  // =========================

  socket.on("join-room", ({ room, name, create }) => {
    name = String(name || "Khách")
      .trim()
      .substring(0, 40);

    // Tạo phòng mới
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

    const currentRoom = rooms.get(room);

    if (!currentRoom) {
      socket.emit("room-error", {
        message: "Không tìm thấy phòng."
      });
      return;
    }

    // Phòng bị khóa
    if (
      currentRoom.locked &&
      currentRoom.host !== socket.id
    ) {
      socket.emit("room-locked", {
        message: "Phòng đang bị khóa."
      });
      return;
    }

    // Nếu socket đã ở phòng khác thì rời phòng cũ
    if (socket.data.room && socket.data.room !== room) {
      leaveRoom(socket, false);
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

    // Báo cho chính người vừa vào
    socket.emit("room-joined", {
      room,
      isHost: user.isHost,
      pinnedForAll: currentRoom.pinnedForAll
    });

    // Báo cho những người đang ở phòng
    socket.to(room).emit("user-joined", user);

    // Gửi danh sách mới
    sendParticipants(room);

    console.log(
      `${user.name} joined room ${room}`
    );
  });

  // =========================
  // WEBRTC SIGNAL
  // =========================

  socket.on("signal", ({ to, data }) => {
    if (!to || !data) return;

    const room = getRoomOfSocket(socket);

    if (!room) return;

    const target = io.sockets.sockets.get(to);

    if (!target) return;

    // Chỉ cho phép signal trong cùng phòng
    if (target.data.room !== socket.data.room) {
      return;
    }

    io.to(to).emit("signal", {
      from: socket.id,
      data
    });
  });

  // =========================
  // CHAT
  // =========================

  socket.on("chat", ({ text }) => {
    const room = getRoomOfSocket(socket);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (!user) return;

    text = String(text || "")
      .trim()
      .substring(0, 500);

    if (!text) return;

    io.to(socket.data.room).emit("chat", {
      name: user.name,
      text
    });
  });

  // =========================
  // GHIM CHỦ PHÒNG
  // =========================

  socket.on("host-toggle-pin", () => {
    const room = getRoomOfSocket(socket);

    if (!room || room.host !== socket.id) return;

    room.pinnedForAll = !room.pinnedForAll;

    io.to(socket.data.room).emit(
      "host-pin-changed",
      {
        pinned: room.pinnedForAll,
        hostId: room.host
      }
    );
  });

  // =========================
  // TẮT MIC 1 NGƯỜI
  // =========================

  socket.on("host-mute-user", ({ userId }) => {
    const room = getRoomOfSocket(socket);

    if (!room || room.host !== socket.id) return;

    const user = room.users.get(userId);
    if (!user) return;

    user.micEnabled = false;
    user.micLocked = true;

    io.to(userId).emit("force-mute", {
      locked: true
    });

    sendParticipants(socket.data.room);
  });

  // =========================
  // TẮT CAMERA 1 NGƯỜI
  // =========================

  socket.on("host-camera-off", ({ userId }) => {
    const room = getRoomOfSocket(socket);

    if (!room || room.host !== socket.id) return;

    const user = room.users.get(userId);
    if (!user) return;

    user.cameraEnabled = false;
    user.cameraLocked = true;

    io.to(userId).emit("force-camera-off", {
      locked: true
    });

    sendParticipants(socket.data.room);
  });

  // =========================
  // TẮT MIC TẤT CẢ
  // =========================

  socket.on("host-mute-all", () => {
    const room = getRoomOfSocket(socket);

    if (!room || room.host !== socket.id) return;

    room.users.forEach((user) => {
      if (user.id === socket.id) return;

      user.micEnabled = false;
      user.micLocked = true;

      io.to(user.id).emit("force-mute", {
        locked: true
      });
    });

    sendParticipants(socket.data.room);
  });

  // =========================
  // TẮT CAMERA TẤT CẢ
  // =========================

  socket.on("host-camera-off-all", () => {
    const room = getRoomOfSocket(socket);

    if (!room || room.host !== socket.id) return;

    room.users.forEach((user) => {
      if (user.id === socket.id) return;

      user.cameraEnabled = false;
      user.cameraLocked = true;

      io.to(user.id).emit("force-camera-off", {
        locked: true
      });
    });

    sendParticipants(socket.data.room);
  });

  // =========================
  // MỞ KHÓA MIC
  // =========================

  socket.on("host-unlock-all-mic", () => {
    const room = getRoomOfSocket(socket);

    if (!room || room.host !== socket.id) return;

    room.users.forEach((user) => {
      user.micLocked = false;

      io.to(user.id).emit("unlock-mic");
    });

    sendParticipants(socket.data.room);
  });

  // =========================
  // MỞ KHÓA CAMERA
  // =========================

  socket.on("host-unlock-all-camera", () => {
    const room = getRoomOfSocket(socket);

    if (!room || room.host !== socket.id) return;

    room.users.forEach((user) => {
      user.cameraLocked = false;

      io.to(user.id).emit("unlock-camera");
    });

    sendParticipants(socket.data.room);
  });

  // =========================
  // ĐUỔI NGƯỜI
  // =========================

  socket.on("host-remove-user", ({ userId }) => {
    const room = getRoomOfSocket(socket);

    if (!room || room.host !== socket.id) return;
    if (userId === socket.id) return;

    room.users.delete(userId);

    const target = io.sockets.sockets.get(userId);

    if (target) {
      target.leave(socket.data.room);
      target.data.room = null;

      target.emit("removed-from-room");
    }

    io.to(socket.data.room).emit("user-left", {
      id: userId
    });

    sendParticipants(socket.data.room);
  });

  // =========================
  // KHÓA PHÒNG
  // =========================

  socket.on("host-toggle-lock", () => {
    const room = getRoomOfSocket(socket);

    if (!room || room.host !== socket.id) return;

    room.locked = !room.locked;

    io.to(socket.data.room).emit(
      "room-lock-changed",
      {
        locked: room.locked
      }
    );
  });

  // =========================
  // KẾT THÚC CUỘC HỌP
  // =========================

  socket.on("end-meeting", () => {
    const roomId = socket.data.room;
    const room = rooms.get(roomId);

    if (!room || room.host !== socket.id) {
      return;
    }

    io.to(roomId).emit("meeting-ended");

    rooms.delete(roomId);

    console.log(
      "Meeting ended:",
      roomId
    );
  });

  // =========================
  // RỜI PHÒNG
  // =========================

  socket.on("leave-room", () => {
    leaveRoom(socket, true);
  });

  // =========================
  // DISCONNECT
  // =========================

  socket.on("disconnect", () => {
    leaveRoom(socket, true);

    console.log(
      "User disconnected:",
      socket.id
    );
  });
});

function leaveRoom(socket, notifyOthers = true) {
  const roomId = socket.data.room;

  if (!roomId) return;

  const room = rooms.get(roomId);

  if (!room) {
    socket.data.room = null;
    return;
  }

  // Chủ phòng rời -> kết thúc cuộc họp
  if (room.host === socket.id) {
    io.to(roomId).emit("meeting-ended");

    rooms.delete(roomId);

    socket.data.room = null;

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
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `VMeet server running on port ${PORT}`
  );
});
