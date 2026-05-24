import { BrowserRouter, Routes, Route } from "react-router-dom";
import Splash from "./pages/Splash";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
        import Profile from "./pages/Profile";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />

<Route path="/profile" element={<Profile />} />      </Routes>
    </BrowserRouter>
  );
}
