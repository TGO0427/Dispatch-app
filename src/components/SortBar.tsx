import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useDispatch } from "../context/DispatchContext";
import { SortField } from "../types";

export const SortBar: React.FC = () => {
  const { sortOptions, setSortOptions } = useDispatch();

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={sortOptions.field}
        onChange={(e) => setSortOptions({ ...sortOptions, field: e.target.value as SortField })}
        className="h-7 text-[11px] border border-gray-300 rounded-md bg-white px-2 py-0 focus:outline-none focus:ring-2 focus:ring-resilinc-primary"
      >
        <option value="createdAt">Sort: Date</option>
        <option value="ref">Sort: Ref</option>
        <option value="customer">Sort: Customer</option>
        <option value="priority">Sort: Priority</option>
        <option value="eta">Sort: ETA</option>
      </select>
      <button
        onClick={() => setSortOptions({ ...sortOptions, direction: sortOptions.direction === "asc" ? "desc" : "asc" })}
        title={sortOptions.direction === "asc" ? "Sort Descending" : "Sort Ascending"}
        className="h-7 w-7 rounded-md border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 text-gray-600"
      >
        {sortOptions.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      </button>
    </div>
  );
};
