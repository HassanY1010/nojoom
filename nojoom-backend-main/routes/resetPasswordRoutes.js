import express from "express";
import { sendResetCode, verifyResetCode, resetPassword } from "../controllers/resetPasswordController.js";
import { sendResetCodeValidation, resetPasswordValidation } from "../middleware/validationMiddleware.js";
import { authLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.post("/forgot", authLimiter, sendResetCodeValidation, sendResetCode);
router.post("/verify", authLimiter, verifyResetCode);
router.post("/reset", authLimiter, resetPasswordValidation, resetPassword);

export default router;
