import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  Globe2,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "../../lib/spreadsheet";

import { useNotification } from "../../context/NotificationContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";

type ExportTab = "overview" | "documents" | "permits" | "incoterms";
type ExportStatus = "pending" | "assigned" | "in-transit" | "delivered";
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
  eta: string;
  pallets: number;
  status: ExportStatus;
  assignedTransporterId?: string;
  lastCheckedAt: string;
  notes: string;
  documents: DocumentStatus;
}

interface ExportTransporter {
  id: string;
  name: string;
  route: string;
  contact: string;
  capacity: number;
  status: "available" | "busy" | "offline";
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

const SHIPMENTS_KEY = "dispatch_africa_export_shipments_v2";
const TRANSPORTERS_KEY = "dispatch_africa_export_transporters_v1";

const CORE_DOCUMENTS: ChecklistItem[] = [
  { id: "proforma-invoice", label: "Proforma Invoice", purpose: "Pre-shipment quote document used by the buyer or destination agent to apply for import permits, approvals, or foreign payment where required.", conditional: "Prepare before shipment when the importer, bank, or destination authority needs it." },
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
  eta: "",
  pallets: 0,
  status: "pending",
  lastCheckedAt: "",
  notes: "",
  documents: {},
};

const DEFAULT_TRANSPORTERS: ExportTransporter[] = [
  { id: "export-road-crossborder", name: "Cross-border Road Carrier", route: "SADC Road", contact: "", capacity: 26, status: "available" },
  { id: "export-airfreight-agent", name: "Export Airfreight Agent", route: "Africa Air", contact: "", capacity: 8, status: "available" },
];

const parseNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDate = (value: unknown) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
};

const normalizeHeader = (value: unknown) => String(value ?? "").trim().toLowerCase();

const findValue = (headers: string[], row: unknown[], aliases: string[]) => {
  const index = headers.findIndex((header) => aliases.includes(header));
  return index >= 0 ? row[index] : undefined;
};

const loadList = <T,>(key: string, fallback: T[]): T[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T[] : fallback;
  } catch (error) {
    console.warn(`Failed to load ${key}`, error);
    return fallback;
  }
};

