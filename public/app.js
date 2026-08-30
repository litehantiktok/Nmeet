```javascript
const socket = io();
const $ = (id) => document.getElementById(id);

// ===============================
// GIAO DIỆN
// ===============================

const home = $("home");
const prejoin = $("prejoin");
const meeting = $("meeting");
const nameInput = $("name");
const createBtn = $("create");
const joinBtn = $("join");
const joinInfo = $("joinInfo");

const previewVideo = $("previewVideo");
const previewMic = $("previewMic");
const previewCam = $("previewCam");
const previewCameraOff = $("previewCameraOff");
const previewName = $("previewName");

const enterMeeting = $("enterMeeting");
const cancelPrejoin = $("cancelPrejoin");

const localVideo = $("localVideo");
const localTile = $("localTile");
const localName = $("localName");
const localHostBadge = $("localHostBadge");
const localCameraOff = $("localCameraOff");

const roomTitle = $("roomTitle");
const videos = $("videos");

const micBtn = $("mic");
const camBtn = $("cam");
const switchCameraBtn = $("switchCamera");
const screenBtn = $("screen");
const leaveBtn = $("leave");
const copyBtn = $("copy");

const participantsBtn = $("participantsBtn");
const participantsPanel = $("participantsPanel");
const closeParticipants = $("closeParticipants");
const participantsList = $("participantsList");

const hostControls = $("hostControls");
const pinHost = $("pinHost");
const muteAll = $("muteAll");
const cameraOffAll = $("cameraOffAll");
const unlockAllMic = $("unlockAllMic");
const unlockAllCamera = $("unlockAllCamera");
const lockRoom = $("lockRoom");

const chatBtn = $("chatBtn");
const chatPanel = $("chatPanel");
const closeChat = $("closeChat");
const chatForm = $("chatForm");
const chatInput = $("chatInput");
const messages = $("messages");

const toast = $("toast");

// ===============================
// BIẾN
// ===============================

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

const peerConnections = {};
const pendingCandidates = {};
const makingOffer = {};
const ignoreOffer = {};
const politePeer = {};

// ===============================
// WEBRTC
// ===============================
//
// STUN giúp tìm đường kết nối trực tiếp.
//
// TURN dùng khi hai thiết bị không thể kết nối
// trực tiếp với nhau.
//
// HIỆN TẠI:
// Bạn có thể chạy trước với STUN.
//
// SAU KHI CÓ TURN:
// Điền thông tin TURN ở đây.
//
// ===============================

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: "stun:stun1.l.google.com:19302"
    }

    /*
    // ============================
    // TURN - ĐIỀN THÔNG TIN SAU
    // ============================

    {
      urls: "turn:YOUR_TURN_SERVER:3478",
      username: "YOUR_USERNAME",
      credential: "YOUR_PASSWORD"
    },

    {
      urls: "turns:YOUR_TURN_SERVER:5349",
      username: "YOUR_USERNAME",
      credential: "YOUR_PASSWORD"
    }
    */
  ]
};

// ===============================
// TOAST
// ===============================

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2500);
}

// ===============================
// MEDIA
// ===============================

function hasMediaSupport() {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
}

// ===============================
// PREVIEW
// ===============================

async function startPreview() {
  if (!hasMediaSupport()) {
    showToast("Trình duyệt không hỗ trợ camera và mic.");
    return false;
  }

  myName = nameInput.value.trim();

  if (!myName) {
    showToast("Vui lòng nhập tên của bạn.");
    nameInput.focus();
    return false;
  }

  try {
    const oldAudio =
      localStream &&
      localStream.getAudioTracks()[0];

    const oldVideo =
      localStream &&
      localStream.getVideoTracks()[0];

    const streamUsable =
      localStream &&
      (oldAudio || oldVideo);

    if (!streamUsable) {
      localStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
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

    previewVideo.srcObject = localStream;
    previewVideo.muted = true;
    previewVideo.playsInline = true;

    try {
      await previewVideo.play();
    } catch {}

    previewName.textContent = myName;

    prejoin.classList.remove("hidden");

    updatePreviewButtons();

    previewReady = true;

    return true;

  } catch (error) {

    console.error("Preview error:", error);

    previewReady = false;

    showToast(
      "Không thể mở camera hoặc mic. Hãy kiểm tra quyền Camera/Mic."
    );

    return false;
  }
}

// ===============================
// PREVIEW BUTTONS
// ===============================

function updatePreviewButtons() {
  if (!localStream) return;

  const audioTrack =
    localStream.getAudioTracks()[0];

  const videoTrack =
    localStream.getVideoTracks()[0];

  const micEnabled =
    audioTrack ? audioTrack.enabled : false;

  const camEnabled =
    videoTrack ? videoTrack.enabled : false;

  if (previewMic) {
    previewMic.classList.toggle(
      "active",
      micEnabled
    );

    previewMic.innerHTML =
      micEnabled
        ? "🎤<span>Mic</span>"
        : "🔇<span>Mic</span>";
  }

  if (previewCam) {
    previewCam.classList.toggle(
      "active",
      camEnabled
    );

    previewCam.innerHTML =
      camEnabled
        ? "📷<span>Camera</span>"
        : "🚫<span>Camera</span>";
  }

  if (previewCameraOff) {
    previewCameraOff.classList.toggle(
      "hidden",
      camEnabled
    );
  }
}

// ===============================
// PREVIEW MIC
// ===============================

if (previewMic) {
  previewMic.addEventListener("click", () => {

    if (!localStream) return;

    const track =
      localStream.getAudioTracks()[0];

    if (!track) {
      showToast("Không tìm thấy mic.");
      return;
    }

    track.enabled = !track.enabled;

    updatePreviewButtons();
  });
}

// ===============================
// PREVIEW CAMERA
// ===============================

if (previewCam) {
  previewCam.addEventListener("click", () => {

    if (!localStream) return;

    const track =
      localStream.getVideoTracks()[0];

    if (!track) {
      showToast("Không tìm thấy camera.");
      return;
    }

    track.enabled = !track.enabled;

    updatePreviewButtons();
  });
}

// ===============================
// VÀO PHÒNG
// ===============================

if (enterMeeting) {

  enterMeeting.addEventListener(
    "click",
    async () => {

      if (enteringRoom) return;

      myName = nameInput.value.trim();

      if (!myName) {
        showToast("Vui lòng nhập tên của bạn.");
        return;
      }

      if (!previewReady) {

        const success =
          await startPreview();

        if (!success) return;
      }

      enteringRoom = true;

      enterMeeting.disabled = true;
      enterMeeting.textContent =
        "Đang vào phòng...";

      socket.emit("join-room", {
        room: invitedRoom || "",
        name: myName,
        create: !invitedRoom
      });
    }
  );
}

// ===============================
// HỦY PREJOIN
// ===============================

if (cancelPrejoin) {

  cancelPrejoin.addEventListener(
    "click",
    () => {

      prejoin.classList.add("hidden");

      previewReady = !!localStream;

      enteringRoom = false;

      createBtn.disabled = false;
      joinBtn.disabled = false;

      createBtn.textContent =
        "➕ Tạo cuộc họp mới";

      if (invitedRoom) {
        joinBtn.textContent =
          "🚪 Tham gia cuộc họp";
      }
    }
  );
}

// ===============================
// LINK PHÒNG
// ===============================

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const invitedRoom =
  urlParams.get("room");

// ===============================
// THAM GIA PHÒNG
// ===============================

if (invitedRoom) {

  joinInfo.classList.remove("hidden");
  joinBtn.classList.remove("hidden");

  joinBtn.addEventListener(
    "click",
    async () => {

      if (enteringRoom) return;

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
          "Kiểm tra mic và camera trước khi vào."
        );

        return;
      }

      enteringRoom = true;

      joinBtn.disabled = true;

      joinBtn.textContent =
        "Đang vào phòng...";

      socket.emit("join-room", {
        room: invitedRoom,
        name: myName,
        create: false
      });
    }
  );
}

// ===============================
// TẠO PHÒNG
// ===============================

createBtn.addEventListener(
  "click",
  async () => {

    if (enteringRoom) return;

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
        "Kiểm tra mic và camera trước khi vào."
      );

      return;
    }

    enteringRoom = true;

    createBtn.disabled = true;

    createBtn.textContent =
      "Đang tạo cuộc họp...";

    socket.emit("join-room", {
      room: "",
      name: myName,
      create: true
    });
  }
);

// ===============================
// ROOM JOINED
// ===============================

socket.on(
  "room-joined",
  async (data) => {

    roomId = data.room;

    isHost =
      Boolean(data.isHost);

    if (isHost) {
      pinnedHostId = socket.id;
    }

    home.classList.add("hidden");

    prejoin.classList.add("hidden");

    meeting.classList.remove("hidden");

    roomTitle.textContent =
      "Phòng " + roomId;

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
      } catch {}
    }

    if (isHost) {

      localHostBadge.classList.remove(
        "hidden"
      );

      hostControls.classList.remove(
        "hidden"
      );

    } else {

      localHostBadge.classList.add(
        "hidden"
      );

      hostControls.classList.add(
        "hidden"
      );
    }

    updateMeetingButtons();

    createShareLink();

    updateLocalCameraOverlay();

    applyPinnedHost();

    showToast(
      isHost
        ? "Đã tạo cuộc họp."
        : "Đã tham gia cuộc họp."
    );

    enteringRoom = false;

    if (enterMeeting) {

      enterMeeting.disabled = false;

      enterMeeting.textContent =
        "🚪 Vào cuộc họp";
    }
  }
);

// ===============================
// SHARE LINK
// ===============================

function createShareLink() {

  const url =
    window.location.origin +
    "?room=" +
    encodeURIComponent(roomId);

  history.replaceState(
    null,
    "",
    "?room=" +
    encodeURIComponent(roomId)
  );

  copyBtn.onclick =
    async () => {

      try {

        await navigator.clipboard.writeText(
          url
        );

        showToast(
          "Đã sao chép link cuộc họp."
        );

      } catch {

        window.prompt(
          "Sao chép link này:",
          url
        );
      }
    };
}

// ===============================
// PARTICIPANTS
// ===============================

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
        (user) => user.isHost
      );

    if (host) {
      pinnedHostId =
        host.id;
    }

    applyPinnedHost();
  }
);

function updateParticipants() {

  if (!participantsList) return;

  participantsList.innerHTML = "";

  participants.forEach(
    (user) => {

      const row =
        document.createElement("div");

      row.className =
        "participant";

      const name =
        document.createElement("span");

      name.textContent =
        user.name +
        (user.isHost ? " 👑" : "");

      row.appendChild(name);

      if (
        isHost &&
        user.id !== socket.id
      ) {

        const mute =
          document.createElement("button");

        mute.textContent = "🔇";
        mute.title = "Tắt mic";

        mute.onclick =
          () => {

            socket.emit(
              "host-mute-user",
              {
                userId: user.id
              }
            );
          };

        const cam =
          document.createElement("button");

        cam.textContent = "📷";
        cam.title = "Tắt camera";

        cam.onclick =
          () => {

            socket.emit(
              "host-camera-off",
              {
                userId: user.id
              }
            );
          };

        const remove =
          document.createElement("button");

        remove.textContent = "🚫";
        remove.title =
          "Đuổi khỏi phòng";

        remove.onclick =
          () => {

            if (
              confirm(
                "Bạn có chắc muốn đuổi người này?"
              )
            ) {

              socket.emit(
                "host-remove-user",
                {
                  userId: user.id
                }
              );
            }
          };

        row.appendChild(mute);
        row.appendChild(cam);
        row.appendChild(remove);
      }

      participantsList.appendChild(row);
    }
  );
}

// =====================================================
// WEBRTC
// =====================================================

// Tạo peer connection
function createPeerConnection(remoteId) {

  if (peerConnections[remoteId]) {
    return peerConnections[remoteId];
  }

  const pc =
    new RTCPeerConnection(
      configuration
    );

  peerConnections[remoteId] =
    pc;

  pendingCandidates[remoteId] =
    [];

  makingOffer[remoteId] =
    false;

  ignoreOffer[remoteId] =
    false;

  // Quy tắc xác định bên polite.
  //
  // ID socket khác nhau.
  //
  // Người có ID lớn hơn được coi là polite.

  politePeer[remoteId] =
    socket.id > remoteId;

  // ===============================
  // ADD LOCAL TRACKS
  // ===============================

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        (track) => {

          try {

            pc.addTrack(
              track,
              localStream
            );

          } catch (error) {

            console.error(
              "addTrack error:",
              error
            );
          }
        }
      );
  }

  // ===============================
  // REMOTE TRACK
  // ===============================

  pc.ontrack =
    (event) => {

      console.log(
        "Remote track:",
        remoteId,
        event.track.kind
      );

      const stream =
        event.streams &&
        event.streams[0];

      if (stream) {

        createRemoteVideo(
          remoteId,
          stream
        );
      }
    };

  // ===============================
  // ICE
  // ===============================

  pc.onicecandidate =
    (event) => {

      if (!event.candidate) return;

      socket.emit(
        "signal",
        {
          to: remoteId,

          data: {
            type: "candidate",
            candidate: event.candidate
          }
        }
      );
    };

  // ===============================
  // ICE STATE
  // ===============================

  pc.oniceconnectionstatechange =
    () => {

      console.log(
        "ICE",
        remoteId,
        pc.iceConnectionState
      );

      if (
        pc.iceConnectionState ===
        "failed"
      ) {

        try {
          pc.restartIce();
        } catch {}

        renegotiatePeer(
          remoteId,
          true
        );
      }
    };

  // ===============================
  // CONNECTION STATE
  // ===============================

  pc.onconnectionstatechange =
    () => {

      console.log(
        "Connection",
        remoteId,
        pc.connectionState
      );

      if (
        pc.connectionState ===
        "connected"
      ) {

        console.log(
          "WebRTC connected:",
          remoteId
        );

        return;
      }

      if (
        pc.connectionState ===
        "failed"
      ) {

        showToast(
          "Kết nối với một thành viên bị lỗi."
        );

        recreatePeerConnection(
          remoteId
        );
      }

      if (
        pc.connectionState ===
        "closed"
      ) {

        removeRemoteVideo(
          remoteId
        );
      }
    };

  // ===============================
  // SIGNALING STATE
  // ===============================

  pc.onsignalingstatechange =
    () => {

      console.log(
        "Signaling:",
        remoteId,
        pc.signalingState
      );
    };

  return pc;
}

// =====================================================
// TẠO OFFER
// =====================================================

async function makeOffer(remoteId) {

  const pc =
    peerConnections[remoteId] ||
    createPeerConnection(remoteId);

  if (
    pc.signalingState !==
    "stable"
  ) {
    return;
  }

  try {

    makingOffer[remoteId] =
      true;

    const offer =
      await pc.createOffer();

    if (
      pc.signalingState !==
      "stable"
    ) {
      return;
    }

    await pc.setLocalDescription(
      offer
    );

    socket.emit(
      "signal",
      {
        to: remoteId,

        data: {
          type: "offer",
          offer: pc.localDescription
        }
      }
    );

  } catch (error) {

    console.error(
      "Offer error:",
      error
    );

  } finally {

    makingOffer[remoteId] =
      false;
  }
}

// =====================================================
// USER JOINED
// =====================================================

socket.on(
  "user-joined",
  async (user) => {

    if (!user || !user.id) {
      return;
    }

    try {

      createPeerConnection(
        user.id
      );

      // Chỉ người đang ở trong phòng
      // tạo offer cho người mới.

      await makeOffer(
        user.id
      );

    } catch (error) {

      console.error(
        "user-joined error:",
        error
      );
    }
  }
);

// =====================================================
// SIGNAL
// =====================================================

socket.on(
  "signal",
  async ({ from, data }) => {

    if (!from || !data) {
      return;
    }

    let pc =
      peerConnections[from];

    if (!pc) {
      pc =
        createPeerConnection(
          from
        );
    }

    try {

      // ==========================
      // OFFER
      // ==========================

      if (
        data.type ===
        "offer"
      ) {

        const offerCollision =
          makingOffer[from] ||
          pc.signalingState !==
            "stable";

        ignoreOffer[from] =
          !politePeer[from] &&
          offerCollision;

        if (
          ignoreOffer[from]
        ) {

          console.warn(
            "Ignoring offer collision:",
            from
          );

          return;
        }

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
              type: "answer",
              answer: pc.localDescription
            }
          }
        );

        return;
      }

      // ==========================
      // ANSWER
      // ==========================

      if (
        data.type ===
        "answer"
      ) {

        if (
          pc.signalingState !==
          "have-local-offer"
        ) {

          console.warn(
            "Ignoring unexpected answer:",
            from
          );

          return;
        }

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

      // ==========================
      // ICE CANDIDATE
      // ==========================

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

          try {

            await pc.addIceCandidate(
              candidate
            );

          } catch (error) {

            if (!ignoreOffer[from]) {

              console.error(
                "ICE candidate error:",
                error
              );
            }
          }

        } else {

          if (
            !pendingCandidates[from]
          ) {

            pendingCandidates[from] =
              [];
          }

          pendingCandidates[from]
            .push(candidate);
        }

        return;
      }

    } catch (error) {

      console.error(
        "WebRTC signal error:",
        from,
        error
      );
    }
  }
);

// =====================================================
// FLUSH ICE
// =====================================================

async function flushCandidates(
  remoteId
) {

  const pc =
    peerConnections[remoteId];

  if (!pc) return;

  const list =
    pendingCandidates[remoteId] ||
    [];

  if (
    !pc.remoteDescription ||
    !pc.remoteDescription.type
  ) {
    return;
  }

  for (
    const candidate of list
  ) {

    try {

      await pc.addIceCandidate(
        candidate
      );

    } catch (error) {

      console.error(
        "ICE error:",
        error
      );
    }
  }

  pendingCandidates[remoteId] =
    [];
}

// =====================================================
// RECREATE PEER
// =====================================================

async function recreatePeerConnection(
  remoteId
) {

  console.log(
    "Recreating peer:",
    remoteId
  );

  const oldPc =
    peerConnections[remoteId];

  if (oldPc) {

    try {
      oldPc.close();
    } catch {}
  }

  delete peerConnections[
    remoteId
  ];

  pendingCandidates[
    remoteId
  ] = [];

  makingOffer[
    remoteId
  ] = false;

  ignoreOffer[
    remoteId
  ] = false;

  createPeerConnection(
    remoteId
  );

  // Chỉ một phía tạo offer.
  //
  // ID nhỏ hơn tạo offer.

  if (socket.id < remoteId) {

    setTimeout(
      () => {
        makeOffer(remoteId);
      },
      300
    );
  }
}

// =====================================================
// RENEGOTIATE
// =====================================================

async function renegotiatePeer(
  remoteId,
  force = false
) {

  const pc =
    peerConnections[remoteId];

  if (!pc) return;

  if (
    !force &&
    pc.signalingState !==
      "stable"
  ) {
    return;
  }

  if (
    socket.id !==
    remoteId &&
    socket.id < remoteId
  ) {

    await makeOffer(
      remoteId
    );
  }
}

// =====================================================
// CREATE REMOTE VIDEO
// =====================================================

function createRemoteVideo(
  userId,
  stream
) {

  let tile =
    document.querySelector(
      [data-user-id="${CSS.escape(         userId       )}"]
    );

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
    video.muted = false;

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
          (user.isHost
            ? " 👑"
            : "")
        : "Người tham gia";

    tile.appendChild(name);

    const badge =
      document.createElement(
        "div"
      );

    badge.className =
      "pinned-badge hidden";

    badge.textContent =
      "📌 Đã ghim";

    tile.appendChild(badge);

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

  video.autoplay = true;
  video.playsInline = true;

  video.play()
    .catch(() => {});

  applyPinnedHost();
}

// =====================================================
// PIN HOST
// =====================================================

function applyPinnedHost() {

  if (!pinnedHostId) {

    const host =
      participants.find(
        (user) =>
          user.isHost
      );

    if (host) {
      pinnedHostId =
        host.id;
    }
  }

  let thumbWrapper =
    document.querySelector(
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

  document
    .querySelectorAll(
      ".video-tile"
    )
    .forEach(
      (tile) => {

        const uId =
          tile.dataset.userId;

        const badge =
          tile.querySelector(
            ".pinned-badge"
          );

        if (
          uId ===
          pinnedHostId
        ) {

          tile.classList.add(
            "pinned-tile"
          );

          if (badge) {
            badge.classList.remove(
              "hidden"
            );
          }

          videos.insertBefore(
            tile,
            thumbWrapper
          );

        } else {

          tile.classList.remove(
            "pinned-tile"
          );

          if (badge) {
            badge.classList.add(
              "hidden"
            );
          }

          thumbWrapper.appendChild(
            tile
          );
        }
      }
    );
}

// =====================================================
// REMOVE REMOTE VIDEO
// =====================================================

function removeRemoteVideo(
  userId
) {

  const tile =
    document.querySelector(
      `[data-user-id="${CSS.escape(
        userId
      )}"]`
    );

  if (
    tile &&
    tile !== localTile
  ) {

    tile.remove();
  }

  if (
    peerConnections[userId]
  ) {

    try {

      peerConnections[
        userId
      ].close();

    } catch {}

    delete peerConnections[
      userId
    ];
  }

  delete pendingCandidates[
    userId
  ];

  delete makingOffer[
    userId
  ];

  delete ignoreOffer[
    userId
  ];

  delete politePeer[
    userId
  ];

  applyPinnedHost();
}

