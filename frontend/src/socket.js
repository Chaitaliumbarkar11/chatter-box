import { io } from "socket.io-client";

// AFTER:
const socket = io("https://chatter-box-1-1qc6.onrender.com", { 
  autoConnect: false
});
export default socket;