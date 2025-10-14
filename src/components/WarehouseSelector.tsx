import { Warehouse } from "lucide-react";
import { useDispatch } from "../context/DispatchContext";
import { Select } from "./ui/Select";
import { useMemo } from "react";

export const WarehouseSelector: React.FC = () => {
  const { jobs, filters, setFilters } = useDispatch();

  // Get unique warehouses from all jobs
  const warehouses = useMemo(() => {
    const warehouseSet = new Set<string>();
    jobs.forEach((job) => {
      if (job.warehouse) {
        warehouseSet.add(job.warehouse);
      }
    });
    return Array.from(warehouseSet).sort();
  }, [jobs]);

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters({
      ...filters,
      warehouse: value === "all" ? undefined : value,
    });
  };

  // Count jobs per warehouse
  const jobCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach((job) => {
      if (job.warehouse) {
        counts[job.warehouse] = (counts[job.warehouse] || 0) + 1;
      }
    });
    return counts;
  }, [jobs]);

  return (
    <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-lg border border-gray-200 shadow-sm">
      <Warehouse className="h-5 w-5 text-gray-600" />
      <span className="text-sm font-semibold text-gray-700">Warehouse:</span>
      <Select
        value={filters.warehouse || "all"}
        onChange={handleWarehouseChange}
        className="w-auto min-w-[200px]"
      >
        <option value="all">All Warehouses ({jobs.length} jobs)</option>
        {warehouses.map((warehouse) => (
          <option key={warehouse} value={warehouse}>
            {warehouse} ({jobCounts[warehouse]} jobs)
          </option>
        ))}
      </Select>
      {filters.warehouse && (
        <span className="text-xs text-gray-500">
          Showing {jobs.filter(j => j.warehouse === filters.warehouse).length} of {jobs.length} jobs
        </span>
      )}
    </div>
  );
};
