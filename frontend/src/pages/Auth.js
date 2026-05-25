import { useState } from "react";
import "../style/Auth.css";

const API = "https://chatter-box-1-1qc6.onrender.com/api/auth";
export default function Auth() {
  const [isLogin, setIsLogin] = useState(false);

  // REGISTER STATES
  const [rname, setRname] = useState("");
  const [rphone, setRphone] = useState("");
  const [remail, setRemail] = useState("");
  const [rpass, setRpass] = useState("");

  // LOGIN STATES
  const [lemail, setLemail] = useState("");
  const [lpass, setLpass] = useState("");


  // REGISTER
  const register = async () => {
    if (!rname || !rphone || !remail || !rpass) {
      alert("All fields are required");
      return;
    }

    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: rname,
        phone: rphone,
        email: remail,
        password: rpass,
      }),
    });

    const data = await res.json();
    alert(data.message);

    if (data.success) {
      setIsLogin(true);
    }
  };

  // LOGIN
  const login = async () => {
  if (!lemail || !lpass) {
    alert("Email and password required");
    return;
  }

  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: lemail,
      password: lpass,
    }),
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  // 🔹 CHANGE HERE
  localStorage.setItem("token", data.token);       // save token
  localStorage.setItem("user", JSON.stringify(data.user));  // save user info

  window.location.href = "/dashboard"; // ✅ redirect to dashboard instead of profile
};

  return (
    <div className="auth-body">
      <div className="right">
        {/* REGISTER */}
        {!isLogin && (
          <div className="form-box">
            <h2>Create Account</h2>

            <div className="input-group">
              <input value={rname} onChange={(e) => setRname(e.target.value)} placeholder=" " />
              <label>Full Name</label>
            </div>

            <div className="input-group">
              <input
                type="tel"
                value={rphone}
                onChange={(e) => setRphone(e.target.value)}
                placeholder=" "
              />
              <label>Phone Number</label>
            </div>

            <div className="input-group">
              <input
                type="email"
                value={remail}
                onChange={(e) => setRemail(e.target.value)}
                placeholder=" "
              />
              <label>Email</label>
            </div>

            <div className="input-group">
              <input
                type="password"
                value={rpass}
                onChange={(e) => setRpass(e.target.value)}
                placeholder=" "
              />
              <label>Password</label>
            </div>

            <button onClick={register}>Register</button>

            <div className="switch">
              Already have an account?{" "}
              <span onClick={() => setIsLogin(true)}>Login</span>
            </div>
          </div>
        )}

        {/* LOGIN */}
        {isLogin && (
          <div className="form-box">
            <h2>Welcome Back</h2>

            <div className="input-group">
              <input
                type="email"
                value={lemail}
                onChange={(e) => setLemail(e.target.value)}
                placeholder=" "
              />
              <label>Email</label>
            </div>
 
            <div className="input-group">
              <input
                type="password"
                value={lpass}
                onChange={(e) => setLpass(e.target.value)}
                placeholder=" "
              />
              <label>Password</label>
            </div>

            <button onClick={login}>Login</button>

            <div className="switch">
              New user? <span onClick={() => setIsLogin(false)}>Register</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
