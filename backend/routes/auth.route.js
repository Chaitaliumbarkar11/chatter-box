import express from "express";
import { upload } from "../middleware/upload.middleware.js";
import { protect } from "../middleware/auth.middleware.js";
import Message from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { register, login, uploadAvatar, updateProfile, getUserByEmail, addContact, deleteAccount } from "../controllers/auth.controller.js";


const router = express.Router();

// ── MESSAGES ─────────────────────────────────────────────
router.get("/messages/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const messages = await Message.find({
      $or: [
        { senderId: user1, receiverId: user2 },
        { senderId: user2, receiverId: user1 },
      ],
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// ── CONTACTS ──────────────────────────────────────────────
router.get("/contacts/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate("contacts");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, contacts: user.contacts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── ADD CONTACT ───────────────────────────────────────────
router.post("/add-contact", addContact);
router.delete("/delete-account/:userId", protect, deleteAccount);


// ── DELETE ALL MESSAGES (used on logout) ─────────────────
router.delete("/deleteAllMessages/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ── AUTH ──────────────────────────────────────────────────
router.post("/register", register);
router.post("/login", login);
router.put("/update-profile", protect, updateProfile);
router.get("/user-by-email/:email", getUserByEmail);

// ── AVATAR ────────────────────────────────────────────────
router.post("/upload-avatar", upload.single("avatar"), uploadAvatar);
router.delete("/messages/:messageId", protect, async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.messageId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});
export default router;