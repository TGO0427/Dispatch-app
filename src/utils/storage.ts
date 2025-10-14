// src/utils/storage.ts
import type { Job, Driver } from "../types";

const STORAGE_KEYS = {
  JOBS: "dispatch-app-jobs",
  DRIVERS: "dispatch-app-drivers",
} as const;

/**
 * Save jobs to localStorage
 */
export function saveJobs(jobs: Job[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
  } catch (error) {
    console.error("Failed to save jobs to localStorage:", error);
  }
}

/**
 * Load jobs from localStorage
 */
export function loadJobs(): Job[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.JOBS);
    if (!stored) return null;
    return JSON.parse(stored) as Job[];
  } catch (error) {
    console.error("Failed to load jobs from localStorage:", error);
    return null;
  }
}

/**
 * Save drivers to localStorage
 */
export function saveDrivers(drivers: Driver[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
  } catch (error) {
    console.error("Failed to save drivers to localStorage:", error);
  }
}

/**
 * Load drivers from localStorage
 */
export function loadDrivers(): Driver[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DRIVERS);
    if (!stored) return null;
    return JSON.parse(stored) as Driver[];
  } catch (error) {
    console.error("Failed to load drivers from localStorage:", error);
    return null;
  }
}

/**
 * Clear all stored data
 */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.JOBS);
    localStorage.removeItem(STORAGE_KEYS.DRIVERS);
  } catch (error) {
    console.error("Failed to clear localStorage:", error);
  }
}