// =====================================================
// USER LEFT
// =====================================================

socket.on(
  "user-left",
  ({ id }) => {

    if (!id) return;

    removeRemoteVideo(id);
  }
);

// =====================================================
// LOCAL CAMERA OVERLAY
// =====================================================

function updateLocalCameraOverlay() {

  if (!localStream) return;

  const track =
    localStream.getVideoTracks()[0];

  const enabled =
    track
      ? track.enabled
      : false;

  if (localCameraOff) {

    localCameraOff.classList.toggle(
      "hidden",
      enabled
    );
  }
}

// =====================================================
// BUTTONS
// =====================================================

function updateMeetingButtons() {

  if (!localStream) return;

  const audioTrack =
    localStream.getAudioTracks()[0];

  const videoTrack =
    localStream.getVideoTracks()[0];

  if (audioTrack) {

    micBtn.firstChild.textContent =
      audioTrack.enabled
        ? "🎤 "
        : "🔇 ";
  }

  if (videoTrack) {

    camBtn.firstChild.textContent =
      videoTrack.enabled
        ? "📷 "
        : "🚫 ";
  }

  updateLocalCameraOverlay();
}

// =====================================================
// MIC
// =====================================================

micBtn.addEventListener(
  "click",
  () => {

    if (!localStream) return;

    const track =
      localStream.getAudioTracks()[0];

    if (!track) return;

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

// =====================================================
// CAMERA
// =====================================================

camBtn.addEventListener(
  "click",
  () => {

    if (!localStream) return;

    const track =
      localStream.getVideoTracks()[0];

    if (!track) return;

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

// =====================================================
// ĐỔI CAMERA
// =====================================================

switchCameraBtn.addEventListener(
  "click",
  async () => {

    if (!localStream) return;

    const oldTrack =
      localStream.getVideoTracks()[0];

    cameraFacing =
      cameraFacing === "user"
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
          "Không có camera."
        );
      }

      const wasEnabled =
        oldTrack
          ? oldTrack.enabled
          : true;

      newTrack.enabled =
        wasEnabled;

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

      // Thay track trên tất cả peer.

      for (
        const pc of Object.values(
          peerConnections
        )
      ) {

        const sender =
          pc.getSenders()
            .find(
              (item) =>
                item.track &&
                item.track.kind ===
                  "video"
            );

        if (sender) {

          try {

            await sender.replaceTrack(
              newTrack
            );

          } catch (error) {

            console.error(
              "replaceTrack error:",
              error
            );
          }
        }
      }

      updateMeetingButtons();

      showToast(
        cameraFacing === "environment"
          ? "Đã chuyển sang camera sau."
          : "Đã chuyển sang camera trước."
      );

    } catch (error) {

      console.error(
        "Switch camera error:",
        error
      );

      cameraFacing =
        cameraFacing === "user"
          ? "environment"
          : "user";

      showToast(
        "Không thể đổi camera."
      );
    }
  }
);

// =====================================================
// CHIA SẺ MÀN HÌNH
// =====================================================

screenBtn.addEventListener(
  "click",
  async () => {

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

      localVideo.srcObject =
        screenStream;

      for (
        const pc of Object.values(
          peerConnections
        )
      ) {

        const sender =
          pc.getSenders()
            .find(
              (item) =>
                item.track &&
                item.track.kind ===
                  "video"
            );

        if (sender) {

          try {

            await sender.replaceTrack(
              screenTrack
            );

          } catch (error) {

            console.error(
              "Screen replaceTrack:",
              error
            );
          }
        }
      }

      screenTrack.onended =
        () => {
          stopScreenShare();
        };

      screenBtn.firstChild.textContent =
        "⏹️ ";

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

// =====================================================
// DỪNG CHIA SẺ
// =====================================================

async function stopScreenShare() {

  if (!screenStream) return;

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
      const pc of Object.values(
        peerConnections
      )
    ) {

      const sender =
        pc.getSenders()
          .find(
            (item) =>
              item.track &&
              item.track.kind ===
                "video"
          );

      if (sender) {

        try {

          await sender.replaceTrack(
            cameraTrack
          );

        } catch (error) {

          console.error(
            "Camera replaceTrack:",
            error
          );
        }
      }
    }
  }

  screenBtn.firstChild.textContent =
    "🖥️ ";
}

// =====================================================
// CHAT
// =====================================================

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

    if (!text) return;

    socket.emit(
      "chat",
      {
        text
      }
    );

    chatInput.value = "";
  }
);

