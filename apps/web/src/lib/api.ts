const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiError {
  success: false;
  error: { code: string; message: string };
}

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }
}

export function loadTokens() {
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('accessToken');
    refreshToken = localStorage.getItem('refreshToken');
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}

export function getAccessToken() {
  return accessToken;
}

const NETWORK_ERROR =
  'Không thể kết nối tới server. Kiểm tra kết nối mạng rồi thử lại.';

type Body =
  | { kind: 'json'; value: unknown }
  | { kind: 'empty' }
  | { kind: 'text'; value: string };

/**
 * Read a response body without assuming it is JSON.
 *
 * A gateway timeout, a cold-starting server, a 204, or an HTML error page from
 * a proxy all produce a body that `res.json()` cannot parse — it throws
 * "Unexpected end of JSON input" and hides the real HTTP status.
 */
async function readBody(res: Response): Promise<Body> {
  if (res.status === 204 || res.status === 205 || res.status === 304) {
    return { kind: 'empty' };
  }
  let text: string;
  try {
    text = await res.text();
  } catch {
    return { kind: 'empty' };
  }
  const trimmed = text.trim();
  if (!trimmed) return { kind: 'empty' };
  try {
    return { kind: 'json', value: JSON.parse(trimmed) };
  } catch {
    return { kind: 'text', value: trimmed };
  }
}

function errorMessage(res: Response, body: Body): string {
  // The API's own error envelope: {success: false, error: {code, message}}
  if (body.kind === 'json') {
    const payload = body.value as ApiError;
    if (payload?.error?.message) return payload.error.message;
  }

  switch (res.status) {
    case 401:
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 403:
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 404:
      return `Không tìm thấy đường dẫn trên server (404). Kiểm tra NEXT_PUBLIC_API_URL.`;
    case 429:
      return 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ một phút rồi thử lại.';
    case 502:
    case 503:
    case 504:
      return 'Server đang khởi động lại (bản miễn phí sẽ ngủ khi không dùng). Chờ khoảng 30–60 giây rồi thử lại.';
  }

  if (body.kind === 'text') {
    return `Server trả về phản hồi không phải JSON (HTTP ${res.status}).`;
  }
  return `Yêu cầu thất bại (HTTP ${res.status}).`;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;

    const body = await readBody(res);
    if (body.kind !== 'json') return false;

    const json = body.value as ApiResponse<{
      accessToken: string;
      refreshToken: string;
    }>;
    if (!json?.data?.accessToken || !json?.data?.refreshToken) return false;

    setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  loadTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error(NETWORK_ERROR);
  }

  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      try {
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      } catch {
        throw new Error(NETWORK_ERROR);
      }
    }
  }

  const body = await readBody(res);

  if (!res.ok) {
    throw new Error(errorMessage(res, body));
  }

  // A successful response with no body (e.g. 204) is valid for void endpoints.
  if (body.kind === 'empty') {
    return undefined as T;
  }
  if (body.kind === 'text') {
    throw new Error('Server trả về phản hồi không phải JSON.');
  }

  return (body.value as ApiResponse<T>).data;
}
