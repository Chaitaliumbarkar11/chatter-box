import { useEffect, useState, useRef } from "react";

const API_BASE = "http://localhost:5001";

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #128C7E 0%, #25D366 50%, #128C7E 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 20px 40px rgba(18, 140, 126, 0.3)",
    overflow: "hidden",
    position: "relative",
  },
  header: {
    background: "#075E54",
    padding: "20px",
    textAlign: "center",
  },
  avatarSection: {
    position: "relative",
    height: "140px",
    background: "linear-gradient(135deg, #25D366, #128C7E)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  avatar: {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    border: "5px solid #fff",
    objectFit: "cover",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  avatarPlaceholder: {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    border: "5px solid #fff",
    background: "linear-gradient(135deg, #4da6ff, #0077cc)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "36px",
    fontWeight: "700",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
    transition: "all 0.3s ease",
    userSelect: "none",
  },
  editIcon: {
    position: "absolute",
    bottom: "15px",
    background: "#fff",
    borderRadius: "50%",
    width: "30px",
    height: "30px",
    display: "flex",
    marginLeft: "80px",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
    transition: "all 0.2s ease",
    fontSize: "18px",
  },
  content: {
    padding: "30px 25px",
  },
  inputGroup: {
    marginBottom: "25px",
    position: "relative",
  },
  label: {
    display: "block",
    color: "#667781",
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    width: "100%",
    padding: "15px 18px",
    border: "1px solid #E1E9EE",
    borderRadius: "12px",
    fontSize: "16px",
    transition: "all 0.3s ease",
    background: "#F7F9FA",
    boxSizing: "border-box",
  },
  inputFocus: {
    borderColor: "#25D366",
    boxShadow: "0 0 0 3px rgba(37, 211, 102, 0.1)",
    background: "#fff",
  },
  editBtn: {
    position: "absolute",
    right: "15px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: "#667781",
    padding: "5px",
    borderRadius: "50%",
    transition: "all 0.2s ease",
  },
  saveBtn: {
    background: "#25D366",
    color: "#fff",
    border: "none",
    padding: "14px 30px",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(37, 211, 102, 0.3)",
  },
  whatsappBtn: {
    position: "absolute",
    bottom: "20px",
    right: "20px",
    background: "#25D366",
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    width: "56px",
    height: "56px",
    fontSize: "24px",
    cursor: "pointer",
    boxShadow: "0 8px 25px rgba(37, 211, 102, 0.4)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    background: "linear-gradient(135deg, #128C7E 0%, #25D366 100%)",
    color: "#fff",
    fontSize: "18px",
  },
};

export default function Profile() {
  const [user, setUser] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileRef = useRef();
  const nameRef = useRef();
  const phoneRef = useRef();
  const bioRef = useRef();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    setUser(storedUser);
    setEditValues({
      name: storedUser?.name || "",
      phone: storedUser?.phone || "",
      bio: storedUser?.bio || "",
    });
  }, []);

  const toggleEdit = (field) => {
    if (editingField === field) {
      setEditingField(null);
    } else {
      setEditingField(field);
      setTimeout(() => {
        if (field === "name") nameRef.current?.focus();
        if (field === "phone") phoneRef.current?.focus();
        if (field === "bio") bioRef.current?.focus();
      }, 100);
    }
  };

  const handleInputChange = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/api/auth/update-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editValues),
      });

      if (!res.ok) throw new Error("Update failed");

      const updatedUser = await res.json();

      // Merge with existing user (preserve avatar etc.)
      const merged = { ...user, ...updatedUser };
      setUser(merged);
      localStorage.setItem("user", JSON.stringify(merged));
      setEditingField(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert("Update failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      formData.append("userId", user._id);

      const res = await fetch(`${API_BASE}/api/auth/upload-avatar`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      const updatedUser = { ...user, avatar: data.avatar };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (err) {
      alert("Avatar upload failed. Please try again.");
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!user) {
    return <div style={styles.loading}>Loading profile...</div>;
  }

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={{ color: "#fff", margin: 0, fontSize: "20px", fontWeight: 500 }}>
            Profile
          </h1>
        </div>

        {/* Avatar Section */}
        <div style={styles.avatarSection}>
          {user.avatar ? (
            <img
              src={`${API_BASE}${user.avatar}`}
              alt="avatar"
              style={styles.avatar}
              onClick={() => fileRef.current.click()}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <div style={styles.avatarPlaceholder} onClick={() => fileRef.current.click()}>
              {initials}
            </div>
          )}
          <div
            style={styles.editIcon}
            onClick={() => fileRef.current.click()}
          >
            ✏️
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/*"
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Content */}
        <div style={styles.content}>
          {saveSuccess && (
            <div
              style={{
                background: "#dcfce7",
                border: "1px solid #16a34a",
                color: "#15803d",
                borderRadius: "10px",
                padding: "12px 16px",
                marginBottom: "20px",
                textAlign: "center",
                fontWeight: 500,
              }}
            >
              ✅ Profile updated successfully!
            </div>
          )}

          {/* Name */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Name</label>
            {editingField === "name" ? (
              <input
                ref={nameRef}
                style={{ ...styles.input, ...styles.inputFocus }}
                value={editValues.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            ) : (
              <>
                <div style={{ fontSize: "22px", fontWeight: 600, color: "#111b21", marginBottom: "5px" }}>
                  {editValues.name || "Not set"}
                </div>
                <button style={styles.editBtn} onClick={() => toggleEdit("name")}>✏️</button>
              </>
            )}
          </div>

          {/* Phone */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Phone</label>
            {editingField === "phone" ? (
              <input
                ref={phoneRef}
                style={{ ...styles.input, ...styles.inputFocus }}
                value={editValues.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            ) : (
              <>
                <div style={{ fontSize: "18px", color: editValues.phone ? "#111b21" : "#667781", marginBottom: "5px" }}>
                  {editValues.phone || "Not added"}
                </div>
                <button style={styles.editBtn} onClick={() => toggleEdit("phone")}>✏️</button>
              </>
            )}
          </div>

          {/* Bio */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Bio</label>
            {editingField === "bio" ? (
              <input
                ref={bioRef}
                style={{ ...styles.input, ...styles.inputFocus }}
                value={editValues.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Tell something about yourself..."
              />
            ) : (
              <>
                <div style={{ fontSize: "16px", color: editValues.bio ? "#111b21" : "#667781", marginBottom: "5px" }}>
                  {editValues.bio || "Not added"}
                </div>
                <button style={styles.editBtn} onClick={() => toggleEdit("bio")}>✏️</button>
              </>
            )}
          </div>

          {/* Email (read-only) */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <div style={{ fontSize: "16px", color: "#667781" }}>{user.email}</div>
          </div>

          {(editingField !== null || saving) && (
            <button
              style={{
                ...styles.saveBtn,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        {/* FAB save button */}
        <button
          style={styles.whatsappBtn}
          onClick={handleSave}
          disabled={saving}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 12px 35px rgba(37, 211, 102, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 8px 25px rgba(37, 211, 102, 0.4)";
          }}
        >
          ✓
        </button>
      </div>
    </div>
  );
}