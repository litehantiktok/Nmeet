// =====================================================
// VMEET - APP.JS
// =====================================================

const socket = io();

// =====================================================
// HELPER
// =====================================================

const $ = (id) =>
  document.getElementById(id);

// =====================================================
// ELEMENTS
// =====================================================

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
const previewCameraOff =
  $("previewCameraOff");
const previewName = $("previewName");

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

const roomTitle =
  $("roomTitle");

const prejoinRoom =
  $("prejoinRoom");

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

// =====================================================
// STATE
// =====================================================

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

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const invitedRoom =
  urlParams.get("room");

// =====================================================
// WEBRTC CONFIG
// =====================================================

const configuration = {
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

// =====================================================
// TOAST
// =====================================================

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
    }, 2500);
}

// =====================================================
// MEDIA SUPPORT
// =====================================================

function hasMediaSupport() {
  return Boolean(
    navigator.mediaDevices &&
      navigator.mediaDevices
        .getUserMedia
  );
}

// =====================================================
// START PREVIEW
// =====================================================

async function startPreview() {
  if (!hasMediaSupport()) {
    showToast(
      "Trình duyệt không hỗ trợ Camera/Mic."
    );

    return false;
  }

  myName =
    String(
      nameInput?.value || ""
    ).trim();

  if (!myName) {
    showToast(
      "Vui lòng nhập tên của bạn."
    );

    nameInput?.focus();

    return false;
  }

  try {
    // Nếu chưa có stream
    if (!localStream) {
      localStream =
        await navigator.mediaDevices.getUserMedia(
          {
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
          }
        );
    }

    if (previewVideo) {
      previewVideo.srcObject =
        localStream;

      previewVideo.muted =
        true;

      previewVideo.playsInline =
        true;

      try {
        await previewVideo.play();
      } catch {}
    }

    if (previewName) {
      previewName.textContent =
        myName;
    }

    if (prejoin) {
      prejoin.classList.remove(
        "hidden"
      );
    }

    if (prejoinRoom) {
      prejoinRoom.textContent =
        invitedRoom
          ? "Phòng " +
            invitedRoom.toUpperCase()
          : "Phòng mới";
    }

    updatePreviewButtons();

    previewReady = true;

    return true;
  } catch (error) {
    console.error(
      "Camera/Mic error:",
      error
    );

    previewReady = false;

    showToast(
      "Không mở được Camera/Mic. Hãy cấp quyền Camera và Micro."
    );

    return false;
  }
}

// =====================================================
// PREVIEW BUTTONS
// =====================================================

function updatePreviewButtons() {
  if (!localStream) return;

  const audioTrack =
    localStream.getAudioTracks()[0];

  const videoTrack =
    localStream.getVideoTracks()[0];

  const micEnabled =
    audioTrack
      ? audioTrack.enabled
      : false;

  const camEnabled =
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
      camEnabled
    );

    previewCam.innerHTML =
      camEnabled
        ? "📷 <span>Camera</span>"
        : "🚫 <span>Camera</span>";
  }

  if (previewCameraOff) {
    previewCameraOff.classList.toggle(
      "hidden",
      camEnabled
    );
  }
}

// =====================================================
// PREVIEW MIC
// =====================================================

