import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, X, Package, User } from "lucide-react";
import { useDispatch } from "../context/DispatchContext";

interface SearchResult {
  id: string;
  type: "job" | "driver";
  title: string;
  subtitle: string;
  status?: string;
  priority?: string;
}

interface GlobalSearchProps {
  onSelectJob?: (jobId: string) => void;
  onSelectDriver?: (driverId: string) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  assigned: "bg-blue-100 text-blue-700",
  "en-route": "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  exception: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  available: "bg-green-100 text-green-700",
  busy: "bg-orange-100 text-orange-700",
  offline: "bg-gray-100 text-gray-500",
  break: "bg-purple-100 text-purple-700",
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onSelectJob, onSelectDriver }) => {
  const { jobs, drivers } = useDispatch();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search results
  const results = useMemo((): SearchResult[] => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const matches: SearchResult[] = [];

    // Search jobs
    jobs.forEach((job) => {
      const match =
        job.ref?.toLowerCase().includes(q) ||
        job.customer?.toLowerCase().includes(q) ||
        job.pickup?.toLowerCase().includes(q) ||
        job.dropoff?.toLowerCase().includes(q) ||
        job.warehouse?.toLowerCase().includes(q) ||
        job.notes?.toLowerCase().includes(q);

      if (match) {
        matches.push({
          id: job.id,
          type: "job",
          title: `${job.ref} — ${job.customer}`,
          subtitle: `${job.pickup} → ${job.dropoff}`,
          status: job.status,
          priority: job.priority,
        });
      }
    });

    // Search drivers
    drivers.forEach((driver) => {
      const match =
        driver.name?.toLowerCase().includes(q) ||
        driver.callsign?.toLowerCase().includes(q) ||
        driver.location?.toLowerCase().includes(q) ||
        driver.email?.toLowerCase().includes(q) ||
        driver.phone?.toLowerCase().includes(q);

      if (match) {
        matches.push({
          id: driver.id,
          type: "driver",
          title: driver.name,
          subtitle: `${driver.callsign} • ${driver.location}`,
          status: driver.status,
        });
      }
    });

    return matches.slice(0, 10);
  }, [query, jobs, drivers]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    },
    [results, selectedIndex]
  );

  const handleSelect = (result: SearchResult) => {
    if (result.type === "job" && onSelectJob) {
      onSelectJob(result.id);
    } else if (result.type === "driver" && onSelectDriver) {
      onSelectDriver(result.id);
    }
    setOpen(false);
    setQuery("");
  };

  // Highlight matching text
  const highlight = (text: string) => {
    if (!query || query.length < 2) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Group results
  const jobResults = results.filter((r) => r.type === "job");
  const driverResults = results.filter((r) => r.type === "driver");

  return (
    <div ref={wrapperRef} className="relative w-80">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search jobs, drivers, customers..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-8 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-resilinc-primary focus:border-transparent shadow-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {open && query.length >= 2 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-200 max-h-96 overflow-y-auto z-50">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No results for "{query}"
            </div>
          ) : (
            <div className="py-1">
              {/* Jobs */}
              {jobResults.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                    Jobs ({jobResults.length})
                  </div>
                  {jobResults.map((result) => {
                    const globalIdx = results.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                          globalIdx === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <Package className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {highlight(result.title)}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{highlight(result.subtitle)}</div>
                        </div>
                        {result.status && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[result.status] || "bg-gray-100 text-gray-600"}`}>
                            {result.status}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              {/* Drivers */}
              {driverResults.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                    Drivers ({driverResults.length})
                  </div>
                  {driverResults.map((result) => {
                    const globalIdx = results.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                          globalIdx === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <User className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {highlight(result.title)}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{highlight(result.subtitle)}</div>
                        </div>
                        {result.status && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[result.status] || "bg-gray-100 text-gray-600"}`}>
                            {result.status}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Footer hint */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-2">
            <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-500 font-mono">↑↓</kbd> navigate
            <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-500 font-mono">↵</kbd> select
            <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-500 font-mono">esc</kbd> close
          </div>
        </div>
      )}
    </div>
  );
};
