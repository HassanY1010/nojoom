import AuthService from "../services/AuthService.js";
import { sendEmail } from "../utils/sendEmail.js";

/**
 * 1️⃣ إرسال رمز إعادة تعيين كلمة المرور
 */
export const sendResetCode = async (req, res) => {
  const { email } = req.body;

  try {
    const code = await AuthService.sendResetCode(email);

    // إرسال الكود عبر البريد الإلكتروني
    await sendEmail({
      to: email,
      subject: "Reset Your Password",
      html: `
        <h1>Your Reset Code</h1>
        <p>Your reset code is: <b>${code}</b></p>
        <p>This code will expire in 10 minutes.</p>
      `
    });

    res.json({ message: "Reset code sent to email" });
  } catch (error) {
    console.error("Error sending reset code:", error);
    if (error.message === 'Email not found') {
      return res.status(400).json({ message: "Email not found" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * 2️⃣ التحقق من رمز إعادة التعيين
 */
export const verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    await AuthService.verifyResetCode(email, code);
    res.json({ message: "Code verified" });
  } catch (error) {
    console.error("Error verifying reset code:", error);
    if (error.message === 'Invalid or expired code') {
      return res.status(400).json({ message: "Invalid or expired code" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * 3️⃣ تغيير كلمة المرور
 */
export const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    await AuthService.resetPasswordWithCode(email, code, newPassword);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    if (error.message === 'Invalid or expired code') {
      return res.status(400).json({ message: "Invalid or expired code" });
    }
    res.status(500).json({ message: "Server error" });
  }
};