previewMic?.addEventListener(
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

// =====================================================
// PREVIEW CAMERA
// =====================================================

previewCam?.addEventListener(
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

// =====================================================
// CREATE ROOM BUTTON
// =====================================================

createBtn?.addEventListener(
  "click",
  async () => {
    if (enteringRoom) return;

    myName =
      String(
        nameInput?.value || ""
      ).trim();

    if (!myName) {
      showToast(
        "Vui lòng nhập tên của bạn."
      );

      nameInput?.focus();

      return;
    }

    // Lần đầu -> mở preview
    if (!previewReady) {
      createBtn.disabled =
        true;

      createBtn.textContent =
        "Đang mở camera...";

      const success =
        await startPreview();

      createBtn.disabled =
        false;

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

    // Lần 2 -> tạo phòng
    enterRoom(true);
  }
);

// =====================================================
// JOIN INVITED ROOM BUTTON
// =====================================================

if (invitedRoom) {
  joinInfo?.classList.remove(
    "hidden"
  );

  joinBtn?.classList.remove(
    "hidden"
  );

  joinBtn?.addEventListener(
    "click",
    async () => {
      if (enteringRoom) return;

      myName =
        String(
          nameInput?.value || ""
        ).trim();

      if (!myName) {
        showToast(
          "Vui lòng nhập tên của bạn."
        );

        nameInput?.focus();

        return;
      }

      if (!previewReady) {
        joinBtn.disabled =
          true;

        joinBtn.textContent =
          "Đang mở camera...";

        const success =
          await startPreview();

        joinBtn.disabled =
          false;

        if (!success) {
          joinBtn.textContent =
            "🚪 Tham gia cuộc họp";

          return;
        }

        joinBtn.textContent =
          "🚪 Vào cuộc họp";

        showToast(
          "Kiểm tra Camera và Mic trước khi vào."
        );

        return;
      }

      enterRoom(false);
    }
  );
}

// =====================================================
// ENTER ROOM
// =====================================================

function enterRoom(create) {
  if (enteringRoom) return;

  if (!localStream) {
    showToast(
      "Camera chưa sẵn sàng."
    );

    return;
  }

  myName =
    String(
      nameInput?.value || ""
    ).trim();

  if (!myName) {
    showToast(
      "Vui lòng nhập tên của bạn."
    );

    return;
  }

  enteringRoom = true;

  if (create) {
    if (createBtn) {
      createBtn.disabled =
        true;

      createBtn.textContent =
        "Đang tạo cuộc họp...";
    }
  } else {
    if (joinBtn) {
      joinBtn.disabled =
        true;

      joinBtn.textContent =
        "Đang vào phòng...";
    }
  }

  if (enterMeeting) {
    enterMeeting.disabled =
      true;

    enterMeeting.textContent =
      "Đang vào cuộc họp...";
  }

  socket.emit(
    "join-room",
    {
      room:
        create
          ? ""
          : invitedRoom,

      name: myName,

      create
    }
  );
}

// =====================================================
// PREJOIN ENTER BUTTON
// =====================================================

enterMeeting?.addEventListener(
  "click",
  () => {
    if (enteringRoom) return;

    myName =
      String(
        nameInput?.value || ""
      ).trim();

    if (!myName) {
      showToast(
        "Vui lòng nhập tên của bạn."
      );

      return;
    }

    if (
      !previewReady ||
      !localStream
    ) {
      showToast(
        "Camera chưa sẵn sàng."
      );

      return;
    }

    // Link có room -> tham gia
    if (invitedRoom) {
      enterRoom(false);
    } else {
      // Không có room -> tạo
      enterRoom(true);
    }
  }
);

// =====================================================
// CANCEL PREJOIN
// =====================================================

cancelPrejoin?.addEventListener(
  "click",
  () => {
    prejoin?.classList.add(
      "hidden"
    );

    enteringRoom = false;

    if (createBtn) {
      createBtn.disabled =
        false;

      createBtn.textContent =
        previewReady
          ? "➕ Vào phòng với tư cách chủ phòng"
          : "➕ Tạo cuộc họp mới";
    }

    if (joinBtn) {
      joinBtn.disabled =
        false;

      joinBtn.textContent =
        previewReady
          ? "🚪 Vào cuộc họp"
          : "🚪 Tham gia cuộc họp";
    }

    if (enterMeeting) {
      enterMeeting.disabled =
        false;

      enterMeeting.textContent =
        "🚪 Vào cuộc họp";
    }
  }
);

// =====================================================
// ROOM JOINED
// =====================================================

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
      isHost
        ? socket.id
        : data.hostId || null;

    home?.classList.add(
      "hidden"
    );

    prejoin?.classList.add(
      "hidden"
    );

    meeting?.classList.remove(
      "hidden"
    );

    if (roomTitle) {
      roomTitle.textContent =
        "Phòng " + roomId;
    }

    if (localName) {
      localName.textContent =
        myName;
    }

    if (localTile) {
      localTile.dataset.userId =
        socket.id;
    }

    if (localVideo && localStream) {
      localVideo.srcObject =
        localStream;

      localVideo.muted =
        true;

      localVideo.playsInline =
        true;

      try {
        await localVideo.play();
      } catch {}
    }

    if (isHost) {
      localHostBadge?.classList.remove(
        "hidden"
      );

      hostControls?.classList.remove(
        "hidden"
      );
    } else {
      localHostBadge?.classList.add(
        "hidden"
      );

      hostControls?.classList.add(
        "hidden"
      );
    }

    updateMeetingButtons();

    createShareLink();

    updateLocalCameraOverlay();

    enteringRoom = false;

    if (createBtn) {
      createBtn.disabled =
        false;
    }

    if (joinBtn) {
      joinBtn.disabled =
        false;
    }

    if (enterMeeting) {
      enterMeeting.disabled =
        false;

      enterMeeting.textContent =
        "🚪 Vào cuộc họp";
    }

    showToast(
      isHost
        ? "Đã tạo cuộc họp."
        : "Đã tham gia cuộc họp."
    );
  }
);

// =====================================================
// SHARE LINK
// =====================================================

function createShareLink() {
  if (!roomId) return;

  const url =
    window.location.origin +
    "?room=" +
    encodeURIComponent(
      roomId
    );

  try {
    history.replaceState(
      null,
      "",
      "?room=" +
        encodeURIComponent(
          roomId
        )
    );
  } catch {}

  if (copyBtn) {
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
}

// =====================================================
// PARTICIPANTS
// =====================================================

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

    if (host) {
      pinnedHostId =
        host.id;
    }

    applyPinnedHost();
  }
);

