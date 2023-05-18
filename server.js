const express = require("express");
const app = express();
// const cors = require('cors')
// app.use(cors())
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { ExpressPeerServer } = require("peer");
const peerServer = ExpressPeerServer(server, {
  debug: true,
});
const { v4: uuidV4 } = require("uuid");

app.use("/peerjs", peerServer);

app.set("view engine", "ejs");
app.use(express.static("public"));

const rooms = [
  "75cf7c66",
  "75cf7f7c",
  "75cf80e4",
  "75cf865c",
  "75cf87d8",
  "75cf8936",
  "75cf8ae4",
  "75cf8c24",
  "75cf8d50",
  "75cf8e86",
];

// Object to keep track of the number of users in each room
const usersInRooms = {};

// Object to keep track of skipped users in each room
const skippedUsers = {};

// Initialize the number of users in each room to 0
rooms.forEach((room) => {
  usersInRooms[room] = 0;
  skippedUsers[room] = [];
});

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  let randomRoom = null;
  // Check if there is any room with one user, if yes then join that room
  const roomWithOneUser = Object.keys(usersInRooms).find(
    (room) => usersInRooms[room] === 1 && skippedUsers[room].length === 0
  );
  if (roomWithOneUser) {
    randomRoom = roomWithOneUser;
  } else {
    // If no room has one user, then join a random room
    randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
  }
  res.redirect(`/${randomRoom}`);
});

app.get("/:room", (req, res) => {
  const roomId = req.params.room;
  const numUsers = usersInRooms[roomId];
  if (numUsers < 2 && skippedUsers[roomId].length === 0) {
    res.render("room", { roomId });
  } else {
    res.redirect("/");
  }
});

app.get("/home", (req, res) => {
  res.render("index");
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId, callback) => {
    if (usersInRooms[roomId] < 2 && skippedUsers[roomId].length === 0) {
      socket.join(roomId);
      usersInRooms[roomId]++;
      if (usersInRooms[roomId] === 1) {
        socket.emit("waiting");
      } else if (usersInRooms[roomId] === 2) {
        io.to(roomId).emit("ready");
      }
      socket.to(roomId).broadcast.emit("user-connected", userId);
      socket.on("disconnect", () => {
        usersInRooms[roomId]--;
        socket.to(roomId).broadcast.emit("user-disconnected", userId);
        if (usersInRooms[roomId] === 1) {
          io.to(roomId).emit("waiting");
        }
      });
    } else {
      // Room already full or user skipped
      callback("Room is full");
    }
    socket.on("video-state", (roomId, videoEnabled) => {
      socket
        .to(roomId)
        .broadcast.emit("video-state-changed", userId, videoEnabled);
    });

    socket.on("send-message", (roomId, message) => {
      socket.to(roomId).broadcast.emit("receive-message", userId, message);
    });

    socket.on("mic-state-changed", (userId, micEnabled) => {
      const videoElement = document.querySelector(
        `video[data-user-id="${userId}"]`
      );
      if (videoElement) {
        videoElement.srcObject.getAudioTracks()[0].enabled = micEnabled;
      }
    });

    // ...
  });

  socket.on("skip", (roomId) => {
    if (roomId && usersInRooms[roomId] > 0 && usersInRooms[roomId] < 2) {
      const skippedUserId = socket.id;
      skippedUsers[roomId].push(skippedUserId);
      socket.leave(roomId);
      usersInRooms[roomId]--;

      // Emit "user-skipped" event to the room
      io.to(roomId).emit("user-skipped", skippedUserId);
    }
  });
});

server.listen(process.env.PORT || 3030);
