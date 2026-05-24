export default function MessageInput({ message, setMessage, sendMessage }) {
  return (
    <div className="p-4 border-top">
      <div className="input-group">
        <input
          className="form-control bg-dark text-white border-0"
          placeholder="Type message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          className="btn btn-primary"
          disabled={!message.trim()}
          onClick={sendMessage}
        >
          <i className="bi bi-send-fill" />
        </button>
      </div>
    </div>
  );
}
