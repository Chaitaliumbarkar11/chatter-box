import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    // NEW: file/document sharing
    file: {
      url: { type: String, default: null },
      name: { type: String, default: null },
      size: { type: Number, default: null },
      type: { type: String, default: null }, // mime type e.g. application/pdf
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // NEW: true = message reached server (always true once saved)
    delivered: {
      type: Boolean,
      default: true,
    },
    // NEW: true = receiver has opened the chat and seen this message
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for fast conversation queries
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;