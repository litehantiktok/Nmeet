"use strict";

// ======================================================
// SOCKET
// ======================================================

const socket = io({
  transports: ["websocket", "polling"]
});

// ======================================================
// HELPER
// ======================================================

const $ = (id) =>
  document.getElementById(id);

// ======================================================
// ELEMENTS
// ======================================================

const home = $("home");
const prejoin = $("prejoin");
const meeting = $("meeting");

const nameInput = $("name");
const createBtn = $("create");
const joinBtn = $("join");
const joinInfo = $("joinInfo");
const connectionStatus =
  $("connectionStatus");

const previewVideo =
  $("previewVideo");

const previewMic =
  $("previewMic");

const previewCam =
  $("previewCam");

const previewCameraOff =
  $("previewCameraOff");

const previewName =
  $("previewName");

const prejoinRoom =
  $("prejoinRoom");

const enterMeeting =
  $("enterMeeting");

const cancelPrejoin =
  $("cancelPrejoin");

const localVideo =
  $("localVideo");

const localTile =
  $("localTile");

const localName =
  $("localName");

const localHostBadge =
  $("localHostBadge");

const localCameraOff =
  $("localCameraOff");

const localPinnedBadge =
  $("localPinnedBadge");

const roomTitle =
  $("roomTitle");

const videos =
  $("videos");

const micBtn =
  $("mic");

const camBtn =
  $("cam");

const switchCameraBtn =
  $("switchCamera");

const screenBtn =
  $("screen");

const leaveBtn =
  $("leave");

const copyBtn =
  $("copy");

const participantsBtn =
  $("participantsBtn");

const participantsPanel =
  $("participantsPanel");

const closeParticipants =
  $("closeParticipants");

const participantsList =
  $("participantsList");

const hostControls =
  $("hostControls");

const pinHost =
  $("pinHost");

const muteAll =
  $("muteAll");

const cameraOffAll =
  $("cameraOffAll");

const unlockAllMic =
  $("unlockAllMic");

const unlockAllCamera =
  $("unlockAllCamera");

const lockRoom =
  $("lockRoom");

const chatBtn =
  $("chatBtn");

const chatPanel =
  $("chatPanel");

const closeChat =
  $("closeChat");

const chatForm =
  $("chatForm");

const chatInput =
  $("chatInput");

const messages =
  $("messages");

const toast =
  $("toast");

// ======================================================
// STATE
// ======================================================

let localStream = null;
let screenStream = null;

let roomId = null;
let myName = "";
let isHost = false;

let cameraFacing = "user";

let participants = [];

let previewReady = false;
let enteringRoom = false;

let pinnedHostId = null;

const peerConnections = new Map();
const pendingCandidates = new Map();

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const invitedRoom =
  urlParams
    .get("room")
    ?.trim()
    .toUpperCase() || null;

// ======================================================
// WEBRTC
// ======================================================

const rtcConfiguration = {
  iceServers: [
    {
      urls:
        "stun:stun.l.google.com:19302"
    },
    {
      urls:
        "stun:stun1.l.google.com:19302"
    }
  ]
};

// ======================================================
// TOAST
// ======================================================

function showToast(message) {
  if (!toast) return;

  toast.textContent =
    String(message);

  toast.classList.remove(
    "hidden"
  );

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(() => {
      toast.classList.add(
        "hidden"
      );
    }, 2800);
}

// ======================================================
// SOCKET STATUS
// ======================================================

socket.on("connect", () => {
  console.log(
    "VMeet connected:",
    socket.id
  );

  if (connectionStatus) {
    connectionStatus.textContent =
      "● Đã kết nối";
    connectionStatus.classList.add(
      "online"
    );
  }
});

socket.on("disconnect", () => {
  console.log(
    "VMeet disconnected"
  );

  if (connectionStatus) {
    connectionStatus.textContent =
      "● Mất kết nối";
    connectionStatus.classList.remove(
      "online"
    );
  }

  if (meeting &&
      !meeting.classList.contains(
        "hidden"
      )) {
    showToast(
      "Mất kết nối máy chủ."
    );
  }
});

socket.on("connect_error", (error) => {
  console.error(
    "Socket connection error:",
    error
  );

  if (connectionStatus) {
    connectionStatus.textContent =
      "● Không kết nối được";
    connectionStatus.classList.remove(
      "online"
    );
  }
});

// ======================================================
// MEDIA SUPPORT
// ======================================================

function hasMediaSupport() {
  return Boolean(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices
      .getUserMedia ===
      "function"
  );
}

// ======================================================
// START PREVIEW
// ======================================================