// =====================================================
// UPDATE PARTICIPANTS
// =====================================================

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

      const name =
        document.createElement(
          "span"
        );

      name.textContent =
        user.name +
        (user.isHost
          ? " 👑"
          : "");

      row.appendChild(name);

      // HOST CONTROLS
      if (
        isHost &&
        user.id !== socket.id
      ) {
        const mute =
          document.createElement(
            "button"
          );

        mute.textContent =
          "🔇";

        mute.title =
          "Tắt mic";

        mute.type =
          "button";

        mute.onclick =
          () => {
            socket.emit(
              "host-mute-user",
              {
                userId:
                  user.id
              }
            );
          };

        const cam =
          document.createElement(
            "button"
          );

        cam.textContent =
          "📷";

        cam.title =
          "Tắt camera";

        cam.type =
          "button";

        cam.onclick =
          () => {
            socket.emit(
              "host-camera-off",
              {
                userId:
                  user.id
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

        remove.type =
          "button";

        remove.onclick =
          () => {
            const ok =
              window.confirm(
                "Bạn có chắc muốn đuổi người này?"
              );

            if (!ok) return;

            socket.emit(
              "host-remove-user",
              {
                userId:
                  user.id
              }
            );
          };

        row.appendChild(mute);
        row.appendChild(cam);
        row.appendChild(remove);
      }

      participantsList.appendChild(
        row
      );
    }
  );
}

// =====================================================
// CREATE PEER CONNECTION
// =====================================================

