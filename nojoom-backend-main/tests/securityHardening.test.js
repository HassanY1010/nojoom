import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const frontendRoot = path.resolve('..', 'nojoom-frontend-main');

const read = (file) => fs.readFileSync(file, 'utf8');

test('frontend does not persist auth tokens in browser storage', () => {
  const files = [
    'src/services/api.ts',
    'src/services/auth.ts',
    'src/store/useAuthStore.ts',
    'src/store/useSocketStore.ts',
    'src/services/socket.ts',
    'src/utils/api.js',
  ].map((file) => path.join(frontendRoot, file));

  const forbidden = /localStorage\.(getItem|setItem|removeItem)\(['"](accessToken|refreshToken|token)['"]\)/;
  for (const file of files) {
    assert.equal(forbidden.test(read(file)), false, `${file} persists an auth token`);
  }
});

test('auth responses do not expose refresh tokens in JSON', () => {
  const authController = read(path.join(root, 'controllers', 'authController.js'));
  const usersController = read(path.join(root, 'controllers', 'usersController.js'));
  const tokenRoutes = read(path.join(root, 'routes', 'tokenRoutes.js'));

  for (const [name, content] of Object.entries({ authController, usersController, tokenRoutes })) {
    assert.equal(/refreshToken:\s*(result\.refreshToken|newRefreshToken|latestToken)/.test(content), false, `${name} exposes refresh tokens`);
  }
});

test('production upload storage cannot silently fall back to local disk', () => {
  const storageService = read(path.join(root, 'services', 'storageService.js'));
  assert.match(storageService, /Local upload storage is not allowed in production/);
  assert.match(storageService, /STORAGE_PROVIDER=s3/);
});

test('csrf protection is wired for cookie-authenticated requests', () => {
  const server = read(path.join(root, 'server.js'));
  const csrf = read(path.join(root, 'middleware', 'csrfMiddleware.js'));
  const frontendApi = read(path.join(frontendRoot, 'src', 'services', 'api.ts'));

  assert.match(server, /cookieParser\(\)/);
  assert.match(server, /csrfProtection/);
  assert.match(csrf, /x-csrf-token/);
  assert.match(frontendApi, /X-CSRF-Token/);
});

test('socket.io has a production Redis adapter path', () => {
  const socketManager = read(path.join(root, 'socket', 'socketManager.js'));
  assert.match(socketManager, /@socket\.io\/redis-adapter/);
  assert.match(socketManager, /NODE_ENV === 'production'/);
  assert.match(socketManager, /createAdapter/);
});

test('video uploads validate file signatures beyond client MIME type', () => {
  const uploadMiddleware = read(path.join(root, 'middleware', 'uploadMiddleware.js'));
  const videoController = read(path.join(root, 'controllers', 'videoController.js'));

  assert.match(uploadMiddleware, /validateUploadedFileSignature/);
  assert.match(uploadMiddleware, /ftyp/);
  assert.match(uploadMiddleware, /1a45dfa3/);
  assert.match(videoController, /Invalid or unsupported video file signature/);
});