// =====================================================
// NHẬN CHAT
// =====================================================

socket.on(
  "chat",
  ({ name, text }) => {

    const message =
      document.createElement(
        "div"
      );

    message.className =
      "msg";

    message.textContent =
      name + ": " + text;

    messages.appendChild(
      message
    );

    messages.scrollTop =
      messages.scrollHeight;
  }
);

// =====================================================
// PARTICIPANTS PANEL
// =====================================================

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

// =====================================================
// HOST PIN
// =====================================================

pinHost.addEventListener(
  "click",
  () => {

    if (!isHost) return;

    socket.emit(
      "host-toggle-pin"
    );
  }
);

socket.on(
  "host-pin-changed",
  ({ pinned, hostId }) => {

    pinnedHostId =
      hostId || null;

    applyPinnedHost();
  }
);

// =====================================================
// HOST CONTROLS
// =====================================================

muteAll.addEventListener(
  "click",
  () => {

    if (isHost) {
      socket.emit(
        "host-mute-all"
      );
    }
  }
);

cameraOffAll.addEventListener(
  "click",
  () => {

    if (isHost) {
      socket.emit(
        "host-camera-off-all"
      );
    }
  }
);

unlockAllMic.addEventListener(
  "click",
  () => {

    if (isHost) {
      socket.emit(
        "host-unlock-all-mic"
      );
    }
  }
);

