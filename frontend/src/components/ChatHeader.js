export default function ChatHeader({ user }) {
  if (!user) return null;

  return (
    <div className="d-flex align-items-center justify-content-between p-4 border-bottom">
      <div>
        <h5 className="mb-0 text-white">{user.name}</h5>
        <small className={user.status === "online" ? "text-success" : "text-muted"}>
          {user.status}
        </small>
      </div>

      <div className="d-flex gap-3 text-muted fs-5">
        <i className="bi bi-search" />
        <i className="bi bi-three-dots-vertical" />
      </div>
    </div>
  );
}
