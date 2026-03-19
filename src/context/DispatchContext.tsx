// src/context/DispatchContext.tsx
import { createContext, useReducer, useContext, useCallback, ReactNode, useState, useEffect } from "react";
import type { Job, Driver, FilterOptions, SortOptions } from "../types";
import { saveJobs, loadJobs, saveDrivers, loadDrivers } from "../utils/storage";
import { jobsAPI, driversAPI } from "../services/api";

// ---------- State & Actions ----------
type State = {
  jobs: Job[];
  drivers: Driver[];
  isLoading: boolean;
  error: string | null;
};

type Action =
  | { type: "ADD_JOB"; job: Job }
  | { type: "ADD_JOBS"; jobs: Job[] }
  | { type: "SET_JOBS"; jobs: Job[] }
  | { type: "UPDATE_JOB"; id: string; patch: Partial<Job> }
  | { type: "REMOVE_JOB"; id: string }
  | { type: "SET_DRIVERS"; drivers: Driver[] }
  | { type: "ADD_DRIVER"; driver: Driver }
  | { type: "UPDATE_DRIVER"; id: string; patch: Partial<Driver> }
  | { type: "REMOVE_DRIVER"; id: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null };

type DispatchContextValue = {
  // jobs
  jobs: Job[];
  addJob: (job: Job) => Promise<void>;
  addJobs: (jobs: Job[]) => Promise<void>;
  setJobs: (jobs: Job[]) => void;
  updateJob: (id: string, patch: Partial<Job>) => Promise<void>;
  removeJob: (id: string) => Promise<void>;

  // drivers
  drivers: Driver[];
  setDrivers: (drivers: Driver[]) => void;
  addDriver: (driver: Driver) => Promise<void>;
  updateDriver: (id: string, patch: Partial<Driver>) => Promise<void>;
  removeDriver: (id: string) => Promise<void>;

  // filters and sorting
  filters: FilterOptions;
  setFilters: (filters: FilterOptions) => void;
  resetFilters: () => void;
  sortOptions: SortOptions;
  setSortOptions: (options: SortOptions) => void;

  // loading and error states
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  refreshData: () => Promise<void>;
};

const DispatchCtx = createContext<DispatchContextValue | null>(null);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    // Jobs
    case "ADD_JOB":
      return { ...state, jobs: [action.job, ...state.jobs] };
    case "ADD_JOBS":
      return { ...state, jobs: [...action.jobs, ...state.jobs] };
    case "SET_JOBS":
      return { ...state, jobs: action.jobs };
    case "UPDATE_JOB":
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.id ? { ...j, ...action.patch, updatedAt: new Date().toISOString() } : j
        ),
      };
    case "REMOVE_JOB":
      return { ...state, jobs: state.jobs.filter((j) => j.id !== action.id) };

    // Drivers
    case "SET_DRIVERS":
      return { ...state, drivers: [...action.drivers] };
    case "ADD_DRIVER":
      return { ...state, drivers: [action.driver, ...state.drivers] };
    case "UPDATE_DRIVER":
      return {
        ...state,
        drivers: state.drivers.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)),
      };
    case "REMOVE_DRIVER":
      return { ...state, drivers: state.drivers.filter((d) => d.id !== action.id) };

    // Loading and errors
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };

    default:
      return state;
  }
}

type ProviderProps = {
  children: ReactNode;
  initialJobs?: Job[];
  initialDrivers?: Driver[];
  useAPI?: boolean; // Toggle between API and localStorage
};