unlockAllCamera.addEventListener(
  "click",
  () => {

    if (isHost) {
      socket.emit(
        "host-unlock-all-camera"
      );
    }
  }
);

lockRoom.addEventListener(
  "click",
  () => {

    if (isHost) {
      socket.emit(
        "host-toggle-lock"
      );
    }
  }
);

// =====================================================
// FORCE MUTE
// =====================================================

socket.on(
  "force-mute",
  () => {

    if (!localStream) return;

    const track =
      localStream.getAudioTracks()[0];

    if (track) {
      track.enabled = false;
    }

    updateMeetingButtons();

    showToast(
      "Chủ phòng đã tắt mic của bạn."
    );
  }
);

// =====================================================
// FORCE CAMERA OFF
// =====================================================

socket.on(
  "force-camera-off",
  () => {

    if (!localStream) return;

    const track =
      localStream.getVideoTracks()[0];

    if (track) {
      track.enabled = false;
    }

    updateMeetingButtons();

    showToast(
      "Chủ phòng đã tắt camera của bạn."
    );
  }
);

// =====================================================
// UNLOCK
// =====================================================

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

// =====================================================
// ROOM LOCK
// =====================================================

socket.on(
  "room-lock-changed",
  ({ locked }) => {

    showToast(
      locked
        ? "🔒 Phòng đã được khóa."
        : "🔓 Phòng đã được mở khóa."
    );
  }
);

