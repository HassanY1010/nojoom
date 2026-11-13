import React from 'react';
import ChatBox from '../components/ChatBox';
import { useTranslation } from 'react-i18next';

const LiveChat: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50 dark:bg-black">
            <div className="max-w-4xl mx-auto w-full h-full flex flex-col p-4">
                <div className="mb-4">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                        {t('liveChat')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {t('liveChatSub')}
                    </p>
                </div>

                <div className="flex-1 min-h-0 bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-800">
                    <ChatBox
                        videoId={0} // 0 is reserved for global live chat
                        videoOwnerId={0}
                        isVideoOwner={false}
                        onClose={() => { }} // No close action on standalone page
                    />
                </div>
            </div>
        </div>
    );
};

export default LiveChat;
