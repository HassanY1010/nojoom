import api from "../services/api";
import { useState } from "react";

export default function VerifyOTP() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const verify = async () => {
    const res = await api.post("/auth/verify-otp", { email, code });
    alert(res.data.message);
  };

  return (
    <div>
      <input
        type="email"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="text"
        placeholder="Enter OTP"
        onChange={(e) => setCode(e.target.value)}
      />
      <button onClick={verify}>Verify</button>
    </div>
  );
}