const saveList = <T,>(key: string, value: T[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key}`, error);
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

const parseShipmentRows = async (file: File): Promise<ExportShipment[]> => {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  const workbook = isExcel
    ? await XLSX.read(await file.arrayBuffer(), { type: "array" })
    : await XLSX.read(await file.text(), { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][];
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const ref = String(findValue(headers, row, ["ref", "reference", "document no", "export ref", "shipment ref", "order no"]) ?? "").trim();
    const customer = String(findValue(headers, row, ["customer", "customer name", "client", "consignee", "buyer"]) ?? "").trim();
    if (!ref || !customer) return null;

    return {
      ...DEFAULT_SHIPMENT,
      ref,
      customer,
      destinationCountry: String(findValue(headers, row, ["destination country", "country", "destination"]) ?? "").trim(),
      hsCode: String(findValue(headers, row, ["hs code", "tariff", "tariff code"]) ?? "").trim(),
      productType: String(findValue(headers, row, ["product type", "inventory description", "description", "product"]) ?? "").trim(),
      incoterm: String(findValue(headers, row, ["incoterm", "inco term"]) ?? "FCA").trim() || "FCA",
      transportMode: String(findValue(headers, row, ["transport mode", "mode"]) ?? "Road").trim() || "Road",
      eta: normalizeDate(findValue(headers, row, ["eta", "delivery date", "dispatch date", "shipment date"])),
      pallets: parseNumber(findValue(headers, row, ["pallets", "pallet qty", "pallet quantity"])),
      notes: String(findValue(headers, row, ["notes", "remarks", "comment"]) ?? "").trim(),
      status: "pending" as ExportStatus,
      documents: {},
    };
  }).filter((shipment): shipment is ExportShipment => Boolean(shipment && shipment.ref && shipment.customer))
    .map((shipment, index) => ({ ...shipment, ref: shipment.ref || `AFX-${Date.now()}-${index}` }));
};

export const AfricaExportsView: React.FC = () => {
  const { showSuccess, showError, showWarning, confirm } = useNotification();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [shipments, setShipments] = useState<ExportShipment[]>([]);
  const [transporters, setTransporters] = useState<ExportTransporter[]>([]);
  const [selectedRef, setSelectedRef] = useState("");
  const [activeTab, setActiveTab] = useState<ExportTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showAddTransporter, setShowAddTransporter] = useState(false);
  const [importPreview, setImportPreview] = useState<ExportShipment[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [newTransporter, setNewTransporter] = useState<Omit<ExportTransporter, "id">>({
    name: "",
    route: "",
    contact: "",
    capacity: 0,
    status: "available",
  });

  useEffect(() => {
    const loadedShipments = loadList<ExportShipment>(SHIPMENTS_KEY, []);
    const loadedTransporters = loadList<ExportTransporter>(TRANSPORTERS_KEY, DEFAULT_TRANSPORTERS);
    setShipments(loadedShipments);
    setTransporters(loadedTransporters);
    setSelectedRef(loadedShipments[0]?.ref || "");
  }, []);

  useEffect(() => {
    saveList(SHIPMENTS_KEY, shipments);
  }, [shipments]);

  useEffect(() => {
    saveList(TRANSPORTERS_KEY, transporters);
  }, [transporters]);

  const shipment = useMemo(
    () => shipments.find((item) => item.ref === selectedRef) || DEFAULT_SHIPMENT,
    [shipments, selectedRef],
  );

  const trackedShipments = useMemo(
    () => [...shipments].sort((a, b) => (a.eta || "9999").localeCompare(b.eta || "9999")),
    [shipments],
  );

  const filteredShipments = useMemo(() => {
    if (!searchQuery.trim()) return trackedShipments;
    const query = searchQuery.toLowerCase();
    return trackedShipments.filter((item) =>
      [item.ref, item.customer, item.destinationCountry, item.hsCode, item.productType, item.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [trackedShipments, searchQuery]);

  const completion = getCompletion(shipment);
  const requiredItems = useMemo(
    () => CHECKLIST_GROUPS.flatMap((group) => group.items).filter((item) => item.required),
    [],
  );
  const requiredDone = requiredItems.filter((item) => shipment.documents[item.id]).length;
  const assignedTransporter = transporters.find((item) => item.id === shipment.assignedTransporterId);

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

  const statusTone = completion.percent >= 85
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : completion.percent >= 45
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  const updateShipment = (updates: Partial<ExportShipment>) => {
    const ref = updates.ref || shipment.ref || selectedRef || `AFX-${Date.now()}`;
    const nextShipment = { ...shipment, ...updates, ref };
    setSelectedRef(ref);
    setShipments((prev) => {
      const exists = prev.some((item) => item.ref === shipment.ref || item.ref === selectedRef || item.ref === ref);
      if (!exists) return [nextShipment, ...prev];
      return prev.map((item) => (item.ref === shipment.ref || item.ref === selectedRef ? nextShipment : item));
    });
  };

  const createBlankShipment = () => {
    const ref = `AFX-${Date.now()}`;
    const nextShipment = { ...DEFAULT_SHIPMENT, ref };
    setShipments((prev) => [nextShipment, ...prev]);
    setSelectedRef(ref);
    setActiveTab("overview");
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

  const markPreDispatchConfirmed = () => {
    updateShipment({ lastCheckedAt: new Date().toISOString().slice(0, 10) });
  };

  const assignShipment = async (transporter: ExportTransporter) => {
    if (!shipment.ref) {
      showWarning("Create or import an Africa export shipment first.");
      return;
    }

    if (transporter.capacity && shipment.pallets > transporter.capacity) {
      const proceed = await confirm({
        title: "Capacity Warning",
        message: `${transporter.name} capacity is ${transporter.capacity} pallets and this shipment has ${shipment.pallets}. Assign anyway?`,
        type: "warning",
        confirmText: "Assign Anyway",
      });
      if (!proceed) return;
    }

    updateShipment({ assignedTransporterId: transporter.id, status: "assigned" });
    showSuccess(`${shipment.ref} assigned to ${transporter.name}`);
  };

  const clearAssignment = () => {
    updateShipment({ assignedTransporterId: undefined, status: "pending" });
    showSuccess(`${shipment.ref} moved back to unassigned`);
  };

  const addTransporter = () => {
    if (!newTransporter.name.trim()) {
      showWarning("Transporter name is required.");
      return;
    }

    const transporter: ExportTransporter = {
      ...newTransporter,
      id: `export-transporter-${Date.now()}`,
      capacity: Number(newTransporter.capacity) || 0,
    };
    setTransporters((prev) => [transporter, ...prev]);
    setNewTransporter({ name: "", route: "", contact: "", capacity: 0, status: "available" });
    setShowAddTransporter(false);
    showSuccess("Africa export transporter added.");
  };

  const handleFileSelect = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const parsed = await parseShipmentRows(file);
      if (parsed.length === 0) {
        showError("No valid Africa export rows found. Check the reference and customer columns.");
        return;
      }
      setImportPreview(parsed);
      showSuccess(`Parsed ${parsed.length} Africa export shipment${parsed.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Failed to import Africa export shipments", error);
      showError("Could not read the import file.");
    } finally {
      setIsImporting(false);
    }
  };

  const commitImport = () => {
    if (importPreview.length === 0) return;
    setShipments((prev) => {
      const byRef = new Map(prev.map((item) => [item.ref, item]));
      importPreview.forEach((item) => {
        byRef.set(item.ref, { ...byRef.get(item.ref), ...item, documents: byRef.get(item.ref)?.documents || {} });
      });
      return Array.from(byRef.values());
    });
    setSelectedRef(importPreview[0].ref);
    setImportPreview([]);
    setShowImport(false);
    showSuccess("Africa export shipments imported.");
  };

  const downloadTemplate = async () => {
    const data = [
      ["Reference", "Customer", "Destination Country", "HS Code", "Product Type", "Incoterm", "Transport Mode", "ETA", "Pallets", "Notes"],
      ["AFX-0001", "Africa Client", "Botswana", "2106.90", "Food ingredient blend", "FCA", "Road", "2026-06-15", "4", "Confirm import permit before dispatch"],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AfricaExports");
    await XLSX.writeFile(workbook, "africa_exports_template.xlsx");
  };

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
            Independent export workspace for Africa clients, export documents, and cross-border transporters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" />
            Import Africa Orders
          </Button>
          <Button variant="outline" className="gap-2" onClick={createBlankShipment}>
            <Plus className="h-4 w-4" />
            New Export
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
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Africa Exports</p>
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
              <Truck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Export Transporters</p>
                <p className="text-2xl font-bold text-gray-900">{transporters.length}</p>
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
              <CardTitle className="text-lg">Africa Export Queue</CardTitle>
              <p className="text-sm text-gray-600">Only Africa export shipments appear here.</p>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-card border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Search exports..."
                />
              </div>
              <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                {filteredShipments.length === 0 ? (
                  <div className="rounded-card border border-dashed border-gray-300 p-6 text-center">
                    <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-600">No Africa exports yet</p>
                    <p className="mt-1 text-xs text-gray-400">Import or create an export shipment to start.</p>
                  </div>
                ) : (
                  filteredShipments.map((item) => {
                    const active = selectedRef === item.ref;
                    const itemCompletion = getCompletion(item);
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
                        <p className="mt-1 truncate text-xs text-gray-600">{item.customer}</p>
                        <p className="mt-1 truncate text-xs text-gray-400">
                          {item.destinationCountry || "Country to confirm"} - {item.status}
                        </p>
                      </button>
                    );
                  })
                )}
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
                  <p className="text-sm text-gray-600">Africa client, destination, tariff, Incoterm, and product details.</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Reference" value={shipment.ref} onChange={(value) => updateShipment({ ref: value })} placeholder="AFX-0001" />
                    <Field label="Africa Client / Consignee" value={shipment.customer} onChange={(value) => updateShipment({ customer: value })} placeholder="Client name" />
                    <Field label="Destination Country" value={shipment.destinationCountry} onChange={(value) => updateShipment({ destinationCountry: value })} placeholder="Botswana, Kenya, Zambia" />
                    <Field label="HS Code" value={shipment.hsCode} onChange={(value) => updateShipment({ hsCode: value })} placeholder="Tariff classification" />
                    <Field label="Product Type" value={shipment.productType} onChange={(value) => updateShipment({ productType: value })} placeholder="Food ingredient, flavouring, enzyme" />
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
                      <span className="text-sm font-semibold text-gray-700">Status</span>
                      <select
                        value={shipment.status}
                        onChange={(event) => updateShipment({ status: event.target.value as ExportStatus })}
                        className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {["pending", "assigned", "in-transit", "delivered"].map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <Field label="ETA / Dispatch Date" value={shipment.eta} onChange={(value) => updateShipment({ eta: value })} type="date" />
                    <Field label="Pallets" value={String(shipment.pallets || "")} onChange={(value) => updateShipment({ pallets: parseNumber(value) })} type="number" />
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
                    <Field label="Destination Clearing Agent" value={shipment.destinationAgent} onChange={(value) => updateShipment({ destinationAgent: value })} className="md:col-span-2" placeholder="Agent name, email, or contact notes" />
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
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Truck className="h-5 w-5 text-gray-600" />
                        Export Transporters
                      </CardTitle>
                      <p className="mt-1 text-sm text-gray-600">Separate from local order transporters.</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowAddTransporter(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 rounded-card border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Selected export</p>
                    <p className="mt-1 truncate text-sm font-bold text-gray-900">{shipment.ref || "No export selected"}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <span>{shipment.pallets || "-"} pallets</span>
                      <span>{shipment.status}</span>
                      <span className="col-span-2">Transporter: {assignedTransporter?.name || "Unassigned"}</span>
                    </div>
                  </div>

                  {shipment.assignedTransporterId && (
                    <Button variant="outline" className="mb-3 w-full border-amber-200 text-amber-700 hover:bg-amber-50" onClick={clearAssignment}>
                      Move Back to Unassigned
                    </Button>
                  )}

                  <div className="space-y-2">
                    {transporters.map((transporter) => {
                      const isAssigned = shipment.assignedTransporterId === transporter.id;
                      return (
                        <button
                          key={transporter.id}
                          onClick={() => assignShipment(transporter)}
                          disabled={isAssigned}
                          className={`w-full rounded-card border p-3 text-left transition-colors disabled:cursor-not-allowed ${
                            isAssigned ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-bold text-gray-900">{transporter.name}</span>
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                              {transporter.status}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
                            <span className="truncate">{transporter.route || "Route to confirm"}</span>
                            <span>{transporter.capacity || 0} pallets</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-4">
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

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImport(false)}>
          <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Import Africa Export Orders</CardTitle>
                  <p className="mt-1 text-sm text-gray-600">Imports into Africa Exports only. These rows will not appear in local Order Management.</p>
                </div>
                <button className="rounded-card p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={() => setShowImport(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                  <Upload className="h-4 w-4" />
                  Choose File
                </Button>
                <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
                  <Download className="h-4 w-4" />
                  Template
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(event) => handleFileSelect(event.target.files?.[0])}
                />
              </div>

              {importPreview.length === 0 ? (
                <div className="rounded-card border-2 border-dashed border-gray-200 p-10 text-center">
                  <Upload className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-700">Upload a CSV, XLSX, or XLS file</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Supported columns: Reference, Customer, Destination Country, HS Code, Product Type, Incoterm, Transport Mode, ETA, Pallets, Notes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-card border border-emerald-200 bg-emerald-50 p-3">
                    <span className="text-sm font-semibold text-emerald-800">
                      {importPreview.length} Africa export shipment{importPreview.length === 1 ? "" : "s"} ready to import
                    </span>
                    <Button onClick={commitImport}>Import to Africa Exports</Button>
                  </div>
                  <div className="overflow-x-auto rounded-card border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {["Reference", "Client", "Country", "HS Code", "Product", "Incoterm", "Pallets"].map((heading) => (
                            <th key={heading} className="p-3 text-left font-semibold text-gray-700">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importPreview.slice(0, 100).map((item) => (
                          <tr key={item.ref}>
                            <td className="p-3 font-semibold text-gray-900">{item.ref}</td>
                            <td className="p-3 text-gray-700">{item.customer}</td>
                            <td className="p-3 text-gray-700">{item.destinationCountry || "-"}</td>
                            <td className="p-3 text-gray-700">{item.hsCode || "-"}</td>
                            <td className="p-3 text-gray-700">{item.productType || "-"}</td>
                            <td className="p-3 text-gray-700">{item.incoterm}</td>
                            <td className="p-3 text-gray-700">{item.pallets || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showAddTransporter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddTransporter(false)}>
          <Card className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle>Add Africa Export Transporter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <Field label="Transporter Name" value={newTransporter.name} onChange={(value) => setNewTransporter((prev) => ({ ...prev, name: value }))} />
                <Field label="Africa Route / Mode" value={newTransporter.route} onChange={(value) => setNewTransporter((prev) => ({ ...prev, route: value }))} placeholder="SADC road, Africa air, sea freight" />
                <Field label="Contact" value={newTransporter.contact} onChange={(value) => setNewTransporter((prev) => ({ ...prev, contact: value }))} />
                <Field label="Pallet Capacity" type="number" value={String(newTransporter.capacity || "")} onChange={(value) => setNewTransporter((prev) => ({ ...prev, capacity: parseNumber(value) }))} />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={addTransporter}>Add Transporter</Button>
                  <Button className="flex-1" variant="outline" onClick={() => setShowAddTransporter(false)}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, placeholder, type = "text", className }) => (
  <label className={`space-y-2 ${className || ""}`}>
    <span className="text-sm font-semibold text-gray-700">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      placeholder={placeholder}
    />
  </label>
);
