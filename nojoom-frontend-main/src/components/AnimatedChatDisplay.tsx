import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, TargetAndTransition } from 'framer-motion';


export type ChatAnimationPattern = 'circle' | 'wave' | 'horizontal' | 'vertical';

interface AnimatedChatMessage {
    id: string;
    content: string;
    username: string;
    timestamp: number;
}

interface AnimatedChatDisplayProps {
    messages: AnimatedChatMessage[];
    pattern: ChatAnimationPattern;
    videoWidth?: number;
    videoHeight?: number;
}

interface Position {
    x: number;
    y: number;
    rotate: number;
}

const AnimatedChatDisplay: React.FC<AnimatedChatDisplayProps> = ({
    messages,
    pattern,
    videoWidth = 400,
    videoHeight = 600
}) => {
    const [visibleMessages, setVisibleMessages] = useState<AnimatedChatMessage[]>([]);

    useEffect(() => {
        // عرض آخر 10 رسائل فقط
        setVisibleMessages(messages.slice(-10));
    }, [messages]);

    // حساب موضع الرسالة بناءً على النمط
    const getMessagePosition = (index: number, total: number): Position => {
        const centerX = videoWidth / 2;
        const centerY = videoHeight / 2;
        const radius = Math.min(videoWidth, videoHeight) * 0.4;

        switch (pattern) {
            case 'circle':
                // دائرة حول الفيديو
                const angle = (index / total) * Math.PI * 2;
                return {
                    x: centerX + Math.cos(angle) * radius - centerX,
                    y: centerY + Math.sin(angle) * radius - centerY,
                    rotate: (angle * 180) / Math.PI + 90
                };

            case 'wave':
                // موجة أفقية
                const waveX = (index / total) * videoWidth;
                const waveY = Math.sin((index / total) * Math.PI * 4) * 50;
                return {
                    x: waveX - centerX,
                    y: waveY,
                    rotate: 0
                };

            case 'horizontal':
                // خط أفقي من اليمين لليسار
                return {
                    x: videoWidth - (index / total) * videoWidth - centerX,
                    y: -centerY + 50,
                    rotate: 0
                };

            case 'vertical':
                // خط عمودي من الأعلى للأسفل
                return {
                    x: centerX - centerX,
                    y: (index / total) * videoHeight - centerY,
                    rotate: 90
                };

            default:
                return { x: 0, y: 0, rotate: 0 };
        }
    };
    const getAnimationVariants = () => {
        switch (pattern) {
            case 'circle':
                return {
                    initial: { scale: 0, opacity: 0 },
                    animate: {
                        scale: 1,
                        opacity: 1,
                        transition: {
                            duration: 0.5,
                            ease: 'easeOut' as any
                        }
                    },
                    exit: {
                        scale: 0,
                        opacity: 0,
                        transition: { duration: 0.3, ease: 'easeInOut' as any }
                    }
                };
            case 'wave':
                return {
                    initial: { x: videoWidth, opacity: 0 },
                    animate: {
                        x: 0,
                        opacity: 1,
                        transition: {
                            duration: 1,
                            ease: 'easeInOut' as any
                        }
                    },
                    exit: {
                        x: -videoWidth,
                        opacity: 0,
                        transition: { duration: 0.5, ease: 'easeOut' as any }
                    }
                };
            case 'horizontal':
                return {
                    initial: { x: videoWidth, opacity: 0 },
                    animate: {
                        x: 0,
                        opacity: 1,
                        transition: {
                            duration: 0.8,
                            ease: 'linear' as any
                        }
                    },
                    exit: {
                        x: -videoWidth,
                        opacity: 0,
                        transition: { duration: 0.5, ease: 'easeOut' as any }
                    }
                };
            case 'vertical':
                return {
                    initial: { y: -100, opacity: 0 },
                    animate: {
                        y: 0,
                        opacity: 1,
                        transition: {
                            duration: 0.5,
                            ease: 'easeOut' as any
                        }
                    },
                    exit: {
                        y: videoHeight,
                        opacity: 0,
                        transition: { duration: 0.5, ease: 'easeInOut' as any }
                    }
                };
            default:
                return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
        }
    };

    return (
        <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ width: videoWidth, height: videoHeight }}
        >
            <AnimatePresence mode="popLayout">
                {visibleMessages.map((message, index) => {
                    const position = getMessagePosition(index, visibleMessages.length);
                    const variants = getAnimationVariants();

                    // حل مشكلة TypeScript باستخدام TargetAndTransition
                    const animationConfig: TargetAndTransition = {
                        ...variants.animate,
                        x: position.x,
                        y: position.y,
                        rotate: position.rotate
                    };

                    return (
                        <motion.div
                            key={message.id}
                            className="absolute"
                            style={{
                                left: '50%',
                                top: '50%',
                                transformOrigin: 'center center'
                            }}
                            initial={variants.initial}
                            animate={animationConfig}
                            exit={variants.exit}
                        >
                            <div
                                className="px-3 py-2 rounded-full text-sm font-medium shadow-lg backdrop-blur-md"
                                style={{
                                    background: 'rgba(0, 0, 0, 0.7)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#fff',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '200px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}
                            >
                                <span className="font-bold text-blue-400">{message.username}: </span>
                                <span>{message.content}</span>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default AnimatedChatDisplay;