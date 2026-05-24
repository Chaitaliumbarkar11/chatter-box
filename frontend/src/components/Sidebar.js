export default function Sidebar({ users, selectedUser, setSelectedUser }) {
  return (
    <div className="h-100"
      style={{
        background: "linear-gradient(180deg,#1a0f2e,#0d0b1a)",
        borderRight: "1px solid rgba(255,79,216,0.2)"
      }}
    >
      <div className="p-4 border-bottom">
        <h5 className="fw-bold text-white">Contacts</h5>
        <input
          className="form-control mt-2 bg-dark text-white border-0"
          placeholder="Search..."
        />
      </div>

      <div className="list-group list-group-flush">
        {users.map(user => (
          <button
            key={user.id}
            onClick={() => setSelectedUser(user)}
            className={`list-group-item list-group-item-action border-0 ${
              selectedUser?.id === user.id ? "active" : ""
            }`}
            style={{
              background: selectedUser?.id === user.id
                ? "linear-gradient(135deg,rgba(255,79,216,0.4),rgba(168,85,247,0.3))"
                : "transparent",
              color: "white"
            }}
          >
            <strong>{user.name}</strong>
            <br />
            <small className="text-muted">{user.lastMessage}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
