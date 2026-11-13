import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import { passwordResetApi } from '../services/api';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';

const NewPassword: React.FC = () => {
    const { t } = useTranslation();
    const { isRTL } = useLanguageStore();
    const navigate = useNavigate();
    const location = useLocation();

    const email = location.state?.email || '';
    const code = location.state?.code || '';

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Redirect if no email or code
    useEffect(() => {
        if (!email || !code) {
            navigate('/forgot-password');
        }
    }, [email, code, navigate]);

    const validatePassword = () => {
        if (!newPassword) {
            setError(t('passwordRequired'));
            return false;
        }

        if (newPassword.length < 6) {
            setError(t('passwordMinLength'));
            return false;
        }

        if (!confirmPassword) {
            setError(t('confirmPasswordRequired'));
            return false;
        }

        if (newPassword !== confirmPassword) {
            setError(t('passwordsDoNotMatch'));
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validatePassword()) {
            return;
        }

        try {
            setError('');
            setLoading(true);

            await passwordResetApi.resetPassword(email, code, newPassword);

            setSuccess(true);

            // Navigate to login after 2 seconds
            setTimeout(() => {
                navigate('/login', {
                    state: { message: t('passwordResetSuccessfully') }
                });
            }, 2000);

        } catch (err: any) {
            console.error('Reset password error:', err);
            setError(err.response?.data?.message || t('failedToResetPassword'));
        } finally {
            setLoading(false);
        }
    };

    if (!email || !code) {
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
                    {/* Key Icon */}
                    <motion.div
                        className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[rgb(var(--primary-accent))] to-[var(--bg-card)] rounded-full flex items-center justify-center"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    >
                        <KeyRound className="w-9 h-9 text-[var(--text-primary)]" />
                    </motion.div>

                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">
                        {t('setNewPassword')}
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm sm:text-base font-medium">
                        {t('enterYourNewPassword')}
                    </p>
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
                                <p className="text-green-400 font-medium">{t('passwordResetSuccessful')}</p>
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

                {/* Form */}
                <motion.form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {/* New Password */}
                    <div>
                        <label htmlFor="newPassword" className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('newPassword')}
                        </label>
                        <div className="relative">
                            <input
                                id="newPassword"
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    setError('');
                                }}
                                required
                                placeholder={t('enterNewPassword')}
                                dir={isRTL ? 'rtl' : 'ltr'}
                                disabled={success}
                                className={`w-full ui-input px-4 ${error ? 'border-red-500' : ''} ${isRTL ? 'text-right pr-12' : 'text-left pl-12'
                                    }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-600 dark:hover:text-white transition-all p-1 ${isRTL ? 'left-3' : 'right-3'
                                    }`}
                                tabIndex={-1}
                            >
                                <span>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</span>
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label htmlFor="confirmPassword" className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('confirmPassword')}
                        </label>
                        <div className="relative">
                            <input
                                id="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setError('');
                                }}
                                required
                                placeholder={t('confirmNewPassword')}
                                dir={isRTL ? 'rtl' : 'ltr'}
                                disabled={success}
                                className={`w-full ui-input px-4 ${error ? 'border-red-500' : ''} ${isRTL ? 'text-right pr-12' : 'text-left pl-12'
                                    }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-600 dark:hover:text-white transition-all p-1 ${isRTL ? 'left-3' : 'right-3'
                                    }`}
                                tabIndex={-1}
                            >
                                <span>{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</span>
                            </button>
                        </div>
                    </div>

                    {/* Password Requirements */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 font-bold">
                        <p className={newPassword.length >= 6 ? 'text-green-500' : ''}>
                            {newPassword.length >= 6 ? '✓' : '○'} {t('atLeast6Characters')}
                        </p>
                        <p className={newPassword && confirmPassword && newPassword === confirmPassword ? 'text-green-500' : ''}>
                            {newPassword && confirmPassword && newPassword === confirmPassword ? '✓' : '○'} {t('passwordsMatch')}
                        </p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || success}
                        className="w-full ui-button ui-button--primary ui-button--lg interactive rounded-[var(--radius-md)] disabled:opacity-50 font-bold text-sm sm:text-base mt-6"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center space-x-2">
                                <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin"></div>
                                <span>{t('resetting')}</span>
                            </div>
                        ) : success ? (
                            t('redirectingToLogin')
                        ) : (
                            t('resetPassword')
                        )}
                    </button>
                </motion.form>

                {/* Back Button */}
                {!success && (
                    <motion.div
                        className="mt-6 text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                    >
                        <button
                            onClick={() => navigate('/login')}
                            className="text-[var(--text-secondary)] hover:text-[rgb(var(--primary-accent))] transition-all text-sm font-bold inline-flex items-center gap-1"
                        >
                            <ArrowLeft className="w-4 h-4" /> {t('backToLogin')}
                        </button>
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

export default NewPassword;