function createPeerConnection(
  remoteId
) {
  if (
    peerConnections[remoteId]
  ) {
    return peerConnections[
      remoteId
    ];
  }

  const pc =
    new RTCPeerConnection(
      configuration
    );

  peerConnections[remoteId] =
    pc;

  pendingCandidates[
    remoteId
  ] = [];

  // -----------------------------
  // ADD LOCAL TRACKS
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

      if (!stream) return;

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
        "Connection:",
        remoteId,
        pc.connectionState
      );

      if (
        [
          "failed",
          "closed",
          "disconnected"
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

// =====================================================
// CREATE REMOTE VIDEO
// =====================================================

function createRemoteVideo(
  userId,
  stream
) {
  if (!videos) return;

  // FIX QUAN TRỌNG:
  // Phải dùng backtick ở selector.
  let tile =
    document.querySelector(
      `[data-user-id="${CSS.escape(
        userId
      )}"]`
    );

  // Nếu chưa có tile
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

    video.autoplay =
      true;

    video.playsInline =
      true;

    tile.appendChild(
      video
    );

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
    video &&
    video.srcObject !==
      stream
  ) {
    video.srcObject =
      stream;
  }

  if (video) {
    video.play().catch(
      () => {}
    );
  }

  applyPinnedHost();
}

// =====================================================
// APPLY PINNED HOST
// =====================================================

function applyPinnedHost() {
  if (!videos) return;

  // Nếu chưa có host
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

  const tiles =
    videos.querySelectorAll(
      ".video-tile"
    );

  tiles.forEach(
    (tile) => {
      const id =
        tile.dataset.userId;

      const badge =
        tile.querySelector(
          ".pinned-badge"
        );

      if (
        id === pinnedHostId
      ) {
        tile.classList.add(
          "pinned-tile"
        );

        badge?.classList.remove(
          "hidden"
        );

        videos.insertBefore(
          tile,
          thumbWrapper
        );
      } else {
        tile.classList.remove(
          "pinned-tile"
        );

        badge?.classList.add(
          "hidden"
        );

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

  applyPinnedHost();
}

// =====================================================
// USER JOINED
// =====================================================

socket.on(
  "user-joined",
  async (user) => {
    if (
      !user ||
      !user.id
    ) {
      return;
    }

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
            type: "offer",

            offer:
              pc.localDescription
          }
        }
      );
    } catch (error) {
      console.error(
        "Offer error:",
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
  async ({
    from,
    data
  } = {}) => {
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

        await flushCandidates(
          from
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
          pc.remoteDescription
        ) {
          await pc.addIceCandidate(
            candidate
          );
        } else {
          if (
            !pendingCandidates[
              from
            ]
          ) {
            pendingCandidates[
              from
            ] = [];
          }

          pendingCandidates[
            from
          ].push(
            candidate
          );
        }
      }
    } catch (error) {
      console.error(
        "WebRTC error:",
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
    peerConnections[
      remoteId
    ];

  if (!pc) return;

  const list =
    pendingCandidates[
      remoteId
    ] || [];

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

  pendingCandidates[
    remoteId
  ] = [];
}

// =====================================================
// USER LEFT
// =====================================================

socket.on(
  "user-left",
  ({ id } = {}) => {
    if (!id) return;

    removeRemoteVideo(
      id
    );
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

  localCameraOff?.classList.toggle(
    "hidden",
    enabled
  );
}

// =====================================================
// MEETING BUTTONS
// =====================================================

function updateMeetingButtons() {
  if (!localStream) return;

  const audioTrack =
    localStream.getAudioTracks()[0];

  const videoTrack =
    localStream.getVideoTracks()[0];

  if (
    audioTrack &&
    micBtn
  ) {
    micBtn.firstChild.textContent =
      audioTrack.enabled
        ? "🎤 "
        : "🔇 ";
  }

  if (
    videoTrack &&
    camBtn
  ) {
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

micBtn?.addEventListener(
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

camBtn?.addEventListener(
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

    updateMeetingButtons();

    showToast(
      track.enabled
        ? "Đã bật camera."
        : "Đã tắt camera."
    );
  }
);

// =====================================================
// SWITCH CAMERA
// =====================================================

switchCameraBtn?.addEventListener(
  "click",
  async () => {
    if (!localStream) return;

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
        await navigator.mediaDevices.getUserMedia(
          {
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

            audio: false
          }
        );

      const newTrack =
        newStream.getVideoTracks()[0];

      if (!newTrack) {
        throw new Error(
          "Không có camera"
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

      if (localVideo) {
        localVideo.srcObject =
          localStream;
      }

      // Thay camera trong WebRTC
      for (
        const pc of Object.values(
          peerConnections
        )
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
        "Switch camera:",
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

// =====================================================
// SCREEN SHARE
// =====================================================

screenBtn?.addEventListener(
  "click",
  async () => {
    if (screenStream) {
      await stopScreenShare();

      return;
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices
        .getDisplayMedia
    ) {
      showToast(
        "Thiết bị/trình duyệt không hỗ trợ chia sẻ màn hình."
      );

      return;
    }

    try {
      screenStream =
        await navigator.mediaDevices.getDisplayMedia(
          {
            video: true,
            audio: false
          }
        );

      const screenTrack =
        screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        throw new Error(
          "Không có screen track"
        );
      }

      if (localVideo) {
        localVideo.srcObject =
          screenStream;
      }

      for (
        const pc of Object.values(
          peerConnections
        )
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

      if (screenBtn.firstChild) {
        screenBtn.firstChild.textContent =
          "⏹️ ";
      }

      showToast(
        "Đang chia sẻ màn hình."
      );
    } catch (error) {
      console.error(
        "Screen share:",
        error
      );

      screenStream =
        null;

      showToast(
        "Không thể chia sẻ màn hình."
      );
    }
  }
);

// =====================================================
// STOP SCREEN SHARE
// =====================================================

async function stopScreenShare() {
  if (!screenStream) return;

  screenStream
    .getTracks()
    .forEach(
      (track) => {
        track.stop();
      }
    );

  screenStream =
    null;

  if (
    localVideo &&
    localStream
  ) {
    localVideo.srcObject =
      localStream;
  }

  const cameraTrack =
    localStream
      ? localStream.getVideoTracks()[0]
      : null;

  if (cameraTrack) {
    for (
      const pc of Object.values(
        peerConnections
      )
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

  if (
    screenBtn?.firstChild
  ) {
    screenBtn.firstChild.textContent =
      "🖥️ ";
  }
}

// =====================================================
// CHAT
// =====================================================

chatBtn?.addEventListener(
  "click",
  () => {
    chatPanel?.classList.toggle(
      "hidden"
    );

    if (
      chatPanel &&
      !chatPanel.classList.contains(
        "hidden"
      )
    ) {
      chatInput?.focus();
    }
  }
);

closeChat?.addEventListener(
  "click",
  () => {
    chatPanel?.classList.add(
      "hidden"
    );
  }
);

chatForm?.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    const text =
      String(
        chatInput?.value || ""
      ).trim();

    if (!text) return;

    socket.emit(
      "chat",
      {
        text
      }
    );

    if (chatInput) {
      chatInput.value =
        "";
    }
  }
);

socket.on(
  "chat",
  ({ name, text } = {}) => {
    if (!messages) return;

    const message =
      document.createElement(
        "div"
      );

    message.className =
      "msg";

    message.textContent =
      `${name || "Khách"}: ${
        text || ""
      }`;

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

participantsBtn?.addEventListener(
  "click",
  () => {
    participantsPanel?.classList.toggle(
      "hidden"
    );
  }
);

closeParticipants?.addEventListener(
  "click",
  () => {
    participantsPanel?.classList.add(
      "hidden"
    );
  }
);

// =====================================================
// HOST CONTROLS
// =====================================================

pinHost?.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-toggle-pin"
    );
  }
);

muteAll?.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-mute-all"
    );
  }
);

cameraOffAll?.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-camera-off-all"
    );
  }
);

unlockAllMic?.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-unlock-all-mic"
    );
  }
);

unlockAllCamera?.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-unlock-all-camera"
    );
  }
);

