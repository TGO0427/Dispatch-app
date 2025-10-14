// src/context/DispatchContext.tsx
import { createContext, useReducer, useContext, useCallback, ReactNode, useState, useEffect } from "react";
import type { Job, Driver, FilterOptions, SortOptions } from "../types"; // or "@/index" if you use a path alias
import { saveJobs, loadJobs, saveDrivers, loadDrivers } from "../utils/storage";

// ---------- State & Actions ----------
type State = {
  jobs: Job[];
  drivers: Driver[];
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
  | { type: "REMOVE_DRIVER"; id: string };

type DispatchContextValue = {
  // jobs
  jobs: Job[];
  addJob: (job: Job) => void;
  addJobs: (jobs: Job[]) => void;
  setJobs: (jobs: Job[]) => void;
  updateJob: (id: string, patch: Partial<Job>) => Promise<void> | void;
  removeJob: (id: string) => void;

  // drivers
  drivers: Driver[];
  setDrivers: (drivers: Driver[]) => void;
  addDriver: (driver: Driver) => void;
  updateDriver: (id: string, patch: Partial<Driver>) => void;
  removeDriver: (id: string) => void;

  // filters and sorting
  filters: FilterOptions;
  setFilters: (filters: FilterOptions) => void;
  resetFilters: () => void;
  sortOptions: SortOptions;
  setSortOptions: (options: SortOptions) => void;
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

    default:
      return state;
  }
}

type ProviderProps = {
  children: ReactNode;
  initialJobs?: Job[];
  initialDrivers?: Driver[];
};

export function DispatchProvider({
  children,
  initialJobs = [],
  initialDrivers = [],
}: ProviderProps) {
  // Load from localStorage on mount, fallback to initial props
  const [state, dispatch] = useReducer(reducer, {
    jobs: loadJobs() || initialJobs,
    drivers: loadDrivers() || initialDrivers,
  });

  // Filters and sorting state
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    field: "createdAt",
    direction: "desc",
  });

  const resetFilters = () => setFilters({});

  // Auto-save jobs to localStorage whenever they change
  useEffect(() => {
    saveJobs(state.jobs);
  }, [state.jobs]);

  // Auto-save drivers to localStorage whenever they change
  useEffect(() => {
    saveDrivers(state.drivers);
  }, [state.drivers]);

  // Jobs API
  const addJob = (job: Job) => dispatch({ type: "ADD_JOB", job });
  const addJobs = (jobs: Job[]) => dispatch({ type: "ADD_JOBS", jobs });
  const setJobs = (jobs: Job[]) => dispatch({ type: "SET_JOBS", jobs });
  const removeJob = (id: string) => dispatch({ type: "REMOVE_JOB", id });
  const updateJob = useCallback(async (id: string, patch: Partial<Job>) => {
    dispatch({ type: "UPDATE_JOB", id, patch });
    // Optionally persist:
    // await fetch(`/api/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }, []);

  // Drivers API
  const setDrivers = (drivers: Driver[]) => dispatch({ type: "SET_DRIVERS", drivers });
  const addDriver = (driver: Driver) => dispatch({ type: "ADD_DRIVER", driver });
  const updateDriver = (id: string, patch: Partial<Driver>) =>
    dispatch({ type: "UPDATE_DRIVER", id, patch });
  const removeDriver = (id: string) => dispatch({ type: "REMOVE_DRIVER", id });

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
  };

  return <DispatchCtx.Provider value={value}>{children}</DispatchCtx.Provider>;
}

export function useDispatch(): DispatchContextValue {
  const ctx = useContext(DispatchCtx);
  if (!ctx) throw new Error("useDispatch must be used inside <DispatchProvider>");
  return ctx;
}
