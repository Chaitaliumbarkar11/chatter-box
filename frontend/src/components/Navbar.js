export default function Navbar() {
  return (
    <nav className="navbar navbar-dark px-4 py-3 border-bottom"
      style={{
        background: "linear-gradient(90deg,#1a0f2e,#2d1b4a)",
        position: "sticky",
        top: 0,
        zIndex: 1000
      }}
    >
      <span className="fw-bold fs-4"
        style={{
          background: "linear-gradient(135deg,#ff4fd8,#a855f7,#3b82f6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        💬 TAPTIK
      </span>

      <div className="d-flex gap-2">
        <button className="btn btn-outline-light btn-sm rounded-pill">
          👤 Profile
        </button>
        <button className="btn btn-outline-danger btn-sm rounded-pill">
          🚪 Logout
        </button>
      </div>
    </nav>
  );
}
