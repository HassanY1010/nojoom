import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '..', 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const avatarsDir = path.join(uploadsDir, 'avatars');
const audioDir = path.join(uploadsDir, 'audio');
const storiesDir = path.join(uploadsDir, 'stories');
const groupAvatarsDir = path.join(uploadsDir, 'groups');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

[uploadsDir, videosDir, avatarsDir, audioDir, storiesDir, groupAvatarsDir].forEach(ensureDir);

const extensionByMime = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogg',
  'video/quicktime': '.mov',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/m4a': '.m4a',
};

const safeFilename = (prefix, mimetype) => {
  const ext = extensionByMime[mimetype] || '.bin';
  return `${prefix}-${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
};

const createStorage = (destination, prefix) => multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, destination),
  filename: (_req, file, cb) => cb(null, safeFilename(prefix, file.mimetype)),
});

const createFileFilter = (allowedTypes, label) => (_req, file, cb) => {
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error(`Only ${label} files are allowed`), false);
  }
  cb(null, true);
};

const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3', 'audio/m4a'];
const storyTypes = [...imageTypes, ...videoTypes];

export const upload = multer({
  storage: createStorage(videosDir, 'video'),
  fileFilter: createFileFilter(videoTypes, 'video'),
  limits: { files: 1, fileSize: 100 * 1024 * 1024 },
});

export const uploadAvatar = multer({
  storage: createStorage(avatarsDir, 'avatar'),
  fileFilter: createFileFilter(imageTypes, 'image'),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
});

export const uploadAudio = multer({
  storage: createStorage(audioDir, 'audio'),
  fileFilter: createFileFilter(audioTypes, 'audio'),
  limits: { files: 1, fileSize: 20 * 1024 * 1024 },
});

export const uploadStory = multer({
  storage: createStorage(storiesDir, 'story'),
  fileFilter: createFileFilter(storyTypes, 'story media'),
  limits: { files: 1, fileSize: 50 * 1024 * 1024 },
});

export const uploadGroupAvatar = multer({
  storage: createStorage(groupAvatarsDir, 'group'),
  fileFilter: createFileFilter(imageTypes, 'image'),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
});

const safeJoin = (baseDir, filename) => {
  const resolved = path.resolve(baseDir, path.basename(filename));
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error('Invalid file path');
  }
  return resolved;
};

export const checkFileExists = (filename) => fs.existsSync(safeJoin(videosDir, filename));
export const getVideoFilePath = (filename) => safeJoin(videosDir, filename);
export const getAvatarFilePath = (filename) => safeJoin(avatarsDir, filename);
export const getAudioFilePath = (filename) => safeJoin(audioDir, filename);

export const validateUploadedFileSignature = (file) => {
  const header = fs.readFileSync(file.path, { encoding: null, flag: 'r' }).subarray(0, 16);
  const hex = header.toString('hex');
  const ascii = header.toString('ascii');

  const validators = {
    'video/mp4': () => ascii.slice(4, 8) === 'ftyp',
    'video/quicktime': () => ascii.slice(4, 8) === 'ftyp',
    'video/webm': () => hex.startsWith('1a45dfa3'),
    'video/ogg': () => ascii.startsWith('OggS'),
    'image/jpeg': () => hex.startsWith('ffd8ff'),
    'image/jpg': () => hex.startsWith('ffd8ff'),
    'image/png': () => hex.startsWith('89504e470d0a1a0a'),
    'image/gif': () => ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a'),
    'image/webp': () => ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP',
  };

  const validate = validators[file.mimetype];
  return validate ? validate() : false;
};

export default {
  upload,
  uploadAvatar,
  uploadAudio,
  uploadStory,
  uploadGroupAvatar,
  checkFileExists,
  getVideoFilePath,
  getAvatarFilePath,
  getAudioFilePath,
  validateUploadedFileSignature,
};
