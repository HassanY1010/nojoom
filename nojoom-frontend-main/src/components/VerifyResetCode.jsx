// /src/components/VerifyResetCode.jsx
import { useState } from "react";
import api from "../services/api";
import { useNavigate, useLocation } from "react-router-dom";

export default function VerifyResetCode() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email; // الحصول على البريد من الخطوة السابقة

  const verify = async () => {
    try {
      await api.post("/reset-password/verify", { email, code });
      alert("Code verified!");
      navigate("/reset-password", { state: { email, code } }); // تمرير البريد والكود للخطوة التالية
    } catch (error) {
      alert(error.response?.data?.message || "Invalid or expired code");
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto mt-20">
      <h2 className="text-lg font-bold mb-2">Enter Verification Code</h2>
      <input
        type="text"
        placeholder="Enter code"
        className="border p-2 mb-2 w-full"
        onChange={(e) => setCode(e.target.value)}
      />
      <button
        onClick={verify}
        className="bg-blue-500 text-white p-2 w-full rounded"
      >
        Verify Code
      </button>
    </div>
  );
}