// =====================================================
// REMOVED
// =====================================================

socket.on(
  "removed-from-room",
  () => {

    cleanupMeeting();

    showToast(
      "Bạn đã bị chủ phòng đưa ra khỏi phòng."
    );
  }
);

// =====================================================
// ROOM ERROR
// =====================================================

socket.on(
  "room-error",
  ({ message }) => {

    enteringRoom = false;

    createBtn.disabled = false;
    joinBtn.disabled = false;

    if (enterMeeting) {

      enterMeeting.disabled =
        false;

      enterMeeting.textContent =
        "🚪 Vào cuộc họp";
    }

    if (invitedRoom) {

      joinBtn.textContent =
        previewReady
          ? "🚪 Vào cuộc họp"
          : "🚪 Tham gia cuộc họp";
    }

    createBtn.textContent =
      previewReady
        ? "➕ Vào phòng với tư cách chủ phòng"
        : "➕ Tạo cuộc họp mới";

    showToast(
      message ||
        "Không thể vào phòng."
    );
  }
);

// =====================================================
// ROOM LOCKED
// =====================================================

socket.on(
  "room-locked",
  ({ message }) => {

    enteringRoom = false;

    joinBtn.disabled = false;

    joinBtn.textContent =
      "🚪 Vào cuộc họp";

    if (enterMeeting) {

      enterMeeting.disabled =
        false;

      enterMeeting.textContent =
        "🚪 Vào cuộc họp";
    }

    showToast(
      message ||
        "Phòng đang bị khóa."
    );
  }
);

