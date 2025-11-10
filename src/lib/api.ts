export const getToken = () => localStorage.getItem("token") ?? "";
export const setToken = (t: string) => localStorage.setItem("token", t);

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // token expiroval / neplatný -> odhlásit a dát vědět UI
    localStorage.removeItem("token");
    try {
      window.dispatchEvent(new Event("auth:unauthorized"));
    } catch {}
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  const ct = res.headers.get("content-type") || "";
  return (ct.includes("application/json") ? res.json() : (undefined as unknown)) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(body)
  });
  return handle<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(body)
  });
  return handle<T>(res);
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return handle<T>(res);
}