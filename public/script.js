const socket = io("/");
const videoGrid = document.getElementById("video-grid");
const myPeer = new Peer(undefined, {
  path: "/peerjs",
  host: "/",
  port: "443",
});
const myVideo = document.createElement("video");
myVideo.muted = true;
const peers = {};
const roomId = window.location.pathname.split("/")[1];

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    addVideoStream(myVideo, stream);
    //startVideo();

    myPeer.on("call", (call) => {
      call.answer(stream);
      const video = document.createElement("video");
      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
    });

    socket.on("user-connected", (userId) => {
      connectToNewUser(userId, stream);
    });

    socket.on("user-disconnected", (userId) => {
      if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];

        const disconnectPopup = document.getElementById("disconnect-popup");
        disconnectPopup.style.display = "block";
      }
    });

    socket.on("waiting", () => {
      // Display the waiting popup
      const waitingPopup = document.getElementById("popup-background");
      waitingPopup.style.display = "none";
    });

    socket.on("ready", () => {
      // Remove the waiting popup
      const waitingPopup = document.getElementById("popup-background");
      waitingPopup.style.display = "none";
    });

    socket.on("room-full", () => {
      alert("Sorry, the room is already full or you have been skipped.");
      window.location.href = "/";
    });

    socket.emit("join-room", roomId, myPeer.id, (error) => {
      if (error) {
        alert(error);
        window.location.href = "/";
      } else {
        if (socket.skipped) {
          // User skipped, reload page
          window.location.reload();
        } else {
          if (myPeer.disconnected) {
            myPeer.reconnect();
          }
          if (myPeer.destroyed) {
            myPeer.reconnect();
            location.reload();
          }
          if (socket.disconnected) {
            socket.reconnect();
          }
          if (socket.destroyed) {
            socket.reconnect();
            location.reload();
          }
          if (myPeer.disconnected && myPeer.destroyed) {
            myPeer.reconnect();
          }
          if (socket.disconnected && socket.destroyed) {
            socket.reconnect();
          }
          if (myPeer.disconnected && socket.disconnected) {
            myPeer.reconnect();
            socket.reconnect();
          }
          if (myPeer.destroyed && socket.destroyed) {
            myPeer.reconnect();
            socket.reconnect();
          }
          if (myPeer.disconnected && myPeer.destroyed && socket.disconnected) {
            myPeer.reconnect();
            socket.reconnect();
          }
          if (
            myPeer.disconnected &&
            myPeer.destroyed &&
            socket.disconnected &&
            socket.destroyed
          ) {
            myPeer.reconnect();
            socket.reconnect();
          }
        }
        startCall(stream);
      }
    });
  });

let userCount = 1;

function startCall(stream) {
  const call = myPeer.call(roomId, stream);
  const video = document.createElement("video");
  const userId = `user${userCount}`;
  video.setAttribute("id", userId);
  userCount++;
  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });
  call.on("close", () => {
    video.remove();
  });

  peers[roomId] = call;
}

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement("video");
  const newUserId = `user${userCount}`;
  video.setAttribute("id", newUserId);
  userCount++;
  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });
  call.on("close", () => {
    video.remove();
  });

  peers[userId] = call;
}

const canvasMap = new Map(); // Map to store canvas elements for each video stream

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
    resizeCanvas(video); // Resize the canvas when video metadata is loaded
  });

  //const isLocalUser = video === myVideo; // Check if it's the local user's video stream

  //if (isLocalUser) {
  //video.style.transform = "scale(0.33)"; // Scale down the local user's video by 1/3
  //}

  video.setAttribute("id", `user${userCount}`);
  userCount++;
  videoGrid.append(video);
  if (!canvasMap.has(video)) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    videoGrid.append(canvas);
    canvasMap.set(video, { canvas, context });

    // Start face detection for the new video element
    startVideo(video, canvas, context);
  }
}

