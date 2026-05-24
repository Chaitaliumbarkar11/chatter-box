import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/auth");
    }, 1000); // 1 seconds

    return () => clearTimeout(timer);
  },  [navigate]);


  return (
    <div style={styles.body}>
      <div style={styles.card}>
        <img   src="/img/Screenshot (171).png" style={{ borderRadius: "30px" }} />
        <h1 style={styles.title}>ChatterBox</h1>
        <p>With AI</p>
      </div>
    </div>
  );
}

const styles = {
  body: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(180deg,#2eb2ff,#6aa2ff,#8756f0,#d13df2)",
    color: "white",
  },
  card: { textAlign: "center" },
  title: { fontSize: "48px", fontFamily: "Playfair Display" },
};
