import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { useDispatch } from "../context/DispatchContext";
import { SortField } from "../types";

export const SortBar: React.FC = () => {
  const { sortOptions, setSortOptions } = useDispatch();

  return (
    <>
      <Select
        value={sortOptions.field}
        onChange={(e) => setSortOptions({ ...sortOptions, field: e.target.value as SortField })}
        className="w-auto text-sm"
      >
        <option value="createdAt">Sort: Date</option>
        <option value="ref">Sort: Ref</option>
        <option value="customer">Sort: Customer</option>
        <option value="priority">Sort: Priority</option>
        <option value="eta">Sort: ETA</option>
      </Select>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setSortOptions({ ...sortOptions, direction: sortOptions.direction === "asc" ? "desc" : "asc" })}
        title={sortOptions.direction === "asc" ? "Sort Descending" : "Sort Ascending"}
        className="h-9 w-9"
      >
        {sortOptions.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      </Button>
    </>
  );
};
