export const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;
export const SOCKET_URL = `${import.meta.env.VITE_API_URL}`;

export const VIDEO_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FORMATS: ['video/mp4', 'video/webm', 'video/ogg'],
  ASPECT_RATIO: 9 / 16
};

export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 500,
  MESSAGE_LIMIT: 50
};