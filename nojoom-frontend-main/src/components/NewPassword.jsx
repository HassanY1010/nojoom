// /src/components/NewPassword.jsx
import { useState } from "react";
import api from "../services/api";
import { useLocation } from "react-router-dom";

export default function NewPassword() {
  const [newPassword, setNewPassword] = useState("");
  const location = useLocation();
  const { email, code } = location.state || {};

  const reset = async () => {
    try {
      await api.post("/reset-password/reset", { email, code, newPassword });
      alert("Password updated successfully!");
    } catch (error) {
      alert(error.response?.data?.message || "Error resetting password");
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto mt-20">
      <h2 className="text-lg font-bold mb-2">Enter New Password</h2>
      <input
        type="password"
        placeholder="New Password"
        className="border p-2 mb-2 w-full"
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <button
        onClick={reset}
        className="bg-green-500 text-white p-2 w-full rounded"
      >
        Reset Password
      </button>
    </div>
  );
}
