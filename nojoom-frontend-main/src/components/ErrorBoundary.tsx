import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('❌ Error caught by boundary:', error);
        console.error('❌ Error info:', errorInfo);

        this.setState({
            error,
            errorInfo
        });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-red-900 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold">حدث خطأ غير متوقع</h1>
                                    <p className="text-white/90 mt-1">Something went wrong</p>
                                </div>
                            </div>
                        </div>

                        {/* Error Details */}
                        <div className="p-6 space-y-6">
                            {/* Error Message */}
                            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
                                <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                                    📛 رسالة الخطأ / Error Message
                                </h2>
                                <p className="text-red-700 dark:text-red-200 font-mono text-sm break-all">
                                    {this.state.error?.message || 'Unknown error'}
                                </p>
                            </div>

                            {/* Error Name */}
                            {this.state.error?.name && (
                                <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded">
                                    <h2 className="text-lg font-semibold text-orange-800 dark:text-orange-300 mb-2">
                                        🏷️ نوع الخطأ / Error Type
                                    </h2>
                                    <p className="text-orange-700 dark:text-orange-200 font-mono text-sm">
                                        {this.state.error.name}
                                    </p>
                                </div>
                            )}

                            {/* Stack Trace */}
                            {this.state.error?.stack && (
                                <div className="bg-gray-50 dark:bg-gray-900/50 border-l-4 border-gray-500 p-4 rounded">
                                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-300 mb-2">
                                        📋 تتبع الخطأ / Stack Trace
                                    </h2>
                                    <div className="bg-gray-900 dark:bg-black p-4 rounded overflow-x-auto">
                                        <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                                            {this.state.error.stack}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {/* Component Stack */}
                            {this.state.errorInfo?.componentStack && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
                                    <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">
                                        🧩 مكونات React / Component Stack
                                    </h2>
                                    <div className="bg-gray-900 dark:bg-black p-4 rounded overflow-x-auto">
                                        <pre className="text-blue-400 text-xs font-mono whitespace-pre-wrap">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {/* Additional Info */}
                            <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-4 rounded">
                                <h2 className="text-lg font-semibold text-purple-800 dark:text-purple-300 mb-2">
                                    ℹ️ معلومات إضافية / Additional Info
                                </h2>
                                <div className="space-y-2 text-sm text-purple-700 dark:text-purple-200">
                                    <p><strong>الوقت / Time:</strong> {new Date().toLocaleString('ar-EG')}</p>
                                    <p><strong>المتصفح / Browser:</strong> {navigator.userAgent}</p>
                                    <p><strong>الصفحة / Page:</strong> {window.location.href}</p>
                                    <p><strong>الشاشة / Screen:</strong> {window.innerWidth}x{window.innerHeight}</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 pt-4">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={this.handleReload}
                                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                                >
                                    🔄 إعادة تحميل الصفحة / Reload Page
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={this.handleGoHome}
                                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                                >
                                    🏠 العودة للرئيسية / Go Home
                                </motion.button>
                            </div>

                            {/* Copy Error Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    const errorText = `
Error: ${this.state.error?.message}
Type: ${this.state.error?.name}
Time: ${new Date().toLocaleString()}
Page: ${window.location.href}

Stack Trace:
${this.state.error?.stack}

Component Stack:
${this.state.errorInfo?.componentStack}
                  `.trim();

                                    navigator.clipboard.writeText(errorText);
                                    alert('✅ تم نسخ تفاصيل الخطأ / Error details copied!');
                                }}
                                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                            >
                                📋 نسخ تفاصيل الخطأ / Copy Error Details
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
