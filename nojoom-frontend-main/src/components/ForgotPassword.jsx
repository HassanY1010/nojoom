// /src/components/ForgotPassword.jsx
import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const sendCode = async () => {
    try {
      await api.post("/reset-password/forgot", { email });
      alert("Reset code sent to your email!");
      navigate("/verify-reset-code", { state: { email } }); // تمرير البريد للخطوة التالية
    } catch (error) {
      alert(error.response?.data?.message || "Error sending code");
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto mt-20">
      <h2 className="text-lg font-bold mb-2">Enter Your Email</h2>
      <input
        type="email"
        placeholder="Email"
        className="border p-2 mb-2 w-full"
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        onClick={sendCode}
        className="bg-blue-500 text-white p-2 w-full rounded"
      >
        Send Code
      </button>
    </div>
  );
}