async function startPreview() {
  if (!hasMediaSupport()) {
    showToast(
      "Trình duyệt không hỗ trợ Camera/Mic."
    );

    return false;
  }

  myName =
    nameInput.value.trim();

  if (!myName) {
    showToast(
      "Vui lòng nhập tên của bạn."
    );

    nameInput.focus();

    return false;
  }

  try {
    // Nếu stream cũ đã tồn tại
    if (!localStream) {
      localStream =
        await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode:
                cameraFacing,
              width: {
                ideal: 1280
              },
              height: {
                ideal: 720
              }
            },
            audio: true
          });
    }

    previewVideo.srcObject =
      localStream;

    previewVideo.muted = true;
    previewVideo.playsInline = true;

    try {
      await previewVideo.play();
    } catch (error) {
      console.log(
        "Preview play:",
        error
      );
    }

    previewName.textContent =
      myName;

    prejoinRoom.textContent =
      invitedRoom
        ? `Phòng ${invitedRoom}`
        : "Phòng mới";

    prejoin.classList.remove(
      "hidden"
    );

    home.classList.add(
      "hidden"
    );

    previewReady = true;

    updatePreviewButtons();

    return true;
  } catch (error) {
    console.error(
      "getUserMedia error:",
      error
    );

    previewReady = false;

    let message =
      "Không mở được Camera/Mic.";

    if (
      error.name ===
      "NotAllowedError"
    ) {
      message =
        "Bạn chưa cấp quyền Camera/Mic cho trình duyệt.";
    } else if (
      error.name ===
      "NotFoundError"
    ) {
      message =
        "Không tìm thấy Camera hoặc Microphone.";
    } else if (
      error.name ===
      "NotReadableError"
    ) {
      message =
        "Camera/Mic đang được ứng dụng khác sử dụng.";
    }

    showToast(message);

    return false;
  }
}

// ======================================================
// PREVIEW BUTTONS
// ======================================================

function updatePreviewButtons() {
  if (!localStream) {
    return;
  }

  const audioTrack =
    localStream.getAudioTracks()[0];

  const videoTrack =
    localStream.getVideoTracks()[0];

  const micEnabled =
    audioTrack
      ? audioTrack.enabled
      : false;

  const cameraEnabled =
    videoTrack
      ? videoTrack.enabled
      : false;

  if (previewMic) {
    previewMic.classList.toggle(
      "active",
      micEnabled
    );

    previewMic.innerHTML =
      micEnabled
        ? "🎤 <span>Mic</span>"
        : "🔇 <span>Mic</span>";
  }

  if (previewCam) {
    previewCam.classList.toggle(
      "active",
      cameraEnabled
    );

    previewCam.innerHTML =
      cameraEnabled
        ? "📷 <span>Camera</span>"
        : "🚫 <span>Camera</span>";
  }

  if (previewCameraOff) {
    previewCameraOff.classList.toggle(
      "hidden",
      cameraEnabled
    );
  }
}

// ======================================================
// PREVIEW MIC
// ======================================================

previewMic.addEventListener(
  "click",
  () => {
    if (!localStream) return;

    const track =
      localStream.getAudioTracks()[0];

    if (!track) {
      showToast(
        "Không tìm thấy microphone."
      );

      return;
    }

    track.enabled =
      !track.enabled;

    updatePreviewButtons();
  }
);

// ======================================================
// PREVIEW CAMERA
// ======================================================

previewCam.addEventListener(
  "click",
  () => {
    if (!localStream) return;

    const track =
      localStream.getVideoTracks()[0];

    if (!track) {
      showToast(
        "Không tìm thấy camera."
      );

      return;
    }

    track.enabled =
      !track.enabled;

    updatePreviewButtons();
  }
);

// ======================================================
// CREATE ROOM
// ======================================================

createBtn.addEventListener(
  "click",
  async () => {
    if (enteringRoom) {
      return;
    }

    myName =
      nameInput.value.trim();

    if (!myName) {
      showToast(
        "Vui lòng nhập tên của bạn."
      );

      nameInput.focus();

      return;
    }

    // Bước 1: mở preview
    if (!previewReady) {
      createBtn.disabled = true;

      createBtn.textContent =
        "Đang mở camera...";

      const success =
        await startPreview();

      createBtn.disabled = false;

      if (!success) {
        createBtn.textContent =
          "➕ Tạo cuộc họp mới";

        return;
      }

      createBtn.textContent =
        "➕ Vào phòng với tư cách chủ phòng";

      showToast(
        "Kiểm tra Camera và Mic rồi bấm Vào cuộc họp."
      );

      return;
    }

    // Bước 2: tạo phòng
    enterRoom(true);
  }
);

// ======================================================
// JOIN INVITED ROOM
// ======================================================

if (invitedRoom) {
  joinInfo.classList.remove(
    "hidden"
  );

  joinBtn.classList.remove(
    "hidden"
  );

  joinBtn.addEventListener(
    "click",
    async () => {
      if (enteringRoom) {
        return;
      }

      myName =
        nameInput.value.trim();

      if (!myName) {
        showToast(
          "Vui lòng nhập tên của bạn."
        );

        nameInput.focus();

        return;
      }

      if (!previewReady) {
        joinBtn.disabled = true;

        joinBtn.textContent =
          "Đang mở camera...";

        const success =
          await startPreview();

        joinBtn.disabled = false;

        if (!success) {
          joinBtn.textContent =
            "🚪 Tham gia cuộc họp";

          return;
        }

        joinBtn.textContent =
          "🚪 Vào cuộc họp";

        showToast(
          "Kiểm tra Camera và Mic rồi bấm Vào cuộc họp."
        );

        return;
      }

      enterRoom(false);
    }
  );
}

