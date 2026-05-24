import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import Message from "../models/message.model.js";

/* ================= REGISTER ================= */
export const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.json({ success: false, message: "All fields required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.json({ success: false, message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, password: hashedPassword, phone });

    res.json({ success: true, message: "Registered successfully", user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Register failed" });
  }
};

/* ================= LOGIN ================= */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.json({ success: false, message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar || "", bio: user.bio || ""}
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

/* ================= UPLOAD AVATAR ================= */
export const uploadAvatar = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!req.file) return res.json({ success: false, message: "No file uploaded" });

    const user = await User.findByIdAndUpdate(userId, { avatar: `/uploads/${req.file.filename}` }, { new: true });

    res.json({ success: true, avatar: user.avatar });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Avatar upload failed" });
  }
};

export const getUserByEmail = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

export const addContact = async (req, res) => {
  try {
    const { userId, contactId } = req.body;

    if (!userId || !contactId)
      return res.json({ success: false, message: "Missing fields" });

    if (userId === contactId)
      return res.json({ success: false, message: "Cannot add yourself" });

    const user = await User.findById(userId);

    if (!user)
      return res.json({ success: false, message: "User not found" });

    // Already exists check
    if (user.contacts.includes(contactId))
      return res.json({ success: false, message: "Already added" });

    user.contacts.push(contactId);
    await user.save();

    res.json({ success: true, message: "Contact added" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, bio } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone, bio },
      { new: true }
    ).select("-password");

    res.json(updatedUser); 
  } catch (error) {
    res.status(500).json({ message: "Profile update failed" });
  }
};
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.params.userId;
    await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });
    await User.findByIdAndDelete(userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Delete account failed" });
  }
};