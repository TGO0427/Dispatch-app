import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Globe2,
  Package,
  Search,
  ShieldCheck,
  Truck,
  UserPlus,
} from "lucide-react";

import { useDispatch } from "../../context/DispatchContext";
import { useNotification } from "../../context/NotificationContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";

import type { Driver, Job } from "../../types";

type ExportTab = "overview" | "documents" | "permits" | "incoterms";
type DocumentStatus = Record<string, boolean>;

interface ExportShipment {
  ref: string;
  customer: string;
  destinationCountry: string;
  hsCode: string;
  productType: string;
  incoterm: string;
  transportMode: string;
  preferenceScheme: string;
  destinationAgent: string;
  lastCheckedAt: string;
  notes: string;
  documents: DocumentStatus;
}

interface ChecklistItem {
  id: string;
  label: string;
  purpose: string;
  required?: boolean;
  conditional?: string;
}

interface ChecklistGroup {
  title: string;
  description: string;
  items: ChecklistItem[];
}

const STORAGE_KEY = "dispatch_africa_export_shipments";

const CORE_DOCUMENTS: ChecklistItem[] = [
  { id: "commercial-invoice", label: "Commercial Invoice", purpose: "Customs valuation, buyer and seller details, Incoterm, currency, HS code, product description, and country of origin.", required: true },
  { id: "packing-list", label: "Packing List", purpose: "Carton or pallet count, gross and net weight, dimensions, and batch numbers where applicable.", required: true },
  { id: "sad-500", label: "SAD 500 / Export Customs Declaration", purpose: "South African customs export declaration lodged with SARS.", required: true },
  { id: "transport-document", label: "Transport Document", purpose: "Road consignment note, CMR, air waybill, or bill of lading depending on transport mode.", required: true },
  { id: "hs-code", label: "HS Code / Tariff Classification", purpose: "Required for SA export declaration and destination import clearance.", required: true },
  { id: "exporter-code", label: "Exporter Customs Code / SARS Registration", purpose: "Confirms the exporter is registered with SARS Customs where required.", required: true },
  { id: "proof-export", label: "Proof of Export Pack", purpose: "VAT zero-rating and customs audit support: SAD 500, transport document, border stamps, POD, exit note, and related evidence.", required: true },
];

const ORIGIN_DOCUMENTS: ChecklistItem[] = [
  { id: "general-coo", label: "Certificate of Origin - General COO", purpose: "Proof of origin when requested by the buyer or destination customs.", conditional: "Use when destination or customer asks for origin proof without preference." },
  { id: "sadc-coo", label: "SADC Certificate of Origin", purpose: "Supports preferential or reduced duty claims in SADC countries.", conditional: "Needed when the importer wants to claim SADC preference and the product qualifies." },
  { id: "afcfta-coo", label: "AfCFTA Certificate of Origin", purpose: "Supports AfCFTA preferential duty claims where the country and goods qualify.", conditional: "Use only for participating AfCFTA preference movements." },
  { id: "producer-declaration", label: "Producer / Manufacturer Declaration", purpose: "Supports origin qualification, especially when exporter is not the manufacturer." },
  { id: "local-content", label: "Costing / Local Content Support", purpose: "Evidence that the product qualifies under SADC or AfCFTA rules of origin." },
];

const FOOD_DOCUMENTS: ChecklistItem[] = [
  { id: "coa", label: "Certificate of Analysis / COA", purpose: "Batch-specific quality results.", required: true },
  { id: "tds", label: "Technical Data Sheet / TDS", purpose: "Composition, application, dosage, and physical or chemical specifications.", required: true },
  { id: "sds", label: "Safety Data Sheet / SDS/MSDS", purpose: "Warehouse, transport, chemical, flavouring, or dangerous goods acceptance.", required: true },
  { id: "allergen", label: "Allergen Statement", purpose: "Commonly required by African importers and food authorities.", required: true },
  { id: "non-gmo", label: "Non-GMO / GMO Declaration", purpose: "Often requested for food products and ingredients.", required: true },
  { id: "food-grade", label: "Food Grade Declaration", purpose: "Confirms the product is suitable for food use.", required: true },
  { id: "shelf-life", label: "Shelf-life / Storage Declaration", purpose: "Production date, expiry date, best-before date, and storage conditions.", required: true },
  { id: "batch-traceability", label: "Batch / Lot Traceability", purpose: "Links invoice quantity to production batch.", required: true },
  { id: "health-free-sale", label: "Health Certificate / Free Sale Certificate", purpose: "Destination food authority support.", conditional: "Depends on product and destination country." },
  { id: "halal", label: "Halal Certificate", purpose: "Required for halal-sensitive customers or countries.", conditional: "Use where buyer or country requires halal compliance." },
  { id: "phyto", label: "Phytosanitary Certificate", purpose: "Plant-based, agricultural, botanical, or regulated plant products.", conditional: "Required for regulated plant products." },
  { id: "vet", label: "Veterinary / DAFF-type Certificate", purpose: "Animal-origin products, dairy, gelatine, collagen, animal enzymes, or meat-related products.", conditional: "Required for animal-origin or regulated animal products." },
];

