// src/services/api.ts
import type { Job, Driver } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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
        ...options?.headers,
      },
    });

    if (!response.ok) {
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
  // Get all jobs
  getAll: async (): Promise<Job[]> => {
    return fetchAPI<Job[]>("/api/jobs");
  },

  // Get a single job by ID
  getById: async (id: string): Promise<Job> => {
    return fetchAPI<Job>(`/api/jobs/${id}`);
  },

  // Create a new job
  create: async (job: Omit<Job, "id" | "createdAt" | "updatedAt">): Promise<Job> => {
    return fetchAPI<Job>("/api/jobs", {
      method: "POST",
      body: JSON.stringify(job),
    });
  },

  // Update a job
  update: async (id: string, patch: Partial<Job>): Promise<Job> => {
    return fetchAPI<Job>(`/api/jobs/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  // Delete a job
  delete: async (id: string): Promise<void> => {
    return fetchAPI<void>(`/api/jobs/${id}`, {
      method: "DELETE",
    });
  },

  // Bulk create jobs
  bulkCreate: async (jobs: Omit<Job, "id" | "createdAt" | "updatedAt">[]): Promise<Job[]> => {
    return fetchAPI<Job[]>("/api/jobs/bulk", {
      method: "POST",
      body: JSON.stringify({ jobs }),
    });
  },

  // Bulk replace jobs (delete all existing and create new ones)
  bulkReplace: async (jobs: Omit<Job, "id" | "createdAt" | "updatedAt">[]): Promise<Job[]> => {
    return fetchAPI<Job[]>("/api/jobs/bulk-replace", {
      method: "POST",
      body: JSON.stringify({ jobs }),
    });
  },
};

// ============ Drivers API ============

export const driversAPI = {
  // Get all drivers
  getAll: async (): Promise<Driver[]> => {
    return fetchAPI<Driver[]>("/api/drivers");
  },

  // Get a single driver by ID
  getById: async (id: string): Promise<Driver> => {
    return fetchAPI<Driver>(`/api/drivers/${id}`);
  },

  // Create a new driver
  create: async (driver: Omit<Driver, "id">): Promise<Driver> => {
    return fetchAPI<Driver>("/api/drivers", {
      method: "POST",
      body: JSON.stringify(driver),
    });
  },

  // Update a driver
  update: async (id: string, patch: Partial<Driver>): Promise<Driver> => {
    return fetchAPI<Driver>(`/api/drivers/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  // Delete a driver
  delete: async (id: string): Promise<void> => {
    return fetchAPI<void>(`/api/drivers/${id}`, {
      method: "DELETE",
    });
  },
};

// ============ Health Check ============

export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  return fetchAPI<{ status: string; timestamp: string }>("/health");
};

// Export API_URL for reference
export { API_URL };
