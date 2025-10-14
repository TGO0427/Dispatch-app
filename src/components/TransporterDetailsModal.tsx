import React, { useState } from "react";
import { X, Save } from "lucide-react";
import { Driver, DriverStatus } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Card } from "./ui/Card";

interface TransporterDetailsModalProps {
  transporter: Driver | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Driver>) => void;
}

export const TransporterDetailsModal: React.FC<TransporterDetailsModalProps> = ({
  transporter,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: transporter?.name || "",
    callsign: transporter?.callsign || "",
    location: transporter?.location || "",
    capacity: transporter?.capacity || 0,
    status: transporter?.status || "available" as DriverStatus,
    phone: transporter?.phone || "",
    email: transporter?.email || "",
  });

  if (!transporter) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(transporter.id, formData);
    onClose();
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Edit Transporter Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Basic Information
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., ATS Logistics"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Callsign <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.callsign}
                  onChange={(e) => handleChange("callsign", e.target.value)}
                  placeholder="e.g., ATS-01"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <Input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g., National, Regional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity (pallets)
                </label>
                <Input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => handleChange("capacity", parseInt(e.target.value) || 0)}
                  placeholder="e.g., 40"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <Select
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="w-full"
              >
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
                <option value="break">On Break</option>
              </Select>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Contact Information
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="e.g., +27 12 345 6789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="e.g., contact@ats.co.za"
                />
              </div>
            </div>
          </div>

          {/* Current Stats (Read-only) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Current Statistics
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Assigned Jobs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {transporter.assignedJobs}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Available Capacity</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formData.capacity} pallets
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