const PERMIT_DOCUMENTS: ChecklistItem[] = [
  { id: "itac-permit", label: "ITAC Export Permit", purpose: "Required only for controlled or restricted goods leaving South Africa.", conditional: "Check before dispatch for controlled goods." },
  { id: "import-permit", label: "Destination Import Permit", purpose: "Often needed for food, chemicals, dairy, animal-origin, plant, medicine, or controlled products.", conditional: "Must usually be issued before shipment." },
  { id: "coc-pvoc", label: "COC / PVOC / Pre-shipment Inspection", purpose: "Conformity assessment for countries such as Kenya, Tanzania, Uganda, Cameroon, and others depending on product.", conditional: "Confirm with destination agent before loading." },
  { id: "product-registration", label: "Product Registration", purpose: "Some countries require food additives, enzymes, chemicals, fertilisers, or health-related products to be registered before import." },
  { id: "dg-declaration", label: "Dangerous Goods Declaration", purpose: "Required if product is classified as dangerous goods for air, sea, or road transport." },
  { id: "temperature-control", label: "Temperature Control Declaration", purpose: "Chilled, frozen, culture, or temperature-sensitive products." },
];

const DESTINATION_DOCUMENTS: ChecklistItem[] = [
  { id: "importer-tax", label: "Importer Tax / Customs Registration Number", purpose: "Required for import entry in the destination country.", required: true },
  { id: "agent-appointment", label: "Clearing Agent Appointment", purpose: "Importer appoints destination clearing agent.", required: true },
  { id: "hs-confirmation", label: "Destination HS Code Confirmation", purpose: "Avoids customs disputes by aligning exporter, forwarder, and destination clearing agent.", required: true },
  { id: "duties-vat", label: "Duties and VAT Calculation", purpose: "Based on HS code, customs value, origin, and applicable trade agreement." },
  { id: "border-inspection", label: "Border / Port Health / Standards Inspection", purpose: "Food, chemical, cosmetic, animal, and plant products may be inspected." },
  { id: "original-docs", label: "Original Documents Confirmed", purpose: "Some countries still require original COO, SADC, health certificate, or stamped documents." },
];

const CHECKLIST_GROUPS: ChecklistGroup[] = [
  { title: "Core Export Documents", description: "Almost always required for South Africa exports into Africa.", items: CORE_DOCUMENTS },
  { title: "Origin / Duty Preference", description: "SADC is not automatic. Use preferential documents only when the importer claims preference and the product qualifies.", items: ORIGIN_DOCUMENTS },
  { title: "Food Ingredient Documents", description: "Recommended pack for food ingredients, flavourings, enzymes, dairy blends, premixes, and stabilisers.", items: FOOD_DOCUMENTS },
  { title: "Permits and Approvals", description: "Product and country controls that must be checked before dispatch.", items: PERMIT_DOCUMENTS },
  { title: "Destination Customs", description: "Items normally confirmed by the consignee or destination clearing agent.", items: DESTINATION_DOCUMENTS },
];

const INCOTERM_GUIDANCE = [
  { term: "EXW", responsibility: "Buyer handles collection and export flow, but seller still needs strong proof of export if VAT is zero-rated." },
  { term: "FOB / FCA", responsibility: "Seller normally handles export customs clearance up to the handover point." },
  { term: "CFR / CIF", responsibility: "Seller handles export customs and international freight. Buyer handles destination clearance, duties, and VAT." },
  { term: "DAP", responsibility: "Seller delivers to named destination. Buyer usually pays import duties and VAT unless agreed otherwise." },
  { term: "DDP", responsibility: "Seller carries maximum responsibility including destination duties and taxes. Use carefully for Africa exports." },
];

