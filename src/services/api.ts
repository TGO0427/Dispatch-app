// src/services/api.ts
import type { Job, Driver } from "../types";

// For serverless: API is on the same domain, use relative paths
// For local dev with vercel dev: also relative
// Only set VITE_API_URL if you need to point to a different backend
const API_URL = import.meta.env.VITE_API_URL || "";

// Get auth token for API requests
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Helper function for API requests
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token rejected mid-session (expired or revoked). Drop it and surface
        // an event so AuthProvider clears user state and prompts re-login.
        // Login itself bypasses fetchAPI, so this never fires on bad credentials.
        localStorage.removeItem("authToken");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth:expired"));
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || errorData.message || `API Error: ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json();

    // Backend wraps responses in { success, data }
    if (json.success !== undefined && json.data !== undefined) {
      return json.data as T;
    }

    return json as T;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
    throw new Error("Unknown error occurred");
  }
}

// ============ Jobs API ============

export const jobsAPI = {
  getAll: async (): Promise<Job[]> => {
    return fetchAPI<Job[]>("/api/jobs");
  },

  getById: async (id: string): Promise<Job> => {
    return fetchAPI<Job>(`/api/jobs?id=${id}`);
  },

  create: async (job: Omit<Job, "id" | "createdAt" | "updatedAt">): Promise<Job> => {
    return fetchAPI<Job>("/api/jobs", {
      method: "POST",
      body: JSON.stringify(job),
    });
  },

  update: async (id: string, patch: Partial<Job>): Promise<Job> => {
    return fetchAPI<Job>(`/api/jobs?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  delete: async (id: string): Promise<void> => {
    return fetchAPI<void>(`/api/jobs?id=${id}`, {
      method: "DELETE",
    });
  },

  bulkCreate: async (jobs: Omit<Job, "id" | "createdAt" | "updatedAt">[]): Promise<Job[]> => {
    return fetchAPI<Job[]>("/api/jobs?action=bulk", {
      method: "POST",
      body: JSON.stringify({ jobs }),
    });
  },

  bulkReplace: async (jobs: Omit<Job, "id" | "createdAt" | "updatedAt">[], jobType: "order" | "ibt" = "order"): Promise<Job[]> => {
    return fetchAPI<Job[]>("/api/jobs?action=bulk-replace", {
      method: "POST",
      body: JSON.stringify({ jobs, jobType }),
    });
  },

  bulkDelete: async (ids: string[]): Promise<{ deleted: number }> => {
    return fetchAPI<{ deleted: number }>("/api/jobs?action=bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },

  bulkUpdate: async (ids: string[], patch: Partial<Job>): Promise<Job[]> => {
    return fetchAPI<Job[]>("/api/jobs?action=bulk-update", {
      method: "POST",
      body: JSON.stringify({ ids, patch }),
    });
  },
};

// ============ Drivers API ============

export const driversAPI = {
  getAll: async (): Promise<Driver[]> => {
    return fetchAPI<Driver[]>("/api/drivers");
  },

  getById: async (id: string): Promise<Driver> => {
    return fetchAPI<Driver>(`/api/drivers?id=${id}`);
  },

  create: async (driver: Omit<Driver, "id">): Promise<Driver> => {
    return fetchAPI<Driver>("/api/drivers", {
      method: "POST",
      body: JSON.stringify(driver),
    });
  },

  update: async (id: string, patch: Partial<Driver>): Promise<Driver> => {
    return fetchAPI<Driver>(`/api/drivers?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  delete: async (id: string): Promise<void> => {
    return fetchAPI<void>(`/api/drivers?id=${id}`, {
      method: "DELETE",
    });
  },
};

// ============ Flowbin Batches ============
export const flowbinsAPI = {
  getAll: () => fetchAPI<any[]>("/api/flowbins"),
  create: (data: { jobId: string; batchNumber: string; quantity: number }) =>
    fetchAPI<any>("/api/flowbins", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchAPI<any>(`/api/flowbins?id=${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) =>
    fetchAPI<void>(`/api/flowbins?id=${id}`, { method: "DELETE" }),
  markReturned: (id: string, data: { quantityReturned: number; returnedAt: string; returnNotes?: string }) =>
    fetchAPI<any>(`/api/flowbins?id=${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ============ Messages ============
export const messagesAPI = {
  getInbox: () => fetchAPI<any[]>("/api/messages"),
  getSent: () => fetchAPI<any[]>("/api/messages?folder=sent"),
  getThread: (threadId: string) => fetchAPI<any[]>(`/api/messages?folder=thread&threadId=${threadId}`),
  getUnreadCount: () => fetchAPI<{ count: number }>("/api/messages?folder=unread-count"),
  send: (data: { subject: string; body: string; recipientIds?: string[]; jobRef?: string; priority?: string; broadcast?: boolean; threadId?: string }) =>
    fetchAPI<any>("/api/messages", { method: "POST", body: JSON.stringify(data) }),
  markRead: (id: string) =>
    fetchAPI<void>(`/api/messages?id=${id}`, { method: "PUT" }),
  remove: (id: string) =>
    fetchAPI<void>(`/api/messages?id=${id}`, { method: "DELETE" }),
};

// ============ Health Check ============

export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  return fetchAPI<{ status: string; timestamp: string }>("/api/health");
};

export const privacyAPI = {
  exportMyData: async (): Promise<void> => {
    const url = `${API_URL}/api/auth?action=data-export`;
    const response = await fetch(url, { headers: { ...getAuthHeaders() } });
    if (!response.ok) throw new Error("Export failed");
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `my-data-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  },
  eraseUser: async (userId: string): Promise<{ message: string }> => {
    return fetchAPI<{ message: string }>("/api/auth?action=erase-user", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },
};

export { API_URL };
