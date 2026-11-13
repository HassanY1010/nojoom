import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { ChatAnimationPattern } from './AnimatedChatDisplay';

interface ChatPatternSelectorProps {
    currentPattern: ChatAnimationPattern;
    onPatternChange: (pattern: ChatAnimationPattern) => void;
}

const ChatPatternSelector: React.FC<ChatPatternSelectorProps> = ({
    currentPattern,
    onPatternChange
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const patterns: { value: ChatAnimationPattern; label: string; icon: string; description: string }[] = [
        {
            value: 'circle',
            label: 'دائرة',
            icon: '⭕',
            description: 'رسائل تدور حول الفيديو'
        },
        {
            value: 'wave',
            label: 'موجة',
            icon: '〰️',
            description: 'رسائل على شكل موجة'
        },
        {
            value: 'horizontal',
            label: 'أفقي',
            icon: '↔️',
            description: 'رسائل تتحرك أفقياً'
        },
        {
            value: 'vertical',
            label: 'عمودي',
            icon: '↕️',
            description: 'رسائل تتحرك عمودياً'
        }
    ];

    const currentPatternData = patterns.find(p => p.value === currentPattern);

    return (
        <div className="relative">
            {/* زر فتح القائمة */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <span className="text-xl">{currentPatternData?.icon}</span>
                <span className="font-medium">{currentPatternData?.label}</span>
                <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    ▼
                </motion.span>
            </motion.button>

            {/* قائمة الأنماط */}
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-full mt-2 right-0 bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 z-50"
                    style={{ minWidth: '280px' }}
                >
                    <div className="p-2">
                        <div className="text-xs text-gray-400 px-3 py-2 font-semibold">
                            اختر نمط الرسائل
                        </div>
                        {patterns.map((pattern) => (
                            <motion.button
                                key={pattern.value}
                                onClick={() => {
                                    onPatternChange(pattern.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${currentPattern === pattern.value
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                                        : 'hover:bg-gray-800 text-gray-300'
                                    }`}
                                whileHover={{ scale: 1.02, x: 4 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <span className="text-2xl">{pattern.icon}</span>
                                <div className="flex-1 text-right">
                                    <div className="font-semibold">{pattern.label}</div>
                                    <div className="text-xs opacity-75">{pattern.description}</div>
                                </div>
                                {currentPattern === pattern.value && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="text-white"
                                    >
                                        ✓
                                    </motion.span>
                                )}
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* خلفية لإغلاق القائمة */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default ChatPatternSelector;