const PRE_DISPATCH_CHECKS = [
  "Correct HS code agreed between exporter, forwarder, and destination clearing agent.",
  "Destination country confirms whether an import permit is required.",
  "SADC or AfCFTA COO need is confirmed for duty preference.",
  "COC, PVOC, SGS, Bureau Veritas, or Intertek inspection requirement is confirmed.",
  "Health, phytosanitary, veterinary, or food safety certificate need is confirmed.",
  "Invoice and packing list match exactly: description, quantity, weights, batch numbers, and Incoterm.",
  "Destination charges payer is clear under the agreed Incoterm.",
  "Full proof of export pack is retained for SARS and VAT audit.",
];

const AGENT_QUESTION =
  "Please confirm, based on the HS code and product description, whether any import permit, standards approval, COC/PVOC, health certificate, phytosanitary/veterinary certificate, or original certificate of origin is required before shipment.";

const DEFAULT_SHIPMENT: ExportShipment = {
  ref: "",
  customer: "",
  destinationCountry: "",
  hsCode: "",
  productType: "",
  incoterm: "FCA",
  transportMode: "Road",
  preferenceScheme: "To confirm",
  destinationAgent: "",
  lastCheckedAt: "",
  notes: "",
  documents: {},
};

const getUniqueOrderJobs = (jobs: Job[]) => {
  const byRef = new Map<string, Job>();
  jobs
    .filter((job) => job.jobType === "order" || job.jobType === undefined)
    .forEach((job) => {
      if (!byRef.has(job.ref)) byRef.set(job.ref, job);
    });
  return Array.from(byRef.values()).sort((a, b) => (a.eta || "").localeCompare(b.eta || ""));
};

const loadShipments = (): Record<string, ExportShipment> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ExportShipment>;
  } catch (error) {
    console.warn("Failed to load Africa export shipments", error);
    return {};
  }
};

const saveShipments = (shipments: Record<string, ExportShipment>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shipments));
  } catch (error) {
    console.warn("Failed to save Africa export shipments", error);
  }
};

const getCompletion = (shipment: ExportShipment) => {
  const total = CHECKLIST_GROUPS.reduce((sum, group) => sum + group.items.length, 0);
  const complete = CHECKLIST_GROUPS.reduce(
    (sum, group) => sum + group.items.filter((item) => shipment.documents[item.id]).length,
    0,
  );
  return { total, complete, percent: total ? Math.round((complete / total) * 100) : 0 };
};

interface AfricaExportsViewProps {
  onNavigate?: (page: string) => void;
}