lockRoom?.addEventListener(
  "click",
  () => {
    if (!isHost) return;

    socket.emit(
      "host-toggle-lock"
    );
  }
);

// =====================================================
// HOST PIN CHANGED
// =====================================================

socket.on(
  "host-pin-changed",
  ({
    pinned,
    hostId
  } = {}) => {
    pinnedHostId =
      pinned
        ? hostId
        : null;

    applyPinnedHost();
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
      track.enabled =
        false;
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
      track.enabled =
        false;
    }

    updateMeetingButtons();

    showToast(
      "Chủ phòng đã tắt camera của bạn."
    );
  }
);

// =====================================================
// UNLOCK MIC
// =====================================================

socket.on(
  "unlock-mic",
  () => {
    showToast(
      "Chủ phòng đã cho phép bật mic."
    );
  }
);

// =====================================================
// UNLOCK CAMERA
// =====================================================

socket.on(
  "unlock-camera",
  () => {
    showToast(
      "Chủ phòng đã cho phép bật camera."
    );
  }
);

// =====================================================
// ROOM LOCK CHANGED
// =====================================================

socket.on(
  "room-lock-changed",
  ({ locked } = {}) => {
    showToast(
      locked
        ? "🔒 Phòng đã được khóa."
        : "🔓 Phòng đã được mở khóa."
    );
  }
);