// =====================================================
// MEETING ENDED
// =====================================================

socket.on(
  "meeting-ended",
  () => {

    cleanupMeeting();

    showToast(
      "Cuộc họp đã kết thúc."
    );
  }
);

// =====================================================
// CLEANUP
// =====================================================

function cleanupMeeting() {

  if (screenStream) {

    screenStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    screenStream = null;
  }

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    localStream = null;
  }

  Object.values(
    peerConnections
  ).forEach(
    (pc) => {

      try {
        pc.close();
      } catch {}
    }
  );

  Object.keys(
    peerConnections
  ).forEach(
    (key) =>
      delete peerConnections[key]
  );

  Object.keys(
    pendingCandidates
  ).forEach(
    (key) =>
      delete pendingCandidates[key]
  );

  Object.keys(
    makingOffer
  ).forEach(
    (key) =>
      delete makingOffer[key]
  );

  Object.keys(
    ignoreOffer
  ).forEach(
    (key) =>
      delete ignoreOffer[key]
  );

  Object.keys(
    politePeer
  ).forEach(
    (key) =>
      delete politePeer[key]
  );

  document
    .querySelectorAll(
      ".video-tile:not(#localTile)"
    )
    .forEach(
      (tile) =>
        tile.remove()
    );

  localVideo.srcObject =
    null;

  previewVideo.srcObject =
    null;

  meeting.classList.add(
    "hidden"
  );

  home.classList.remove(
    "hidden"
  );

  prejoin.classList.add(
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

  cameraFacing = "user";

  joinBtn.disabled = false;
  createBtn.disabled = false;

  if (invitedRoom) {

    joinBtn.textContent =
      "🚪 Tham gia cuộc họp";
  }

  createBtn.textContent =
    "➕ Tạo cuộc họp mới";

  if (enterMeeting) {

    enterMeeting.disabled =
      false;

    enterMeeting.textContent =
      "🚪 Vào cuộc họp";
  }

  updatePreviewButtons();
}

// =====================================================
// RỜI PHÒNG
// =====================================================

leaveBtn.addEventListener(
  "click",
  () => {

    if (
      !confirm(
        "Bạn có chắc muốn rời phòng?"
      )
    ) {
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

// =====================================================
// SOCKET CONNECT
// =====================================================

socket.on(
  "connect",
  () => {

    console.log(
      "VMeet connected:",
      socket.id
    );
  }
);

// =====================================================
// SOCKET DISCONNECT
// =====================================================

socket.on(
  "disconnect",
  () => {

    console.log(
      "VMeet disconnected"
    );
  }
);
``
