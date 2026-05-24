import { useState } from "react";

const AddContact = ({ setUsers, users }) => {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("user"));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const { email } = formData;
    if (!email) return setError("Email is required");

    setLoading(true);

    try {
      // 1. Look up user by email
      const res = await fetch(
        `http://localhost:5001/api/auth/user-by-email/${email}`
      );
      const data = await res.json();

      if (!data.success) {
        setError("No user found with that email.");
        setLoading(false);
        return;
      }

      if (String(data.user._id) === String(currentUser._id)) {
        setError("You cannot add yourself as a contact.");
        setLoading(false);
        return;
      }

      // 2. Check if already in local list
      const alreadyExists = users.find(
        (u) => String(u._id) === String(data.user._id)
      );
      if (alreadyExists) {
        setError("This contact is already in your list.");
        setLoading(false);
        return;
      }

      // 3. Persist to DB
      await fetch("http://localhost:5001/api/auth/add-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser._id,
          contactId: data.user._id,
        }),
      });

      // 4. Add to local state
      const newContact = {
        _id: data.user._id,
        name: data.user.name,
        phone: data.user.phone,
        email: data.user.email,
        avatar: data.user.avatar || null,
        status: "offline",
        lastMessage: "",
        time: "",
        unread: 0,
        initials: data.user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase(),
      };

      setUsers((prev) => {
        if (prev.find((u) => String(u._id) === String(newContact._id)))
          return prev;
        return [...prev, newContact];
      });

      setSuccess(`${data.user.name} added to your contacts! 🚀`);
      setFormData({ name: "", email: "", phone: "" });
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", color: "white", width: "100%" }}>
      <h2 style={{ marginBottom: "20px" }}>Add New Contact</h2>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <form onSubmit={handleSubmit} style={{ width: "400px" }}>
          {success && (
            <div
              style={{
                marginBottom: "15px",
                padding: "12px 16px",
                background: "rgba(22,163,74,0.3)",
                border: "1px solid #16a34a",
                borderRadius: "8px",
                textAlign: "center",
                color: "#4ade80",
              }}
            >
              {success}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: "15px",
                padding: "12px 16px",
                background: "rgba(220,38,38,0.2)",
                border: "1px solid #dc2626",
                borderRadius: "8px",
                textAlign: "center",
                color: "#f87171",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "6px", color: "rgba(255,255,255,0.7)", fontSize: "14px" }}>
              Name 
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Contact's name"
              style={{
                width: "100%",
                padding: "12px 14px",
                marginTop: "4px",
                borderRadius: "8px",
                border: "1px solid rgba(133,194,255,0.3)",
                background: "rgba(26,26,34,0.95)",
                color: "#fff",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "6px", color: "rgba(255,255,255,0.7)", fontSize: "14px" }}>
              Email <span style={{ color: "#85C2FF" }}>*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="their@email.com"
              style={{
                width: "100%",
                padding: "12px 14px",
                marginTop: "4px",
                borderRadius: "8px",
                border: "1px solid rgba(133,194,255,0.3)",
                background: "rgba(26,26,34,0.95)",
                color: "#fff",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", marginBottom: "6px", color: "rgba(255,255,255,0.7)", fontSize: "14px" }}>
              Phone 
            </label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 99999 00000"
              style={{
                width: "100%",
                padding: "12px 14px",
                marginTop: "4px",
                borderRadius: "8px",
                border: "1px solid rgba(133,194,255,0.3)",
                background: "rgba(26,26,34,0.95)",
                color: "#fff",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px 28px",
              borderRadius: "10px",
              border: "none",
              background: loading
                ? "rgba(79,70,229,0.5)"
                : "linear-gradient(135deg, #85C2FF, #4f46e5)",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "15px",
              fontWeight: 600,
              width: "100%",
              transition: "all 0.3s ease",
              boxShadow: loading ? "none" : "0 8px 25px rgba(79,70,229,0.4)",
            }}
          >
            {loading ? "Searching..." : "Add Contact"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddContact;