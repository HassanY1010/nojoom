import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socketService } from '../services/socket';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import ChatBox from '../components/ChatBox';
import { getMediaUrl } from '../utils/urlUtils';
import { motion, AnimatePresence } from 'framer-motion';

const LiveStreamViewer: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [liveInfo, setLiveInfo] = useState<any>(null);
    const [viewersCount, setViewersCount] = useState(0);
    const [likesCount, setLikesCount] = useState(0);
    const [gifts, setGifts] = useState<any[]>([]);
    const [isJoined, setIsJoined] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const pc = useRef<RTCPeerConnection | null>(null);

    const { user } = useAuthStore();
    const { t } = useTranslation();
    const navigate = useNavigate();

    useEffect(() => {
        fetchStreamInfo();
        return () => {
            leaveStream();
        };
    }, [id]);

    const fetchStreamInfo = async () => {
        try {
            const response = await api.get(`/live/${id}`);
            setLiveInfo(response.data.stream);
            joinStream();
        } catch (error) {
            console.error('Failed to fetch stream info:', error);
            navigate('/live');
        }
    };

    const joinStream = async () => {
        const socket = await socketService.connect();
        socket?.emit('live_join', { liveId: id });
        setIsJoined(true);

        // Request WebRTC offer from host
        socket?.emit('webrtc_offer_request', { liveId: id, senderId: user?.id });

        socket?.on('webrtc_offer', async (data: { offer: RTCSessionDescriptionInit, senderId: number }) => {
            pc.current = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            pc.current.onicecandidate = (event) => {
                if (event.candidate) {
                    socket?.emit('webrtc_ice_candidate', {
                        liveId: id,
                        candidate: event.candidate,
                        targetUserId: data.senderId
                    });
                }
            };

            pc.current.ontrack = (event) => {
                if (videoRef.current) {
                    videoRef.current.srcObject = event.streams[0];
                    setStream(event.streams[0]);
                }
            };

            await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);

            socket?.emit('webrtc_answer', {
                liveId: id,
                answer,
                targetUserId: data.senderId
            });
        });

        socket?.on('webrtc_ice_candidate', async (data: { candidate: RTCIceCandidateInit }) => {
            if (pc.current) {
                await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });

        socket?.on('live_viewers_count', (data: { count: number }) => {
            setViewersCount(data.count);
        });

        socket?.on('new_gift', (gift: any) => {
            setGifts(prev => [...prev.slice(-4), gift]);
            setTimeout(() => {
                setGifts(prev => prev.filter(g => g.timestamp !== gift.timestamp));
            }, 5000);
        });

        socket?.on('live_ended', () => {
            alert(t('liveEndedMsg'));
            navigate('/live');
        });
    };

    const leaveStream = () => {
        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }
        const socket = socketService.getSocket();
        if (socket) {
            socket.emit('live_leave', { liveId: id });
        }
    };

    const handleLike = () => {
        socketService.getSocket()?.emit('live_like', { liveId: id });
        setLikesCount(prev => prev + 1);
    };

    const sendGift = (giftType: string) => {
        socketService.getSocket()?.emit('send_gift', {
            liveId: id,
            giftType,
            amount: 1
        });
    };

    const giftIcons: { [key: string]: string } = {
        rose: '🌹',
        heart: '❤️',
        star: '⭐',
        crown: '👑',
        diamond: '💎'
    };

    return (
        <div className="min-h-screen bg-black flex flex-col lg:flex-row overflow-hidden relative">
            {/* Video Area */}
            <div className="flex-1 relative bg-gray-900 group">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />

                {/* Live Badges */}
                <div className="absolute top-6 left-6 flex items-center gap-4 z-20">
                    <div className="bg-red-600 text-white px-3 py-1 rounded-lg font-black text-sm animate-pulse flex items-center gap-2">
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        LIVE
                    </div>
                    <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-lg text-white font-bold text-sm flex items-center gap-2">
                        <span>👤</span>
                        {viewersCount}
                    </div>
                    <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-lg text-white font-bold text-sm flex items-center gap-2">
                        <span>❤️</span>
                        {likesCount}
                    </div>
                </div>

                {/* Host Info */}
                {liveInfo && (
                    <div className="absolute top-6 right-6 flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 pl-4 rounded-2xl border border-white/10 z-20">
                        <div className="text-right">
                            <p className="text-white font-bold text-sm">{liveInfo.username}</p>
                            <p className="text-gray-400 text-xs">{t('host')}</p>
                        </div>
                        <img
                            src={getMediaUrl(liveInfo.avatar)}
                            alt={liveInfo.username}
                            className="w-10 h-10 rounded-full border-2 border-red-500"
                        />
                    </div>
                )}

                {/* Gift Animations Overlay */}
                <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                    <AnimatePresence>
                        {gifts.map((gift, idx) => (
                            <motion.div
                                key={gift.timestamp + idx}
                                initial={{ opacity: 0, scale: 0.5, y: 100, x: Math.random() * 200 - 100 }}
                                animate={{ opacity: 1, scale: 1.5, y: -300 }}
                                exit={{ opacity: 0, scale: 2 }}
                                transition={{ duration: 4 }}
                                className="absolute bottom-40 left-1/2 flex flex-col items-center"
                            >
                                <div className="text-6xl drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]">
                                    {giftIcons[gift.giftType]}
                                </div>
                                <div className="mt-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold whitespace-nowrap">
                                    {t('sentGiftMessage', { username: gift.username, giftType: gift.giftType })}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Viewer Actions Overlay (bottom center) */}
                <div className="absolute bottom-10 inset-x-0 flex justify-center z-40">
                    <div className="flex items-center gap-4 bg-black/30 backdrop-blur-xl p-4 rounded-3xl border border-white/10">
                        <button
                            onClick={handleLike}
                            className="w-14 h-14 bg-white/10 hover:bg-red-500/80 rounded-full flex items-center justify-center text-2xl transition-all active:scale-90"
                        >
                            ❤️
                        </button>

                        <div className="h-8 w-[1px] bg-white/10 mx-2"></div>

                        <div className="flex gap-2">
                            {Object.entries(giftIcons).map(([type, icon]) => (
                                <button
                                    key={type}
                                    onClick={() => sendGift(type)}
                                    className="w-12 h-12 bg-white/5 hover:bg-white/20 rounded-2xl flex items-center justify-center text-xl transition-all active:scale-90 relative group"
                                >
                                    {icon}
                                    <span className="absolute -top-12 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                        {type}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar: Chat */}
            <div className="w-full lg:w-96 bg-white dark:bg-black border-l border-gray-100 dark:border-gray-800 flex flex-col z-50">
                {isJoined ? (
                    <ChatBox
                        videoId={0}
                        videoOwnerId={liveInfo?.host_id || 0}
                        isVideoOwner={false}
                        onClose={() => navigate('/live')}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-500">{t('joiningLive')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveStreamViewer;

