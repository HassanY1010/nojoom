import api from "../services/api";
import { useState } from "react";

export default function SendOTP() {
  const [email, setEmail] = useState("");

  const sendOTP = async () => {
    await api.post("/auth/send-otp", { email });
    alert("OTP sent to your email!");
  };

  return (
    <div>
      <input
        type="email"
        placeholder="Enter email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={sendOTP}>Send Code</button>
    </div>
  );
}
