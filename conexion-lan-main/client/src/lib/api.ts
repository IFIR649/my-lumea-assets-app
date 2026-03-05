import { getClientId, getClientName } from "./identity";

export type Note = {
  id: string;
  title: string;
  content: string;
  pinned: 0 | 1;
  createdAt: number;
  updatedAt?: number | null;
  ip?: string | null;
  clientId?: string | null;
  clientName?: string | null;
};

export type FileItem = {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  createdAt: number | string;
  ip?: string | null;
  clientId?: string | null;
  clientName?: string | null;
};

export type ChatMsg = {
  id: string;
  type: "broadcast" | "dm";
  fromId: string;
  fromName: string;
  toId?: string;
  text: string;
  ts: number;
};

export type ChatAuditRow = {
  id: string;
  type: "broadcast" | "dm";
  fromId: string;
  fromName: string;
  toId?: string | null;
  text: string;
  ts: number;
  deliveredAt?: number | null;
  readAt?: number | null;
};

function getStoredAppKey() {
  try {
    return window.localStorage.getItem("lan_app_key") || "";
  } catch {
    return "";
  }
}

async function okJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  headers.set("x-client-id", getClientId());
  headers.set("x-app-key", getStoredAppKey());
  const name = getClientName();
  if (name) headers.set("x-client-name", name);
  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    try {
      window.localStorage.removeItem("lan_app_key");
    } catch {
      // noop
    }
    window.location.reload();
  }

  return res;
}

export const notesApi = {
  async list(): Promise<Note[]> {
    const res = await apiFetch("/api/notes");
    return okJson(res);
  },
  async top(): Promise<{ pinned: Note[]; latest: Note[] }> {
    const res = await apiFetch("/api/notes/top");
    return okJson(res);
  },
  async search(q: string, page: number): Promise<{
    q: string;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    rows: Note[];
  }> {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    usp.set("page", String(page));
    const res = await apiFetch(`/api/notes/search?${usp.toString()}`);
    return okJson(res);
  },
  async create(title: string, content: string): Promise<Note> {
    const res = await apiFetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    return okJson(res);
  },
  async delete(id: string): Promise<{ ok: true }> {
    const res = await apiFetch(`/api/notes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return okJson(res);
  },
};

export const adminNotesApi = {
  async pin(id: string, pinned: boolean): Promise<{ ok: true }> {
    const res = await apiFetch("/api/admin/notes/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pinned }),
    });
    return okJson(res);
  },
};

export const api = {
  async listFiles(): Promise<FileItem[]> {
    const res = await apiFetch("/api/files");
    return okJson(res);
  },
  async uploadFile(file: File): Promise<FileItem> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/files", { method: "POST", body: fd });
    return okJson(res);
  },
  downloadUrl(id: string) {
    const appKey = encodeURIComponent(getStoredAppKey());
    return `/api/files/${encodeURIComponent(id)}/download?appKey=${appKey}`;
  },
};

export const chatApi = {
  async send(text: string): Promise<{ ok: true }> {
    const res = await apiFetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return okJson(res);
  },
  async dm(toId: string, text: string): Promise<{ ok: true; delivered: boolean }> {
    const res = await apiFetch("/api/chat/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toId, text }),
    });
    return okJson(res);
  },
  streamUrl() {
    const id = encodeURIComponent(getClientId());
    const name = encodeURIComponent(getClientName());
    const appKey = encodeURIComponent(getStoredAppKey());
    return `/api/chat/stream?clientId=${id}&clientName=${name}&appKey=${appKey}`;
  },
};

export type AdminNetwork = {
  hostname: string;
  ips: { name: string; address: string }[];
  port: number;
  mode: "all" | "lan_only";
  lanHost: string | null;
  advertiseIp: string | null;
  links?: {
    app: string | null;
  };
};

export type ListeningPort = {
  proto: string;
  local: string;
  foreign: string;
  state: string;
  pid: string;
};

export const adminApi = {
  async network(): Promise<AdminNetwork> {
    const res = await apiFetch("/api/admin/network");
    return okJson(res);
  },
  async ports(): Promise<{ count: number; listening: ListeningPort[] }> {
    const res = await apiFetch("/api/admin/ports");
    return okJson(res);
  },
  async portCheck(port: number): Promise<{ port: number; inUse: boolean; raw: string }> {
    const res = await apiFetch(`/api/admin/port-check/${port}`);
    return okJson(res);
  },
  async suggestPorts(): Promise<{
    current: number;
    suggested: number[];
    detail: { port: number; free: boolean }[];
  }> {
    const res = await apiFetch("/api/admin/suggest-ports");
    return okJson(res);
  },
  async setPort(port: number): Promise<{ ok: true; applied: { port: number; uiPort: number } }> {
    const res = await apiFetch("/api/admin/set-port", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ port }),
    });
    return okJson(res);
  },
  async setBind(mode: "all" | "lan_only", lanHost: string, advertiseIp: string) {
    const res = await apiFetch("/api/admin/set-bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, lanHost, advertiseIp }),
    });
    return okJson(res);
  },
  async chatMessages(params: {
    limit?: number;
    before?: number;
    kind?: "" | "broadcast" | "dm";
    q?: string;
    fromId?: string;
    toId?: string;
  }): Promise<{ rows: ChatAuditRow[]; nextCursor: number | null }> {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      usp.set(key, String(value));
    }
    const query = usp.toString();
    const res = await apiFetch(`/api/admin/chat/messages${query ? `?${query}` : ""}`);
    return okJson(res);
  },
  chatExportUrl(since?: number, until?: number) {
    const usp = new URLSearchParams();
    if (since && Number.isFinite(since)) usp.set("since", String(since));
    if (until && Number.isFinite(until)) usp.set("until", String(until));
    usp.set("appKey", getStoredAppKey());
    const query = usp.toString();
    return `/api/admin/chat/export.csv${query ? `?${query}` : ""}`;
  },
  async purgeChat(olderThanDays: number): Promise<{
    ok: true;
    deleted: number;
    cutoff: number;
    olderThanDays: number;
  }> {
    const res = await apiFetch("/api/admin/chat/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ olderThanDays }),
    });
    return okJson(res);
  },
};
