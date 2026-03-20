import { useDispatch } from "../context/DispatchContext";
import { Select } from "./ui/Select";
import { useMemo } from "react";

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
    <Select
      value={filters.warehouse || "all"}
      onChange={handleWarehouseChange}
      className="w-auto text-sm"
    >
      <option value="all">All Warehouses</option>
      {warehouses.map((warehouse) => (
        <option key={warehouse} value={warehouse}>{warehouse}</option>
      ))}
    </Select>
  );
};
