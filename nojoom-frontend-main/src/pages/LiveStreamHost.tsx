import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../services/socket';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import ChatBox from '../components/ChatBox';

const LiveStreamHost: React.FC = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [liveInfo, setLiveInfo] = useState<any>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [title, setTitle] = useState('');
    const [viewersCount, setViewersCount] = useState(0);
    const [likesCount, setLikesCount] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnections = useRef<{ [userId: number]: RTCPeerConnection }>({});

    const { user } = useAuthStore();
    const { t } = useTranslation();
    const navigate = useNavigate();

    useEffect(() => {
        startCamera();
        return () => {
            stopStream();
        };
    }, []);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, facingMode: 'user' },
                audio: true
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert(t('cameraAccessError'));
        }
    };

    const handleStartLive = async () => {
        if (!title.trim()) {
            alert(t('enterStreamTitle'));
            return;
        }

        setIsStarting(true);
        try {
            const response = await api.post('/live/start', { title });
            const liveData = response.data.stream;
            setLiveInfo(liveData);

            const socket = await socketService.connect();
            socket?.emit('live_join', { liveId: liveData.id });

            // Listen for viewers joining to send WebRTC offer
            socket?.on('webrtc_offer_request', async (data: { senderId: number }) => {
                createPeerConnection(data.senderId);
            });

            socket?.on('webrtc_answer', async (data: { answer: RTCSessionDescriptionInit, senderId: number }) => {
                const pc = peerConnections.current[data.senderId];
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            });

            socket?.on('webrtc_ice_candidate', async (data: { candidate: RTCIceCandidateInit, senderId: number }) => {
                const pc = peerConnections.current[data.senderId];
                if (pc) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            });

            socket?.on('live_viewers_count', (data: { count: number }) => {
                setViewersCount(data.count);
            });

            socket?.on('live_liked', () => {
                setLikesCount(prev => prev + 1);
            });

        } catch (error) {
            console.error('Failed to start live:', error);
            alert(t('startLiveError'));
            setIsStarting(false);
        }
    };

    const createPeerConnection = async (targetUserId: number) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        peerConnections.current[targetUserId] = pc;

        if (stream) {
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketService.getSocket()?.emit('webrtc_ice_candidate', {
                    liveId: liveInfo.id,
                    candidate: event.candidate,
                    targetUserId
                });
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketService.getSocket()?.emit('webrtc_offer', {
            liveId: liveInfo.id,
            offer,
            targetUserId // The signaling logic on backend handles broadcasting or direct target
        });
    };

    const handleEndLive = async () => {
        if (!liveInfo) return;

        if (window.confirm(t('confirmEndLive'))) {
            try {
                await api.post(`/live/${liveInfo.id}/end`);
                stopStream();
                navigate('/live');
            } catch (error) {
                console.error('Failed to end live:', error);
            }
        }
    };

    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
        const socket = socketService.getSocket();
        if (socket && liveInfo) {
            socket.emit('live_leave', { liveId: liveInfo.id });
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col lg:flex-row overflow-hidden">
            {/* Video Area */}
            <div className="flex-1 relative flex items-center justify-center bg-gray-900">
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                />

                {/* Overlay Labels */}
                {!liveInfo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">
                                {t('liveSetup')}
                            </h2>
                            <input
                                type="text"
                                placeholder={t('streamTitlePlaceholder')}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-6 py-4 rounded-2xl mb-6 outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold"
                            />
                            <button
                                onClick={handleStartLive}
                                disabled={isStarting}
                                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-red-600/20"
                            >
                                {isStarting ? t('starting') : t('goLiveNow')}
                            </button>
                        </div>
                    </div>
                )}

                {liveInfo && (
                    <>
                        <div className="absolute top-6 left-6 flex items-center gap-4">
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

                        <button
                            onClick={handleEndLive}
                            className="absolute top-6 right-6 bg-white/10 hover:bg-red-600/80 backdrop-blur-md text-white px-4 py-2 rounded-xl font-bold transition-all border border-white/20"
                        >
                            {t('endLive')}
                        </button>
                    </>
                )}
            </div>

            {/* Sidebar: Chat */}
            <div className="w-full lg:w-96 bg-white dark:bg-black border-l border-gray-100 dark:border-gray-800 flex flex-col">
                {liveInfo ? (
                    <ChatBox
                        videoId={0} // Global or reserved ID for live streams
                        videoOwnerId={user?.id || 0}
                        isVideoOwner={true}
                        onClose={() => { }}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                        <div className="text-6xl mb-4">💬</div>
                        <p className="font-bold">{t('chatWillStartWithLive')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveStreamHost;