// ======================================================
// ENTER ROOM
// ======================================================

function enterRoom(create) {
  if (enteringRoom) {
    return;
  }

  if (!localStream) {
    showToast(
      "Camera chưa sẵn sàng."
    );

    return;
  }

  if (!socket.connected) {
    showToast(
      "Đang kết nối máy chủ. Vui lòng thử lại."
    );

    return;
  }

  enteringRoom = true;

  enterMeeting.disabled = true;

  enterMeeting.textContent =
    "Đang vào cuộc họp...";

  createBtn.disabled = true;
  joinBtn.disabled = true;

  socket.emit("join-room", {
    room:
      create
        ? ""
        : invitedRoom,
    name: myName,
    create
  });
}

// ======================================================
// PREJOIN ENTER
// ======================================================

enterMeeting.addEventListener(
  "click",
  () => {
    if (invitedRoom) {
      enterRoom(false);
    } else {
      enterRoom(true);
    }
  }
);

// ======================================================
// CANCEL PREJOIN
// ======================================================

cancelPrejoin.addEventListener(
  "click",
  () => {
    prejoin.classList.add(
      "hidden"
    );

    home.classList.remove(
      "hidden"
    );

    enteringRoom = false;

    enterMeeting.disabled =
      false;

    enterMeeting.textContent =
      "🚪 Vào cuộc họp";

    createBtn.disabled =
      false;

    joinBtn.disabled =
      false;

    createBtn.textContent =
      "➕ Tạo cuộc họp mới";

    if (invitedRoom) {
      joinBtn.textContent =
        "🚪 Tham gia cuộc họp";
    }
  }
);

// ======================================================
// ROOM JOINED
// ======================================================

socket.on(
  "room-joined",
  async (data) => {
    console.log(
      "ROOM JOINED:",
      data
    );

    roomId =
      data.room;

    isHost =
      Boolean(data.isHost);

    pinnedHostId =
      data.pinned
        ? data.hostId
        : null;

    home.classList.add(
      "hidden"
    );

    prejoin.classList.add(
      "hidden"
    );

    meeting.classList.remove(
      "hidden"
    );

    roomTitle.textContent =
      `Phòng ${roomId}`;

    localName.textContent =
      myName;

    localTile.dataset.userId =
      socket.id;

    if (localStream) {
      localVideo.srcObject =
        localStream;

      localVideo.muted = true;
      localVideo.playsInline = true;

      try {
        await localVideo.play();
      } catch (error) {
        console.log(
          "Local video play:",
          error
        );
      }
    }

    localHostBadge.classList.toggle(
      "hidden",
      !isHost
    );

    hostControls.classList.toggle(
      "hidden",
      !isHost
    );

    updateMeetingButtons();

    updateLocalCameraOverlay();

    createShareLink();

    enteringRoom = false;

    enterMeeting.disabled =
      false;

    enterMeeting.textContent =
      "🚪 Vào cuộc họp";

    createBtn.disabled =
      false;

    joinBtn.disabled =
      false;

    showToast(
      isHost
        ? "Đã tạo cuộc họp."
        : "Đã tham gia cuộc họp."
    );
  }
);

// ======================================================
// SHARE LINK
// ======================================================

