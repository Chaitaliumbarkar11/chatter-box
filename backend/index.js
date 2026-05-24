import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/auth.route.js";
import { connectDB } from "./db.js";
import { Server } from "socket.io";
import Message from "./models/message.model.js";
import { User } from "./models/user.model.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "DELETE", "PUT"],
  },
});

connectDB();

const onlineUsers = new Map(); // userId -> socketId

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "DELETE", "PUT"],
  })
);
app.use(express.json({ limit: "20mb" })); // increased for file sharing
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use("/api/auth", routes);

// ─────────────────────────────────────────────
// SERVE UPLOADED AVATARS & FILES
// ─────────────────────────────────────────────
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  // ── JOIN (user comes online) ──────────────────
  socket.on("join", async (userId) => {
    socket.userId = String(userId);
    onlineUsers.set(socket.userId, socket.id);
    socket.join(socket.userId); // personal room

    // Tell this user who is already online
    socket.emit("online_users", Array.from(onlineUsers.keys()));

    // Tell everyone else this user is now online
    socket.broadcast.emit("status_change", {
      userId: socket.userId,
      status: "online",
    });

    console.log("✅ User joined:", socket.userId);
  });

  // ── JOIN CHAT ROOM ────────────────────────────
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });

  // ── LOAD MESSAGES ─────────────────────────────
  socket.on("get_messages", async ({ userId, otherUserId }) => {
    try {
      const messages = await Message.find({
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("replyTo")
        .lean();

      socket.emit("chat_history", messages.reverse());

      // ── MARK AS READ: all messages sent by otherUserId to userId ──
      const unreadIds = messages
        .filter(
          (m) =>
            String(m.senderId) === String(otherUserId) &&
            String(m.receiverId) === String(userId) &&
            !m.read
        )
        .map((m) => m._id);

      if (unreadIds.length > 0) {
        await Message.updateMany(
          { _id: { $in: unreadIds } },
          { $set: { read: true } }
        );

        // Notify sender that their messages were read
        const senderSocketId = onlineUsers.get(String(otherUserId));
        if (senderSocketId) {
          io.to(senderSocketId).emit("messages_read", {
            byUserId: String(userId),
            messageIds: unreadIds.map(String),
          });
        }
      }
    } catch (error) {
      console.log("❌ Get Messages Error:", error);
    }
  });

  // ── SEND MESSAGE (with ack callback) ──────────
  socket.on("send_message", async (msg, callback) => {
    try {
      const hasText = msg.text?.trim();
      const hasImage = msg.image;
      const hasFile = msg.file?.url;

      if (!hasText && !hasImage && !hasFile) return;

      const newMessage = await Message.create({
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        text: msg.text || "",
        image: msg.image || null,
        file: msg.file || { url: null, name: null, size: null, type: null },
        replyTo: msg.replyTo || null,
        delivered: true,
        read: false,
      });

      await newMessage.populate("replyTo");

      const formattedMessage = {
        ...newMessage._doc,
        time: new Date(newMessage.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      // Send to room (other user in chat)
      if (msg.roomId) {
        socket.to(msg.roomId).emit("receive_message", formattedMessage);
      }


      if (typeof callback === "function") {
        callback(formattedMessage);
      }
    } catch (error) {
      console.log("❌ Message Error:", error);
      if (typeof callback === "function") callback(null);
    }
  });
socket.on("status_change", ({ userId, status }) => {
  socket.broadcast.emit("status_change", { userId, status });
});
  // ── MARK MESSAGES AS READ ──────────────────────
  // Client emits this when user opens a chat
  socket.on("mark_read", async ({ senderId, receiverId }) => {
    try {
      const result = await Message.updateMany(
        { senderId: senderId, receiverId: receiverId, read: false },
        { $set: { read: true } }
      );

      if (result.modifiedCount > 0) {
        // Tell the original sender their messages are now read
        const senderSocketId = onlineUsers.get(String(senderId));
        if (senderSocketId) {
          io.to(senderSocketId).emit("messages_read", {
            byUserId: String(receiverId),
            senderId: String(senderId),
          });
        }
      }
    } catch (error) {
      console.log("❌ Mark Read Error:", error);
    }
  });

  // ── TYPING ────────────────────────────────────
  socket.on("typing", ({ to, typing }) => {
    io.to(String(to)).emit("typing", {
      userId: socket.userId,
      typing,
    });
  });

  // ── DISCONNECT ────────────────────────────────
  socket.on("disconnect", async () => {
    if (socket.userId) {
      // Save lastSeen timestamp to DB
      try {
        await User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() });
      } catch (_) {}

      onlineUsers.delete(socket.userId);
      io.emit("status_change", {
        userId: socket.userId,
        status: "offline",
        lastSeen: new Date().toISOString(),
      });
      console.log("🔴 Disconnected:", socket.userId);
    }
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});