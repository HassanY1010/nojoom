import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import OTPInput from '../components/OTPInput';
import { otpApi } from '../services/api';
import { AlertTriangle, ArrowLeft, MailCheck } from 'lucide-react';

const EmailVerification: React.FC = () => {
    const { t } = useTranslation();
    const { isRTL } = useLanguageStore();
    const navigate = useNavigate();
    const location = useLocation();

    // Get email from navigation state
    const email = location.state?.email || '';

    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [initialSending, setInitialSending] = useState(true);

    // Redirect if no email provided
    useEffect(() => {
        if (!email) {
            navigate('/register');
        }
    }, [email, navigate]);

    // Send initial OTP on mount
    useEffect(() => {
        if (email && initialSending) {
            sendOTP();
            setInitialSending(false);
        }
    }, [email, initialSending]);

    // Countdown timer for resend
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => {
                setResendCooldown(resendCooldown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    // Auto-submit when 6 digits entered
    useEffect(() => {
        if (otp.length === 6 && !loading) {
            handleVerify();
        }
    }, [otp]);

    const sendOTP = async () => {
        try {
            setError('');
            setLoading(true);

            await otpApi.sendOTP(email);

            setResendCooldown(60); // 60 seconds cooldown

        } catch (err: any) {
            console.error('Send OTP error:', err);
            setError(err.response?.data?.message || t('failedToSendOTP'));
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (otp.length !== 6) {
            setError(t('pleaseEnter6Digits'));
            return;
        }

        try {
            setError('');
            setLoading(true);

            await otpApi.verifyOTP(email, otp);

            setSuccess(true);

            // Navigate to login after 2 seconds
            setTimeout(() => {
                navigate('/login', {
                    state: { message: t('emailVerifiedSuccessfully') }
                });
            }, 2000);

        } catch (err: any) {
            console.error('Verify OTP error:', err);
            const errorMessage = err.response?.data?.message || t('invalidOrExpiredCode');
            setError(errorMessage);
            setOtp(''); // Clear OTP on error
        } finally {
            setLoading(false);
        }
    };

    const handleResend = () => {
        if (resendCooldown > 0) return;
        setOtp('');
        setError('');
        sendOTP();
    };

    if (!email) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pt-16 flex items-center justify-center px-3 sm:px-4 transition-colors duration-300">
            <div className="max-w-md w-full mx-auto">
                {/* Header */}
                <motion.div
                    className="text-center mb-6 sm:mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Email Icon */}
                    <motion.div
                        className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[rgb(var(--primary-accent))] to-[var(--bg-card)] rounded-full flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    >
                        <MailCheck className="w-9 h-9 text-[var(--text-primary)]" />
                    </motion.div>

                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">
                        {t('verifyYourEmail')}
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm sm:text-base font-medium">
                        {t('weSentCodeTo')}
                    </p>
                    <p className="text-[rgb(var(--primary-accent))] font-bold mt-1 underline">{email}</p>
                </motion.div>

                {/* Success Animation */}
                <AnimatePresence>
                    {success && (
                        <motion.div
                            className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <span className="text-3xl">✅</span>
                                <p className="text-green-400 font-medium">{t('verificationSuccessful')}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error Message */}
                <AnimatePresence>
                    {error && !success && (
                        <motion.div
                            className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="flex items-center space-x-2">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* OTP Input */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <OTPInput
                        value={otp}
                        onChange={setOtp}
                        error={!!error}
                        disabled={loading || success}
                        autoFocus={true}
                    />
                </motion.div>

                {/* Info Text */}
                <motion.p
                    className="text-center text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-6 font-bold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    {t('codeExpiresIn10Minutes')}
                </motion.p>

                {/* Resend Button */}
                <motion.div
                    className="text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    {resendCooldown > 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-bold">
                            {t('resendCodeIn')} <span className="text-[rgb(var(--primary-accent))] font-black">{resendCooldown}s</span>
                        </p>
                    ) : (
                        <button
                            onClick={handleResend}
                            disabled={loading}
                            className="text-[rgb(var(--primary-accent))] hover:opacity-80 transition-all text-sm font-bold underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('didntReceiveCode')} <span className="font-black italic">{t('resendCode')}</span>
                        </button>
                    )}
                </motion.div>

                {/* Back to Register */}
                <motion.div
                    className="mt-8 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <button
                        onClick={() => navigate('/register')}
                        className="text-[var(--text-secondary)] hover:text-[rgb(var(--primary-accent))] transition-all text-sm font-bold inline-flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" /> {t('backToRegister')}
                    </button>
                </motion.div>

                {/* Loading Overlay */}
                {loading && !success && (
                    <motion.div
                        className="fixed inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-colors"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 text-center">
                            <div className="w-12 h-12 border-4 border-[rgb(var(--primary-accent))] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-[var(--text-primary)] font-bold">{t('verifying')}</p>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Background Pattern */}
            <div className="fixed inset-0 -z-10 opacity-10 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-transparent to-pink-500 dark:from-purple-900 dark:via-black dark:to-blue-900"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-white dark:to-black"></div>
            </div>
        </div>
    );
};

export default EmailVerification;