export const AfricaExportsView: React.FC<AfricaExportsViewProps> = ({ onNavigate }) => {
  const { jobs, drivers, updateJobs } = useDispatch();
  const { showSuccess, showError, showWarning, confirm } = useNotification();
  const orderJobs = useMemo(() => getUniqueOrderJobs(jobs), [jobs]);
  const [shipments, setShipments] = useState<Record<string, ExportShipment>>({});
  const [selectedRef, setSelectedRef] = useState("");
  const [activeTab, setActiveTab] = useState<ExportTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    const loaded = loadShipments();
    setShipments(loaded);
    const firstRef = Object.keys(loaded)[0] || orderJobs[0]?.ref || "";
    setSelectedRef(firstRef);
  }, []);

  useEffect(() => {
    saveShipments(shipments);
  }, [shipments]);

  const selectedOrder = useMemo(
    () => orderJobs.find((job) => job.ref === selectedRef),
    [orderJobs, selectedRef],
  );

  const shipment = useMemo<ExportShipment>(() => {
    if (selectedRef && shipments[selectedRef]) return shipments[selectedRef];
    if (selectedOrder) {
      return {
        ...DEFAULT_SHIPMENT,
        ref: selectedOrder.ref,
        customer: selectedOrder.customer,
        productType: selectedOrder.notes || "",
      };
    }
    return DEFAULT_SHIPMENT;
  }, [selectedOrder, selectedRef, shipments]);

  const trackedShipments = useMemo(() => Object.values(shipments), [shipments]);
  const completion = getCompletion(shipment);
  const shipmentLines = useMemo(
    () => jobs.filter((job) => shipment.ref && job.ref === shipment.ref),
    [jobs, shipment.ref],
  );
  const assignedDriver = useMemo(
    () => shipmentLines.find((job) => job.driverId)?.driverId,
    [shipmentLines],
  );
  const assignedDriverName = useMemo(
    () => drivers.find((driver) => driver.id === assignedDriver)?.name,
    [drivers, assignedDriver],
  );
  const shipmentPallets = useMemo(
    () => Math.max(...shipmentLines.map((job) => job.pallets || 0), 0),
    [shipmentLines],
  );
  const shipmentLineCount = shipmentLines.length;
  const requiredItems = useMemo(
    () => CHECKLIST_GROUPS.flatMap((group) => group.items).filter((item) => item.required),
    [],
  );
  const requiredDone = requiredItems.filter((item) => shipment.documents[item.id]).length;

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return CHECKLIST_GROUPS;
    const query = searchQuery.toLowerCase();
    return CHECKLIST_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        [item.label, item.purpose, item.conditional || "", group.title].join(" ").toLowerCase().includes(query),
      ),
    })).filter((group) => group.items.length > 0);
  }, [searchQuery]);

  const updateShipment = (updates: Partial<ExportShipment>) => {
    const ref = updates.ref || shipment.ref || selectedRef || `EXPORT-${Date.now()}`;
    const nextShipment = { ...shipment, ...updates, ref };
    setSelectedRef(ref);
    setShipments((prev) => ({
      ...prev,
      [ref]: nextShipment,
    }));
  };

  const toggleDocument = (id: string) => {
    if (!shipment.ref) return;
    updateShipment({
      documents: {
        ...shipment.documents,
        [id]: !shipment.documents[id],
      },
    });
  };

  const startFromOrder = (job: Job) => {
    setSelectedRef(job.ref);
    setShipments((prev) => ({
      ...prev,
      [job.ref]: prev[job.ref] || {
        ...DEFAULT_SHIPMENT,
        ref: job.ref,
        customer: job.customer,
        productType: job.notes || "",
      },
    }));
  };

  const markPreDispatchConfirmed = () => {
    updateShipment({ lastCheckedAt: new Date().toISOString().slice(0, 10) });
  };

  const assignShipment = async (driver: Driver) => {
    if (!shipment.ref) {
      showWarning("Select or create an export shipment first.");
      return;
    }

    const lineIds = shipmentLines.map((job) => job.id);
    if (lineIds.length === 0) {
      showWarning("No order lines found for this shipment reference. Import or select the order first.");
      return;
    }

    if (driver.capacity && shipmentPallets > driver.capacity) {
      const proceed = await confirm({
        title: "Capacity Warning",
        message: `${driver.name} capacity is ${driver.capacity} pallets and this shipment has ${shipmentPallets}. Assign anyway?`,
        type: "warning",
        confirmText: "Assign Anyway",
      });
      if (!proceed) return;
    }

    setIsAssigning(true);
    try {
      await updateJobs(lineIds, { driverId: driver.id, status: "assigned" });
      showSuccess(`${shipment.ref} assigned to ${driver.name}`);
    } catch (error) {
      console.error("Failed to assign Africa export shipment", error);
      showError("Failed to assign shipment. Please try again.");
    } finally {
      setIsAssigning(false);
    }
  };

  const clearAssignment = async () => {
    const lineIds = shipmentLines.map((job) => job.id);
    if (lineIds.length === 0) return;
    setIsAssigning(true);
    try {
      await updateJobs(lineIds, { driverId: undefined, status: "pending" });
      showSuccess(`${shipment.ref} moved back to unassigned`);
    } catch (error) {
      console.error("Failed to clear Africa export assignment", error);
      showError("Failed to clear assignment. Please try again.");
    } finally {
      setIsAssigning(false);
    }
  };

  const statusTone = completion.percent >= 85
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : completion.percent >= 45
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  const tabs: { id: ExportTab; label: string; icon: React.FC<any> }[] = [
    { id: "overview", label: "Shipment Setup", icon: Globe2 },
    { id: "documents", label: "Document Pack", icon: FileCheck2 },
    { id: "permits", label: "Destination Checks", icon: ShieldCheck },
    { id: "incoterms", label: "Incoterms", icon: Truck },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Africa Export Shipments</h1>
          <p className="text-sm text-gray-500">
            Practical customs and document readiness for South Africa exports into Africa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => onNavigate?.("home")}>
            <Package className="h-4 w-4" />
            Import Orders
          </Button>
          <span className={`rounded-card border px-3 py-2 text-sm font-semibold ${statusTone}`}>
            {completion.percent}% complete
          </span>
          <Button variant="outline" className="gap-2" onClick={markPreDispatchConfirmed} disabled={!shipment.ref}>
            <ClipboardCheck className="h-4 w-4" />
            Mark Agent Check
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tracked Exports</p>
                <p className="text-2xl font-bold text-gray-900">{trackedShipments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Required Docs</p>
                <p className="text-2xl font-bold text-gray-900">{requiredDone}/{requiredItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order Pool</p>
                <p className="text-2xl font-bold text-gray-900">{orderJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last Agent Check</p>
                <p className="text-base font-bold text-gray-900">{shipment.lastCheckedAt || "Not done"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="xl:col-span-1">
          <Card className="xl:sticky xl:top-8">
            <CardHeader>
              <CardTitle className="text-lg">Export Queue</CardTitle>
              <p className="text-sm text-gray-600">Select an order or tracked export.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {trackedShipments.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Tracked</p>
                    <div className="space-y-1.5">
                      {trackedShipments.map((item) => {
                        const itemCompletion = getCompletion(item);
                        const active = selectedRef === item.ref;
                        return (
                          <button
                            key={item.ref}
                            onClick={() => setSelectedRef(item.ref)}
                            className={`w-full rounded-card border p-3 text-left transition-colors ${
                              active ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-bold text-gray-900">{item.ref}</span>
                              <span className="text-xs font-semibold text-emerald-700">{itemCompletion.percent}%</span>
                            </div>
                            <p className="mt-1 truncate text-xs text-gray-600">{item.destinationCountry || "Country to confirm"}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Customer Orders</p>
                <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
                  {orderJobs.length === 0 ? (
                    <div className="rounded-card border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                      No customer orders available.
                    </div>
                  ) : (
                    orderJobs.slice(0, 80).map((job) => (
                      <button
                        key={job.ref}
                        onClick={() => startFromOrder(job)}
                        className={`w-full rounded-card border p-3 text-left transition-colors ${
                          selectedRef === job.ref ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold text-gray-900">{job.ref}</span>
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                            {job.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-gray-600">{job.customer}</p>
                        <p className="mt-1 truncate text-xs text-gray-400">{job.dropoff || "Dropoff to confirm"}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex h-10 items-center gap-2 rounded-card border px-3 text-sm font-semibold transition-colors ${
                      activeTab === id
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Shipment Setup</CardTitle>
                  <p className="text-sm text-gray-600">
                    Confirm the export basics before dispatch: country, HS code, product type, Incoterm, and destination agent.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-gray-700">Reference</span>
                      <input
                        value={shipment.ref}
                        onChange={(event) => updateShipment({ ref: event.target.value })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Order or shipment reference"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-gray-700">Customer / Consignee</span>
                      <input
                        value={shipment.customer}
                        onChange={(event) => updateShipment({ customer: event.target.value })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Customer name"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-gray-700">Destination Country</span>
                      <input
                        value={shipment.destinationCountry}
                        onChange={(event) => updateShipment({ destinationCountry: event.target.value })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="e.g. Botswana, Kenya, Zambia"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-gray-700">HS Code</span>
                      <input
                        value={shipment.hsCode}
                        onChange={(event) => updateShipment({ hsCode: event.target.value })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Tariff classification"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-gray-700">Product Type</span>
                      <input
                        value={shipment.productType}
                        onChange={(event) => updateShipment({ productType: event.target.value })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Food ingredient, flavouring, enzyme, premix"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-gray-700">Incoterm</span>
                      <select
                        value={shipment.incoterm}
                        onChange={(event) => updateShipment({ incoterm: event.target.value })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"].map((term) => (
                          <option key={term} value={term}>{term}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-gray-700">Transport Mode</span>
                      <select
                        value={shipment.transportMode}
                        onChange={(event) => updateShipment({ transportMode: event.target.value })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {["Road", "Air", "Sea", "Courier"].map((mode) => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-gray-700">Origin Preference</span>
                      <select
                        value={shipment.preferenceScheme}
                        onChange={(event) => updateShipment({ preferenceScheme: event.target.value })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {["To confirm", "No preference", "General COO", "SADC COO", "AfCFTA COO"].map((scheme) => (
                          <option key={scheme} value={scheme}>{scheme}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-gray-700">Destination Clearing Agent</span>
                      <input
                        value={shipment.destinationAgent}
                        onChange={(event) => updateShipment({ destinationAgent: event.target.value })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Agent name, email, or contact notes"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-gray-700">Shipment Notes</span>
                      <textarea
                        value={shipment.notes}
                        onChange={(event) => updateShipment({ notes: event.target.value })}
                        className="min-h-[90px] w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Destination-specific instructions, permit notes, or document caveats."
                      />
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Truck className="h-5 w-5 text-gray-600" />
                    Assign Shipment
                  </CardTitle>
                  <p className="text-sm text-gray-600">Assigns every order line with this reference.</p>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 rounded-card border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Selected shipment</p>
                    <p className="mt-1 truncate text-sm font-bold text-gray-900">{shipment.ref || "No reference selected"}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <span>{shipmentLineCount} line{shipmentLineCount === 1 ? "" : "s"}</span>
                      <span>{shipmentPallets || "-"} pallet{shipmentPallets === 1 ? "" : "s"}</span>
                      <span className="col-span-2">Transporter: {assignedDriverName || "Unassigned"}</span>
                    </div>
                  </div>

                  {assignedDriver && (
                    <Button
                      variant="outline"
                      className="mb-3 w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={clearAssignment}
                      disabled={isAssigning}
                    >
                      Move Back to Unassigned
                    </Button>
                  )}

                  <div className="space-y-2">
                    {drivers.length === 0 ? (
                      <div className="rounded-card border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                        No transporters available.
                      </div>
                    ) : (
                      drivers.map((driver) => {
                        const isAssigned = assignedDriver === driver.id;
                        return (
                          <button
                            key={driver.id}
                            onClick={() => assignShipment(driver)}
                            disabled={isAssigning || isAssigned}
                            className={`w-full rounded-card border p-3 text-left transition-colors disabled:cursor-not-allowed ${
                              isAssigned
                                ? "border-emerald-300 bg-emerald-50"
                                : "border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-bold text-gray-900">{driver.name}</span>
                              <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                                {driver.status}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
                              <span className="truncate">{driver.callsign || driver.location}</span>
                              <span>{driver.capacity || 0} pallets</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => onNavigate?.("clipboard")}>
                    <UserPlus className="h-4 w-4" />
                    Open Order Management
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-card border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Search documents, permits, or customs checks..."
                    />
                  </div>
                </CardContent>
              </Card>

              {filteredGroups.map((group) => (
                <Card key={group.title}>
                  <CardHeader>
                    <CardTitle className="text-lg">{group.title}</CardTitle>
                    <p className="text-sm text-gray-600">{group.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-gray-100 rounded-card border border-gray-200">
                      {group.items.map((item) => (
                        <label key={item.id} className="flex cursor-pointer gap-3 p-4 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={!!shipment.documents[item.id]}
                            onChange={() => toggleDocument(item.id)}
                            disabled={!shipment.ref}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-gray-900">{item.label}</span>
                              {item.required && <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">Required</span>}
                              {item.conditional && <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Conditional</span>}
                            </span>
                            <span className="mt-1 block text-sm text-gray-600">{item.purpose}</span>
                            {item.conditional && <span className="mt-1 block text-xs text-amber-700">{item.conditional}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeTab === "permits" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pre-dispatch Confirmation</CardTitle>
                  <p className="text-sm text-gray-600">Use this before loading the Africa export.</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {PRE_DISPATCH_CHECKS.map((check) => (
                      <div key={check} className="flex gap-3 rounded-card border border-gray-200 bg-white p-3 text-sm text-gray-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                        <span>{check}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Question for Destination Agent</CardTitle>
                  <p className="text-sm text-gray-600">Send this before dispatch and keep the response with the shipment pack.</p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-card border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
                    {AGENT_QUESTION}
                  </div>
                  <div className="mt-4 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    SADC is mainly needed when the importer wants to claim preferential import duty. If they are not claiming preference, a normal COO or no COO may be enough depending on the destination.
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "incoterms" && (
            <Card>
              <CardHeader>
                <CardTitle>Incoterm Impact</CardTitle>
                <p className="text-sm text-gray-600">Clarify responsibility before quoting or dispatching into Africa.</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-card border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-36 p-3 text-left font-semibold text-gray-700">Incoterm</th>
                        <th className="p-3 text-left font-semibold text-gray-700">Exporter Responsibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {INCOTERM_GUIDANCE.map((item) => (
                        <tr key={item.term} className={shipment.incoterm.includes(item.term.split(" ")[0]) ? "bg-emerald-50" : "bg-white"}>
                          <td className="p-3 font-bold text-gray-900">{item.term}</td>
                          <td className="p-3 text-gray-700">{item.responsibility}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
