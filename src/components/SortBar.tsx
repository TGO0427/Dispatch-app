import React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { useDispatch } from "../context/DispatchContext";
import { SortField } from "../types";

export const SortBar: React.FC = () => {
  const { sortOptions, setSortOptions } = useDispatch();

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOptions({
      ...sortOptions,
      field: e.target.value as SortField,
    });
  };

  const toggleDirection = () => {
    setSortOptions({
      ...sortOptions,
      direction: sortOptions.direction === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-4 w-4 text-gray-500" />
      <span className="text-sm font-semibold text-gray-700">Sort by:</span>

      <Select
        value={sortOptions.field}
        onChange={handleFieldChange}
        className="w-auto"
      >
        <option value="createdAt">Created Date</option>
        <option value="ref">Reference</option>
        <option value="customer">Customer</option>
        <option value="priority">Priority</option>
        <option value="status">Status</option>
        <option value="eta">ETA</option>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={toggleDirection}
        title={`Sort ${sortOptions.direction === "asc" ? "Descending" : "Ascending"}`}
      >
        {sortOptions.direction === "asc" ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};
