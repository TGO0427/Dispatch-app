import React, { useMemo } from "react";
import { useDispatch } from "../context/DispatchContext";

export const WarehouseSelector: React.FC = () => {
  const { jobs, filters, setFilters } = useDispatch();

  const warehouses = useMemo(() => {
    const warehouseSet = new Set<string>();
    jobs.forEach((job) => {
      if (job.warehouse) warehouseSet.add(job.warehouse);
    });
    return Array.from(warehouseSet).sort();
  }, [jobs]);

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters({ ...filters, warehouse: value === "all" ? undefined : value });
  };

  return (
    <select
      value={filters.warehouse || "all"}
      onChange={handleWarehouseChange}
      className="h-7 text-[11px] border border-gray-300 rounded-md bg-white px-2 py-0 focus:outline-none focus:ring-2 focus:ring-resilinc-primary"
    >
      <option value="all">All Warehouses</option>
      {warehouses.map((warehouse) => (
        <option key={warehouse} value={warehouse}>{warehouse}</option>
      ))}
    </select>
  );
};