function createShareLink() {
  if (!roomId) {
    return;
  }

  const url =
    `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;

  history.replaceState(
    null,
    "",
    `?room=${encodeURIComponent(roomId)}`
  );

  copyBtn.onclick =
    async () => {
      try {
        if (
          navigator.clipboard &&
          navigator.clipboard.writeText
        ) {
          await navigator.clipboard.writeText(
            url
          );

          showToast(
            "Đã sao chép link cuộc họp."
          );
        } else {
          throw new Error(
            "Clipboard unavailable"
          );
        }
      } catch (error) {
        window.prompt(
          "Sao chép link này:",
          url
        );
      }
    };
}

// ======================================================
// PARTICIPANTS
// ======================================================

socket.on(
  "participants",
  (list) => {
    participants =
      Array.isArray(list)
        ? list
        : [];

    updateParticipants();

    const host =
      participants.find(
        (user) =>
          user.isHost
      );

    if (
      host &&
      pinnedHostId === null
    ) {
      pinnedHostId =
        host.id;
    }

    applyPinnedHost();
  }
);

// ======================================================
// UPDATE PARTICIPANTS
// ======================================================

function updateParticipants() {
  if (!participantsList) {
    return;
  }

  participantsList.innerHTML =
    "";

  participants.forEach(
    (user) => {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "participant";

      const info =
        document.createElement(
          "div"
        );

      info.className =
        "participant-info";

      const name =
        document.createElement(
          "span"
        );

      name.textContent =
        user.name +
        (
          user.isHost
            ? " 👑"
            : ""
        );

      info.appendChild(name);

      const status =
        document.createElement(
          "small"
        );

      const mic =
        user.micEnabled
          ? "🎤"
          : "🔇";

      const camera =
        user.cameraEnabled
          ? "📷"
          : "🚫";

      status.textContent =
        `${mic} ${camera}`;

      info.appendChild(
        status
      );

      row.appendChild(info);

      if (
        isHost &&
        user.id !== socket.id
      ) {
        const actions =
          document.createElement(
            "div"
          );

        actions.className =
          "participant-actions";

        const mute =
          document.createElement(
            "button"
          );

        mute.textContent =
          "🔇";

        mute.title =
          "Tắt mic";

        mute.onclick = () => {
          socket.emit(
            "host-mute-user",
            {
              userId: user.id
            }
          );
        };

        const camera =
          document.createElement(
            "button"
          );

        camera.textContent =
          "📷";

        camera.title =
          "Tắt camera";

        camera.onclick = () => {
          socket.emit(
            "host-camera-off",
            {
              userId: user.id
            }
          );
        };

        const remove =
          document.createElement(
            "button"
          );

        remove.textContent =
          "🚫";

        remove.title =
          "Đuổi khỏi phòng";

        remove.onclick =
          () => {
            const ok =
              window.confirm(
                `Đuổi ${user.name} khỏi phòng?`
              );

            if (!ok) {
              return;
            }

            socket.emit(
              "host-remove-user",
              {
                userId: user.id
              }
            );
          };

        actions.appendChild(
          mute
        );

        actions.appendChild(
          camera
        );

        actions.appendChild(
          remove
        );

        row.appendChild(
          actions
        );
      }

      participantsList.appendChild(
        row
      );
    }
  );
}

// ======================================================
// CREATE PEER CONNECTION
// ======================================================

function createPeerConnection(
  remoteId
) {
  if (
    peerConnections.has(
      remoteId
    )
  ) {
    return peerConnections.get(
      remoteId
    );
  }

  const pc =
    new RTCPeerConnection(
      rtcConfiguration
    );

  peerConnections.set(
    remoteId,
    pc
  );

  pendingCandidates.set(
    remoteId,
    []
  );

  // -----------------------------
  // LOCAL TRACKS
  // -----------------------------

  if (localStream) {
    localStream
      .getTracks()
      .forEach(
        (track) => {
          pc.addTrack(
            track,
            localStream
          );
        }
      );
  }

  // -----------------------------
  // REMOTE TRACK
  // -----------------------------

  pc.ontrack =
    (event) => {
      const stream =
        event.streams &&
        event.streams[0];

      if (!stream) {
        return;
      }

      createRemoteVideo(
        remoteId,
        stream
      );
    };

  // -----------------------------
  // ICE
  // -----------------------------

  pc.onicecandidate =
    (event) => {
      if (
        !event.candidate
      ) {
        return;
      }

      socket.emit(
        "signal",
        {
          to: remoteId,
          data: {
            type:
              "candidate",
            candidate:
              event.candidate
          }
        }
      );
    };

  // -----------------------------
  // CONNECTION STATE
  // -----------------------------

  pc.onconnectionstatechange =
    () => {
      console.log(
        `Peer ${remoteId}:`,
        pc.connectionState
      );

      if (
        [
          "failed",
          "closed"
        ].includes(
          pc.connectionState
        )
      ) {
        removeRemoteVideo(
          remoteId
        );
      }
    };

  return pc;
}

// ======================================================
// REMOTE VIDEO
// ======================================================

function findVideoTile(
  userId
) {
  return Array.from(
    document.querySelectorAll(
      ".video-tile"
    )
  ).find(
    (tile) =>
      tile.dataset.userId ===
      userId
  );
}

function createRemoteVideo(
  userId,
  stream
) {
  let tile =
    findVideoTile(userId);

  if (!tile) {
    tile =
      document.createElement(
        "div"
      );

    tile.className =
      "video-tile";

    tile.dataset.userId =
      userId;

    const video =
      document.createElement(
        "video"
      );

    video.autoplay = true;
    video.playsInline = true;

    tile.appendChild(video);

    const name =
      document.createElement(
        "div"
      );

    name.className =
      "video-name";

    const user =
      participants.find(
        (item) =>
          item.id === userId
      );

    name.textContent =
      user
        ? user.name +
          (
            user.isHost
              ? " 👑"
              : ""
          )
        : "Người tham gia";

    tile.appendChild(
      name
    );

    const badge =
      document.createElement(
        "div"
      );

    badge.className =
      "pinned-badge hidden";

    badge.textContent =
      "📌 Đã ghim";

    tile.appendChild(
      badge
    );

    videos.appendChild(
      tile
    );
  }

  const video =
    tile.querySelector(
      "video"
    );

  if (
    video.srcObject !==
    stream
  ) {
    video.srcObject =
      stream;
  }

  video.play().catch(
    () => {}
  );

  applyPinnedHost();
}

// ======================================================
// PIN HOST
// ======================================================

function applyPinnedHost() {
  if (!videos) {
    return;
  }

  let thumbWrapper =
    videos.querySelector(
      ".videos-thumb-wrapper"
    );

  if (!thumbWrapper) {
    thumbWrapper =
      document.createElement(
        "div"
      );

    thumbWrapper.className =
      "videos-thumb-wrapper";

    videos.appendChild(
      thumbWrapper
    );
  }

  const allTiles =
    Array.from(
      videos.querySelectorAll(
        ".video-tile"
      )
    );

  allTiles.forEach(
    (tile) => {
      const id =
        tile.dataset.userId;

      const badge =
        tile.querySelector(
          ".pinned-badge"
        );

      const shouldPin =
        Boolean(
          pinnedHostId &&
          id === pinnedHostId
        );

      tile.classList.toggle(
        "pinned-tile",
        shouldPin
      );

      if (badge) {
        badge.classList.toggle(
          "hidden",
          !shouldPin
        );
      }

      if (
        shouldPin
      ) {
        videos.insertBefore(
          tile,
          thumbWrapper
        );
      } else {
        thumbWrapper.appendChild(
          tile
        );
      }
    }
  );

  // Local pin badge
  if (localPinnedBadge) {
    localPinnedBadge.classList.toggle(
      "hidden",
      pinnedHostId !==
        socket.id
    );
  }
}

// ======================================================
// REMOVE REMOTE
// ======================================================

function removeRemoteVideo(
  userId
) {
  const tile =
    findVideoTile(userId);

  if (tile) {
    tile.remove();
  }

  const pc =
    peerConnections.get(
      userId
    );

  if (pc) {
    try {
      pc.close();
    } catch (error) {
      console.log(error);
    }
  }

  peerConnections.delete(
    userId
  );

  pendingCandidates.delete(
    userId
  );

  applyPinnedHost();
}

// ======================================================
// USER JOINED
// ======================================================

socket.on(
  "user-joined",
  async (user) => {
    if (
      !user ||
      !user.id
    ) {
      return;
    }

    console.log(
      "User joined:",
      user
    );

    try {
      const pc =
        createPeerConnection(
          user.id
        );

      const offer =
        await pc.createOffer();

      await pc.setLocalDescription(
        offer
      );

      socket.emit(
        "signal",
        {
          to: user.id,
          data: {
            type:
              "offer",
            offer:
              pc.localDescription
          }
        }
      );
    } catch (error) {
      console.error(
        "Create offer error:",
        error
      );
    }
  }
);

// ======================================================
// SIGNAL
// ======================================================

socket.on(
  "signal",
  async ({
    from,
    data
  }) => {
    if (
      !from ||
      !data
    ) {
      return;
    }

    try {
      const pc =
        createPeerConnection(
          from
        );

      // ---------------------------
      // OFFER
      // ---------------------------

      if (
        data.type ===
        "offer"
      ) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(
            data.offer
          )
        );

        await flushCandidates(
          from
        );

        const answer =
          await pc.createAnswer();

        await pc.setLocalDescription(
          answer
        );

        socket.emit(
          "signal",
          {
            to: from,
            data: {
              type:
                "answer",
              answer:
                pc.localDescription
            }
          }
        );

        return;
      }

      // ---------------------------
      // ANSWER
      // ---------------------------

      if (
        data.type ===
        "answer"
      ) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(
            data.answer
          )
        );

        await flushCandidates(
          from
        );

        return;
      }

      // ---------------------------
      // ICE CANDIDATE
      // ---------------------------

      if (
        data.type ===
        "candidate"
      ) {
        const candidate =
          new RTCIceCandidate(
            data.candidate
          );

        if (
          pc.remoteDescription &&
          pc.remoteDescription.type
        ) {
          await pc.addIceCandidate(
            candidate
          );
        } else {
          const list =
            pendingCandidates.get(
              from
            ) || [];

          list.push(
            candidate
          );

          pendingCandidates.set(
            from,
            list
          );
        }
      }
    } catch (error) {
      console.error(
        "WebRTC signal error:",
        error
      );
    }
  }
);

// ======================================================
// FLUSH ICE
// ======================================================

async function flushCandidates(
  remoteId
) {
  const pc =
    peerConnections.get(
      remoteId
    );

  if (!pc) {
    return;
  }

  const list =
    pendingCandidates.get(
      remoteId
    ) || [];

  for (
    const candidate of list
  ) {
    try {
      await pc.addIceCandidate(
        candidate
      );
    } catch (error) {
      console.error(
        "ICE candidate error:",
        error
      );
    }
  }

  pendingCandidates.set(
    remoteId,
    []
  );
}

// ======================================================
// USER LEFT
// ======================================================

socket.on(
  "user-left",
  ({ id } = {}) => {
    if (!id) {
      return;
    }

    removeRemoteVideo(id);

    participants =
      participants.filter(
        (user) =>
          user.id !== id
      );

    updateParticipants();
  }
);

// ======================================================
// LOCAL CAMERA OVERLAY
// ======================================================

function updateLocalCameraOverlay() {
  if (!localStream) {
    return;
  }

  const track =
    localStream.getVideoTracks()[0];

  const enabled =
    track
      ? track.enabled
      : false;

  localCameraOff.classList.toggle(
    "hidden",
    enabled
  );
}

// ======================================================
// MEETING BUTTONS
// ======================================================

function updateMeetingButtons() {
  if (!localStream) {
    return;
  }

  const audioTrack =
    localStream.getAudioTracks()[0];

  const videoTrack =
    localStream.getVideoTracks()[0];

  if (
    audioTrack &&
    micBtn
  ) {
    micBtn.classList.toggle(
      "active",
      audioTrack.enabled
    );

    const icon =
      micBtn.querySelector(
        ".icon"
      );

    if (icon) {
      icon.textContent =
        audioTrack.enabled
          ? "🎤"
          : "🔇";
    }
  }

  if (
    videoTrack &&
    camBtn
  ) {
    camBtn.classList.toggle(
      "active",
      videoTrack.enabled
    );

    const icon =
      camBtn.querySelector(
        ".icon"
      );

    if (icon) {
      icon.textContent =
        videoTrack.enabled
          ? "📷"
          : "🚫";
    }
  }

  updateLocalCameraOverlay();
}

// ======================================================
// MIC
// ======================================================

micBtn.addEventListener(
  "click",
  () => {
    if (!localStream) {
      return;
    }

    const track =
      localStream.getAudioTracks()[0];

    if (!track) {
      showToast(
        "Không tìm thấy microphone."
      );

      return;
    }

    track.enabled =
      !track.enabled;

    updateMeetingButtons();

    showToast(
      track.enabled
        ? "Đã bật mic."
        : "Đã tắt mic."
    );
  }
);

// ======================================================
// CAMERA
// ======================================================

camBtn.addEventListener(
  "click",
  () => {
    if (!localStream) {
      return;
    }

    const track =
      localStream.getVideoTracks()[0];

    if (!track) {
      showToast(
        "Không tìm thấy camera."
      );

      return;
    }

    track.enabled =
      !track.enabled;

    updateMeetingButtons();

    showToast(
      track.enabled
        ? "Đã bật camera."
        : "Đã tắt camera."
    );
  }
);

// ======================================================
// SWITCH CAMERA
// ======================================================

switchCameraBtn.addEventListener(
  "click",
  async () => {
    if (!localStream) {
      return;
    }

    const oldTrack =
      localStream.getVideoTracks()[0];

    const oldFacing =
      cameraFacing;

    cameraFacing =
      cameraFacing ===
      "user"
        ? "environment"
        : "user";

    try {
      const newStream =
        await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode:
                cameraFacing
            },
            audio: false
          });

      const newTrack =
        newStream.getVideoTracks()[0];

      if (!newTrack) {
        throw new Error(
          "Không tìm thấy camera."
        );
      }

      newTrack.enabled =
        oldTrack
          ? oldTrack.enabled
          : true;

      if (oldTrack) {
        oldTrack.stop();

        localStream.removeTrack(
          oldTrack
        );
      }

      localStream.addTrack(
        newTrack
      );

      localVideo.srcObject =
        localStream;

      // Thay camera trên tất cả peer
      for (
        const pc of peerConnections.values()
      ) {
        const sender =
          pc.getSenders().find(
            (item) =>
              item.track &&
              item.track.kind ===
                "video"
          );

        if (sender) {
          await sender.replaceTrack(
            newTrack
          );
        }
      }

      updateMeetingButtons();

      showToast(
        cameraFacing ===
          "environment"
          ? "Đã chuyển camera sau."
          : "Đã chuyển camera trước."
      );
    } catch (error) {
      console.error(
        "Switch camera error:",
        error
      );

      cameraFacing =
        oldFacing;

      showToast(
        "Không thể đổi camera."
      );
    }
  }
);

// ======================================================
// SCREEN SHARE
// ======================================================

screenBtn.addEventListener(
  "click",
  async () => {
    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getDisplayMedia) {
      showToast(
        "Trình duyệt không hỗ trợ chia sẻ màn hình."
      );

      return;
    }

    if (screenStream) {
      await stopScreenShare();

      return;
    }

    try {
      screenStream =
        await navigator.mediaDevices
          .getDisplayMedia({
            video: true,
            audio: false
          });

      const screenTrack =
        screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        throw new Error(
          "Không có screen track."
        );
      }

      localVideo.srcObject =
        screenStream;

      for (
        const pc of peerConnections.values()
      ) {
        const sender =
          pc.getSenders().find(
            (item) =>
              item.track &&
              item.track.kind ===
                "video"
          );

        if (sender) {
          await sender.replaceTrack(
            screenTrack
          );
        }
      }

      screenTrack.onended =
        () => {
          stopScreenShare();
        };

      const icon =
        screenBtn.querySelector(
          ".icon"
        );

      if (icon) {
        icon.textContent =
          "⏹️";
      }

      showToast(
        "Đang chia sẻ màn hình."
      );
    } catch (error) {
      console.error(
        "Screen share error:",
        error
      );

      screenStream = null;

      showToast(
        "Không thể chia sẻ màn hình."
      );
    }
  }
);

// ======================================================
// STOP SCREEN SHARE
// ======================================================

async function stopScreenShare() {
  if (!screenStream) {
    return;
  }

  screenStream
    .getTracks()
    .forEach(
      (track) =>
        track.stop()
    );

  screenStream = null;

  if (localStream) {
    localVideo.srcObject =
      localStream;
  }

  const cameraTrack =
    localStream &&
    localStream.getVideoTracks()[0];

  if (cameraTrack) {
    for (
      const pc of peerConnections.values()
    ) {
      const sender =
        pc.getSenders().find(
          (item) =>
            item.track &&
            item.track.kind ===
              "video"
        );

      if (sender) {
        await sender.replaceTrack(
          cameraTrack
        );
      }
    }
  }

  const icon =
    screenBtn.querySelector(
      ".icon"
    );

  if (icon) {
    icon.textContent =
      "🖥️";
  }

  showToast(
    "Đã dừng chia sẻ màn hình."
  );
}

// ======================================================
// CHAT
// ======================================================

chatBtn.addEventListener(
  "click",
  () => {
    chatPanel.classList.toggle(
      "hidden"
    );

    if (
      !chatPanel.classList.contains(
        "hidden"
      )
    ) {
      chatInput.focus();
    }
  }
);

closeChat.addEventListener(
  "click",
  () => {
    chatPanel.classList.add(
      "hidden"
    );
  }
);

chatForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    const text =
      chatInput.value.trim();

    if (!text) {
      return;
    }

    socket.emit(
      "chat",
      {
        text
      }
    );

    chatInput.value =
      "";
  }
);

socket.on(
  "chat",
  ({
    name,
    text
  }) => {
    const message =
      document.createElement(
        "div"
      );

    message.className =
      "msg";

    const sender =
      document.createElement(
        "strong"
      );

    sender.textContent =
      name;

    const content =
      document.createElement(
        "span"
      );

    content.textContent =
      text;

    message.appendChild(
      sender
    );

    message.appendChild(
      content
    );

    messages.appendChild(
      message
    );

    messages.scrollTop =
      messages.scrollHeight;
  }
);

// ======================================================
// PARTICIPANTS PANEL
// ======================================================

participantsBtn.addEventListener(
  "click",
  () => {
    participantsPanel.classList.toggle(
      "hidden"
    );
  }
);

closeParticipants.addEventListener(
  "click",
  () => {
    participantsPanel.classList.add(
      "hidden"
    );
  }
);

// ======================================================
// HOST CONTROLS
// ======================================================

pinHost.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-toggle-pin"
    );
  }
);

muteAll.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-mute-all"
    );
  }
);

cameraOffAll.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-camera-off-all"
    );
  }
);

unlockAllMic.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-unlock-all-mic"
    );
  }
);

unlockAllCamera.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-unlock-all-camera"
    );
  }
);

lockRoom.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-toggle-lock"
    );
  }
);

// ======================================================
// HOST PIN CHANGED
// ======================================================

socket.on(
  "host-pin-changed",
  ({
    pinned,
    hostId
  }) => {
    pinnedHostId =
      pinned
        ? hostId
        : null;

    applyPinnedHost();
  }
);

// ======================================================
// FORCE MUTE
// ======================================================

socket.on(
  "force-mute",
  () => {
    if (!localStream) {
      return;
    }

    const track =
      localStream.getAudioTracks()[0];

    if (track) {
      track.enabled =
        false;
    }

    updateMeetingButtons();

    showToast(
      "Chủ phòng đã tắt mic của bạn."
    );
  }
);

// ======================================================
// FORCE CAMERA
// ======================================================

socket.on(
  "force-camera-off",
  () => {
    if (!localStream) {
      return;
    }

    const track =
      localStream.getVideoTracks()[0];

    if (track) {
      track.enabled =
        false;
    }

    updateMeetingButtons();

    showToast(
      "Chủ phòng đã tắt camera của bạn."
    );
  }
);

// ======================================================
// UNLOCK
// ======================================================

socket.on(
  "unlock-mic",
  () => {
    showToast(
      "Chủ phòng đã cho phép bật mic."
    );
  }
);

socket.on(
  "unlock-camera",
  () => {
    showToast(
      "Chủ phòng đã cho phép bật camera."
    );
  }
);

// ======================================================
// ROOM LOCK
// ======================================================

socket.on(
  "room-lock-changed",
  ({ locked }) => {
    lockRoom.textContent =
      locked
        ? "🔓 Mở khóa phòng"
        : "🔒 Khóa phòng";

    showToast(
      locked
        ? "🔒 Phòng đã được khóa."
        : "🔓 Phòng đã được mở khóa."
    );
  }
);

// ======================================================
// ROOM LOCKED
// ======================================================

socket.on(
  "room-locked",
  ({ message }) => {
    enteringRoom = false;

    createBtn.disabled =
      false;

    joinBtn.disabled =
      false;

    enterMeeting.disabled =
      false;

    enterMeeting.textContent =
      "🚪 Vào cuộc họp";

    createBtn.textContent =
      "➕ Tạo cuộc họp mới";

    if (invitedRoom) {
      joinBtn.textContent =
        "🚪 Tham gia cuộc họp";
    }

    showToast(
      message ||
        "Phòng đang bị khóa."
    );
  }
);

// ======================================================
// ROOM ERROR
// ======================================================

socket.on(
  "room-error",
  ({ message }) => {
    console.error(
      "Room error:",
      message
    );

    enteringRoom = false;

    createBtn.disabled =
      false;

    joinBtn.disabled =
      false;

    enterMeeting.disabled =
      false;

    enterMeeting.textContent =
      "🚪 Vào cuộc họp";

    createBtn.textContent =
      previewReady
        ? "➕ Vào phòng với tư cách chủ phòng"
        : "➕ Tạo cuộc họp mới";

    if (invitedRoom) {
      joinBtn.textContent =
        previewReady
          ? "🚪 Vào cuộc họp"
          : "🚪 Tham gia cuộc họp";
    }

    showToast(
      message ||
        "Không thể vào phòng."
    );
  }
);

// ======================================================
// REMOVED
// ======================================================

socket.on(
  "removed-from-room",
  () => {
    cleanupMeeting();

    showToast(
      "Bạn đã bị chủ phòng đưa ra khỏi phòng."
    );
  }
);

// ======================================================
// MEETING ENDED
// ======================================================

socket.on(
  "meeting-ended",
  () => {
    cleanupMeeting();

    showToast(
      "Cuộc họp đã kết thúc."
    );
  }
);

// ======================================================
// CLEANUP
// ======================================================

function cleanupMeeting() {
  // Screen
  if (screenStream) {
    screenStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    screenStream = null;
  }

  // Camera / mic
  if (localStream) {
    localStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    localStream = null;
  }

  // Peer connections
  peerConnections.forEach(
    (pc) => {
      try {
        pc.close();
      } catch (error) {
        console.log(error);
      }
    }
  );

  peerConnections.clear();
  pendingCandidates.clear();

  // Remote tiles
  document
    .querySelectorAll(
      ".video-tile"
    )
    .forEach(
      (tile) => {
        if (
          tile.id !==
          "localTile"
        ) {
          tile.remove();
        }
      }
    );

  localVideo.srcObject =
    null;

  previewVideo.srcObject =
    null;

  meeting.classList.add(
    "hidden"
  );

  prejoin.classList.add(
    "hidden"
  );

  home.classList.remove(
    "hidden"
  );

  participantsPanel.classList.add(
    "hidden"
  );

  chatPanel.classList.add(
    "hidden"
  );

  roomId = null;
  isHost = false;

  previewReady = false;
  enteringRoom = false;

  pinnedHostId = null;

  participants = [];

  cameraFacing =
    "user";

  createBtn.disabled =
    false;

  joinBtn.disabled =
    false;

  enterMeeting.disabled =
    false;

  createBtn.textContent =
    "➕ Tạo cuộc họp mới";

  joinBtn.textContent =
    "🚪 Tham gia cuộc họp";

  enterMeeting.textContent =
    "🚪 Vào cuộc họp";

  messages.innerHTML =
    "";
}

// ======================================================
// LEAVE
// ======================================================

leaveBtn.addEventListener(
  "click",
  () => {
    const ok =
      window.confirm(
        isHost
          ? "Bạn là chủ phòng. Kết thúc cuộc họp?"
          : "Bạn có chắc muốn rời phòng?"
      );

    if (!ok) {
      return;
    }

    if (isHost) {
      socket.emit(
        "end-meeting"
      );
    } else {
      socket.emit(
        "leave-room"
      );

      cleanupMeeting();

      showToast(
        "Bạn đã rời phòng."
      );
    }
  }
);

// ======================================================
// NAME ENTER
// ======================================================

nameInput.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key ===
      "Enter"
    ) {
      event.preventDefault();

      createBtn.click();
    }
  }
);

// ======================================================
// INITIAL
// ======================================================

if (invitedRoom) {
  joinInfo.classList.remove(
    "hidden"
  );

  joinBtn.classList.remove(
    "hidden"
  );
}

console.log(
  "VMeet app loaded successfully."
);
