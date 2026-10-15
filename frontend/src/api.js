const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const parsedApiUrl = new URL(configuredApiUrl)
const configuredApiPath = parsedApiUrl.pathname.replace(/\/+$/, '')
const apiPath = configuredApiPath.endsWith('/api')
  ? configuredApiPath
  : `${configuredApiPath}/api`

export const API_BASE_URL = `${parsedApiUrl.origin}${apiPath}`
export const API_SERVER_URL = parsedApiUrl.origin

export function resolveApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path

  const requestPath = String(path || '')
  const apiRelativePath = requestPath === '/api'
    ? ''
    : requestPath.startsWith('/api/')
      ? requestPath.slice(4)
      : requestPath.startsWith('/')
        ? requestPath
        : `/${requestPath}`

  return `${API_BASE_URL}${apiRelativePath}`
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(resolveApiUrl(path), {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson ? payload?.message : 'Request failed.';
    const error = new Error(message || 'Request failed.');
    error.status = response.status;
    error.data = payload;
    throw error;
  }

  return payload;
}
