import React, { useState, useRef, useEffect } from 'react';
import './VoiceRecorder.css';

import { useTranslation } from 'react-i18next';

interface VoiceRecorderProps {
    onStop: (audioBlob: Blob) => void;
    onCancel: () => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onStop, onCancel }) => {
    const { t } = useTranslation();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        startRecording();
        return () => stopTimer();
    }, []);

    const startTimer = () => {
        timerRef.current = setInterval(() => {
            setRecordingTime((prev) => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                onStop(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            startTimer();
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert(t('microphoneAccessDenied'));
            onCancel();
        }
    };

    const handleStop = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            stopTimer();
        }
    };

    const handleCancel = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            stopTimer();
        }
        onCancel();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="voice-recorder-container">
            <div className="recording-status">
                <div className="recording-dot"></div>
                <span className="recording-time">{formatTime(recordingTime)}</span>
            </div>
            <div className="recorder-actions">
                <button className="cancel-record-btn" onClick={handleCancel}>✕</button>
                <button className="stop-record-btn" onClick={handleStop}>
                    <div className="stop-icon"></div>
                </button>
            </div>
        </div>
    );
};

export default VoiceRecorder;