// =====================================================
// ROOM LOCKED
// =====================================================

socket.on(
  "room-locked",
  ({ message } = {}) => {
    enteringRoom =
      false;

    if (joinBtn) {
      joinBtn.disabled =
        false;

      joinBtn.textContent =
        "🚪 Vào cuộc họp";
    }

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
// ROOM ERROR
// =====================================================

socket.on(
  "room-error",
  ({ message } = {}) => {
    console.error(
      "Room error:",
      message
    );

    enteringRoom =
      false;

    if (createBtn) {
      createBtn.disabled =
        false;

      createBtn.textContent =
        previewReady
          ? "➕ Vào phòng với tư cách chủ phòng"
          : "➕ Tạo cuộc họp mới";
    }

    if (joinBtn) {
      joinBtn.disabled =
        false;

      joinBtn.textContent =
        previewReady
          ? "🚪 Vào cuộc họp"
          : "🚪 Tham gia cuộc họp";
    }

    if (enterMeeting) {
      enterMeeting.disabled =
        false;

      enterMeeting.textContent =
        "🚪 Vào cuộc họp";
    }

    showToast(
      message ||
        "Không thể vào phòng."
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
  // Screen
  if (screenStream) {
    screenStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    screenStream =
      null;
  }

  // Camera + mic
  if (localStream) {
    localStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    localStream =
      null;
  }

  // Peers
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
    (key) => {
      delete peerConnections[
        key
      ];
    }
  );

  Object.keys(
    pendingCandidates
  ).forEach(
    (key) => {
      delete pendingCandidates[
        key
      ];
    }
  );

  // Remote videos
  document
    .querySelectorAll(
      ".video-tile"
    )
    .forEach(
      (tile) => {
        if (
          tile !== localTile
        ) {
          tile.remove();
        }
      }
    );

  if (localVideo) {
    localVideo.srcObject =
      null;
  }

  if (previewVideo) {
    previewVideo.srcObject =
      null;
  }

  meeting?.classList.add(
    "hidden"
  );

  home?.classList.remove(
    "hidden"
  );

  prejoin?.classList.add(
    "hidden"
  );

  participantsPanel?.classList.add(
    "hidden"
  );

  chatPanel?.classList.add(
    "hidden"
  );

  roomId =
    null;

  isHost =
    false;

  previewReady =
    false;

  enteringRoom =
    false;

  pinnedHostId =
    null;

  participants =
    [];

  cameraFacing =
    "user";

  if (createBtn) {
    createBtn.disabled =
      false;

    createBtn.textContent =
      "➕ Tạo cuộc họp mới";
  }

  if (joinBtn) {
    joinBtn.disabled =
      false;

    joinBtn.textContent =
      "🚪 Tham gia cuộc họp";
  }

  if (enterMeeting) {
    enterMeeting.disabled =
      false;

    enterMeeting.textContent =
      "🚪 Vào cuộc họp";
  }

  // Xóa room khỏi URL
  try {
    history.replaceState(
      null,
      "",
      window.location.pathname
    );
  } catch {}
}

// =====================================================
// LEAVE
// =====================================================

leaveBtn?.addEventListener(
  "click",
  () => {
    const ok =
      window.confirm(
        "Bạn có chắc muốn rời phòng?"
      );

    if (!ok) return;

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

// =====================================================
// INITIAL STATE
// =====================================================

console.log(
  "VMeet app.js loaded."
);

if (invitedRoom) {
  console.log(
    "Invited room:",
    invitedRoom
  );
}
