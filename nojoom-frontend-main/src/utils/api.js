import { authSession } from '../services/authSession';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const getCookie = (name) => {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
};

let csrfTokenPromise = null;

async function ensureCsrfToken() {
  let token = getCookie('csrfToken');
  if (!token) {
    csrfTokenPromise ||= fetch(`${API_BASE_URL}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
    })
      .then((response) => response.json().catch(() => ({})))
      .then((data) => data.csrfToken || getCookie('csrfToken'))
      .finally(() => {
        csrfTokenPromise = null;
      });
    token = await csrfTokenPromise;
  }
  return token;
}

async function refreshAccessToken() {
  const csrfToken = await ensureCsrfToken();
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
  });

  if (!response.ok) {
    authSession.clear();
    throw new Error('Session expired');
  }

  const data = await response.json();
  authSession.setAccessToken(data.accessToken);
  return data.accessToken;
}

async function makeAuthRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = authSession.getAccessToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const requestOptions = {
    ...options,
    credentials: 'include',
    headers,
  };

  let response = await fetch(url, requestOptions);

  if (response.status === 401) {
    if (!localStorage.getItem('user')) {
      return response;
    }
    const newToken = await refreshAccessToken();
    headers.set('Authorization', `Bearer ${newToken}`);
    response = await fetch(url, requestOptions);
  }

  return response;
}

function authGet(url, options = {}) {
  return makeAuthRequest(url, { ...options, method: 'GET' });
}

function authPost(url, data = {}, options = {}) {
  return makeAuthRequest(url, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: JSON.stringify(data),
  });
}

function authPut(url, data = {}, options = {}) {
  return makeAuthRequest(url, {
    ...options,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: JSON.stringify(data),
  });
}

function authDelete(url, options = {}) {
  return makeAuthRequest(url, { ...options, method: 'DELETE' });
}

async function validateToken() {
  try {
    const response = await makeAuthRequest(`${API_BASE_URL}/auth/verify`);
    return response.ok ? response.json() : { valid: false };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function loginUser(credentials) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  authSession.setAccessToken(data.accessToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

async function logoutUser() {
  try {
    await makeAuthRequest(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
  } finally {
    authSession.clear();
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
}

function isLoggedIn() {
  return Boolean(authSession.getAccessToken());
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function updateUserData(userData) {
  const updatedUser = { ...getCurrentUser(), ...userData };
  localStorage.setItem('user', JSON.stringify(updatedUser));
  return updatedUser;
}

async function ensureValidToken() {
  const result = await validateToken();
  if (!result.valid) {
    await logoutUser();
    return false;
  }
  return true;
}

function setupAuthInterceptor() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (url, options = {}) => {
    const target = typeof url === 'string' ? url : url.url;
    if (target.includes('/api/') && !target.includes('/auth/login') && !target.includes('/auth/register')) {
      return makeAuthRequest(url, options);
    }
    return originalFetch(url, { ...options, credentials: options.credentials || 'include' });
  };
}

function initAuthSystem() {
  setupAuthInterceptor();
}

if (typeof window !== 'undefined') {
  window.AuthAPI = {
    makeAuthRequest,
    authGet,
    authPost,
    authPut,
    authDelete,
    validateToken,
    loginUser,
    logoutUser,
    isLoggedIn,
    getCurrentUser,
    updateUserData,
    ensureValidToken,
    setupAuthInterceptor,
    initAuthSystem,
  };
}

export {
  makeAuthRequest,
  authGet,
  authPost,
  authPut,
  authDelete,
  validateToken,
  loginUser,
  logoutUser,
  isLoggedIn,
  getCurrentUser,
  updateUserData,
  ensureValidToken,
  setupAuthInterceptor,
  initAuthSystem,
};

export default window.AuthAPI;