function startVideo(video, canvas, context) {
  Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  ]).then(() => {
    setInterval(async () => {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      resizeCanvas(video); // Resize the canvas based on the video element

      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background triangles
      const ctx = canvas.getContext("2d");
      const blueColor = "rgba(0, 128, 255, 0.5)"; // Blue color with 50% opacity

      ctx.fillStyle = blueColor;

      detections.forEach((detection) => {
        const resizedDetection = faceapi.resizeResults(
          detection,
          video.getBoundingClientRect()
        );

        const landmarks = resizedDetection.landmarks;
        const points = landmarks.positions;

        for (let i = 0; i < points.length; i++) {
          const pointA = points[i];

          for (let j = i + 1; j < points.length; j++) {
            const pointB = points[j];

            for (let k = j + 1; k < points.length; k++) {
              const pointC = points[k];

              ctx.beginPath();
              ctx.moveTo(pointA.x, pointA.y);
              ctx.lineTo(pointB.x, pointB.y);
              ctx.lineTo(pointC.x, pointC.y);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      });

      // Draw bounding boxes, landmarks, and expressions
      detections.forEach((detection) => {
        const resizedDetection = faceapi.resizeResults(
          detection,
          video.getBoundingClientRect()
        );
        faceapi.draw.drawDetections(canvas, [resizedDetection]);
        faceapi.draw.drawFaceLandmarks(canvas, [resizedDetection]);
        faceapi.draw.drawFaceExpressions(canvas, [resizedDetection]);
      });
    }, 100);
  });
}

function resizeCanvas(video) {
  const { canvas, context } = canvasMap.get(video);

  // Set the canvas dimensions to match the video content
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  canvas.width = videoWidth;
  canvas.height = videoHeight;

  // Position the canvas over the video element
  canvas.style.position = "absolute";
  canvas.style.top = `${video.offsetTop}px`;
  canvas.style.left = `${video.offsetLeft}px`;

  // Adjust the scale of the canvas context to match the video dimensions
  const scale = video.offsetWidth / video.videoWidth;
  context.scale(scale, scale);
}

// Function to skip to a new room
function skipToNewRoom() {
  const roomId = window.location.pathname.split("/")[1];
  socket.emit("skip", roomId);
  socket.skipped = true;
  window.location.href = "/";
}

socket.on("user-skipped", (userId) => {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];

    // Remove the video grid element associated with the skipped user
    const videoGrid = document.getElementById("video-grid");
    const videoElement = videoGrid.querySelector(`[data-user-id="${userId}"]`);
    if (videoElement) {
      videoElement.remove();
    }
  }
});

function enableMic() {
  myVideo.srcObject.getAudioTracks()[0].enabled = true;
  socket.emit("mic-state", roomId, true); // Emit mic-state event with mic enabled
}

function disableMic() {
  myVideo.srcObject.getAudioTracks()[0].enabled = false;
  socket.emit("mic-state", roomId, false); // Emit mic-state event with mic disabled
}

function sendMessage() {
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value;
  messageInput.value = ""; // Clear the input field
  socket.emit("send-message", roomId, message);
}

// ...

socket.on("receive-message", (userId, message) => {
  const messageContainer = document.createElement("div");
  messageContainer.innerText = `${userId}: ${message}`;
  document.getElementById("message-container").appendChild(messageContainer);
});

// ...

function enableVideo() {
  myVideo.srcObject.getVideoTracks()[0].enabled = true;
  socket.emit("video-state", roomId, true); // Emit video-state event with video enabled
}

function disableVideo() {
  myVideo.srcObject.getVideoTracks()[0].enabled = false;
  socket.emit("video-state", roomId, false); // Emit video-state event with video disabled
}

socket.on("video-state-changed", (userId, videoEnabled) => {
  const videoElement = document.querySelector(
    `video[data-user-id="${userId}"]`
  );
  if (videoElement) {
    videoElement.srcObject.getVideoTracks()[0].enabled = videoEnabled;
  }
});

// Add event listeners for the filter buttons
const addFilterButton = document.getElementById("add-filter-button");
const removeFilterButton = document.getElementById("remove-filter-button");

addFilterButton.addEventListener("click", () => {
  socket.emit("add-filter");
});

removeFilterButton.addEventListener("click", () => {
  socket.emit("remove-filter");
});