export function DispatchProvider({
  children,
  initialJobs = [],
  initialDrivers = [],
  useAPI = true, // Default to using API
}: ProviderProps) {
  // Initialize state with localStorage as fallback
  const [state, dispatch] = useReducer(reducer, {
    jobs: loadJobs() || initialJobs,
    drivers: loadDrivers() || initialDrivers,
    isLoading: false,
    error: null,
  });

  // Filters and sorting state
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    field: "createdAt",
    direction: "desc",
  });

  const resetFilters = () => setFilters({});
  const clearError = () => dispatch({ type: "SET_ERROR", error: null });

  // Refresh data from API (silent=true skips loading indicator for background polls)
  const refreshData = useCallback(async (silent = false) => {
    if (!useAPI) return;

    try {
      if (!silent) {
        dispatch({ type: "SET_LOADING", loading: true });
      }
      dispatch({ type: "SET_ERROR", error: null });

      const [fetchedJobs, fetchedDrivers] = await Promise.all([
        jobsAPI.getAll().catch(() => []),
        driversAPI.getAll().catch(() => []),
      ]);

      dispatch({ type: "SET_JOBS", jobs: fetchedJobs });
      dispatch({ type: "SET_DRIVERS", drivers: fetchedDrivers });

      // Also save to localStorage as backup
      saveJobs(fetchedJobs);
      saveDrivers(fetchedDrivers);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load data";
      if (!silent) {
        dispatch({ type: "SET_ERROR", error: errorMessage });
      }
      console.error("Failed to refresh data:", error);
    } finally {
      if (!silent) {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    }
  }, [useAPI]);

  // Fetch initial data on mount + silent auto-refresh every 15 seconds
  // Use silent fetch if we already have cached data (prevents flash of empty state on reload)
  useEffect(() => {
    if (useAPI) {
      const hasCachedData = state.jobs.length > 0 || state.drivers.length > 0;
      refreshData(hasCachedData);
      const interval = setInterval(() => refreshData(true), 15000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useAPI]);

  // Auto-save to localStorage (backup)
  useEffect(() => {
    saveJobs(state.jobs);
  }, [state.jobs]);

  useEffect(() => {
    saveDrivers(state.drivers);
  }, [state.drivers]);

  // Jobs API
  const addJob = useCallback(async (job: Job) => {
    try {
      dispatch({ type: "SET_LOADING", loading: true });

      if (useAPI) {
        const createdJob = await jobsAPI.create(job);
        dispatch({ type: "ADD_JOB", job: createdJob });
      } else {
        dispatch({ type: "ADD_JOB", job });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add job";
      dispatch({ type: "SET_ERROR", error: errorMessage });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [useAPI]);

  const addJobs = useCallback(async (jobs: Job[]) => {
    try {
      dispatch({ type: "SET_LOADING", loading: true });

      if (useAPI) {
        const createdJobs = await jobsAPI.bulkCreate(jobs);
        dispatch({ type: "ADD_JOBS", jobs: createdJobs });
      } else {
        dispatch({ type: "ADD_JOBS", jobs });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add jobs";
      dispatch({ type: "SET_ERROR", error: errorMessage });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [useAPI]);

  const setJobs = (jobs: Job[]) => dispatch({ type: "SET_JOBS", jobs });

  const removeJob = useCallback(async (id: string) => {
    try {
      dispatch({ type: "SET_LOADING", loading: true });

      if (useAPI) {
        await jobsAPI.delete(id);
      }

      dispatch({ type: "REMOVE_JOB", id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remove job";
      dispatch({ type: "SET_ERROR", error: errorMessage });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [useAPI]);

  const updateJob = useCallback(async (id: string, patch: Partial<Job>) => {
    try {
      dispatch({ type: "SET_LOADING", loading: true });

      // Update local state immediately (optimistic)
      dispatch({ type: "UPDATE_JOB", id, patch });

      if (useAPI) {
        // Convert undefined to null for fields that need to be cleared in the DB
        // JSON.stringify strips undefined values, so Prisma wouldn't clear them
        const apiPatch: Record<string, any> = {};
        for (const [key, value] of Object.entries(patch)) {
          if (key === "readyForDispatch") continue; // Computed field, not in DB
          apiPatch[key] = value === undefined ? null : value;
        }
        await jobsAPI.update(id, apiPatch as Partial<Job>);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update job";
      dispatch({ type: "SET_ERROR", error: errorMessage });
      // Re-fetch to revert optimistic update on failure
      refreshData(true);
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [useAPI, refreshData]);

  // Drivers API
  const setDrivers = (drivers: Driver[]) => dispatch({ type: "SET_DRIVERS", drivers });

  const addDriver = useCallback(async (driver: Driver) => {
    try {
      dispatch({ type: "SET_LOADING", loading: true });

      if (useAPI) {
        const createdDriver = await driversAPI.create(driver);
        dispatch({ type: "ADD_DRIVER", driver: createdDriver });
      } else {
        dispatch({ type: "ADD_DRIVER", driver });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add driver";
      dispatch({ type: "SET_ERROR", error: errorMessage });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [useAPI]);

  const updateDriver = useCallback(async (id: string, patch: Partial<Driver>) => {
    try {
      dispatch({ type: "SET_LOADING", loading: true });

      if (useAPI) {
        await driversAPI.update(id, patch);
      }

      dispatch({ type: "UPDATE_DRIVER", id, patch });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update driver";
      dispatch({ type: "SET_ERROR", error: errorMessage });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [useAPI]);

  const removeDriver = useCallback(async (id: string) => {
    try {
      dispatch({ type: "SET_LOADING", loading: true });

      if (useAPI) {
        await driversAPI.delete(id);
      }

      dispatch({ type: "REMOVE_DRIVER", id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remove driver";
      dispatch({ type: "SET_ERROR", error: errorMessage });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [useAPI]);

  const value: DispatchContextValue = {
    jobs: state.jobs,
    addJob,
    addJobs,
    setJobs,
    updateJob,
    removeJob,

    drivers: state.drivers,
    setDrivers,
    addDriver,
    updateDriver,
    removeDriver,

    filters,
    setFilters,
    resetFilters,
    sortOptions,
    setSortOptions,

    isLoading: state.isLoading,
    error: state.error,
    clearError,
    refreshData,
  };

  return <DispatchCtx.Provider value={value}>{children}</DispatchCtx.Provider>;
}

export function useDispatch(): DispatchContextValue {
  const ctx = useContext(DispatchCtx);
  if (!ctx) throw new Error("useDispatch must be used inside <DispatchProvider>");
  return ctx;
}
