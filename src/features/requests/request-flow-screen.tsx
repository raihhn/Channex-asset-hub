"use client";

import Link from "next/link";
import {
  borrowingUnits,
  stockUnit,
  changeBorrowQuantity,
  type AssetUnit,
} from "@/lib/domain/asset-units";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  PackageOpen,
  FileUp,
  Check,
  MapPin,
  Minus,
  Plus,
  Undo2,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Input,
  Modal,
  SearchField,
  Radio,
  RadioGroup,
  Description,
  TextArea,
} from "@heroui/react";

import {
  RequestSteps,
  RequestSummary,
} from "@/components/domain/request-workspace-ui";
import { AssetArtwork } from "@/components/domain/asset-artwork";
import { AssetStatus } from "@/components/domain/asset-status";
import { AppShell } from "@/components/shared/app-shell";
import { HeroSelect } from "@/components/shared/hero-select";
import { RequestSiteContactField } from "./request-site-contact-field";
import { usePrototype } from "@/features/prototype/prototype-provider";
import {
  BookingClientError,
  durableBookingEnabled,
} from "@/lib/booking-client";
import { getRequestEligibility } from "@/lib/fixtures/request-eligibility";
import {
  deriveReservations,
  getOperationalWindowFromFields,
  validateOperationalWindow,
} from "@/lib/domain/reservations";
import { validateVendorLocation } from "@/lib/vendor-locations-client";
import { normalizeWbsCode } from "@/lib/domain/wbs-references";
import {
  getBoothUsageValidation,
  getEventPickerLabel,
  getSelectableEvents,
  getParentEvent,
} from "@/lib/domain/events";
import type {
  Asset,
  RequestDocument,
  RequestDocumentCategory,
  RequestDraft,
  PrototypeRequest,
} from "@/types/prototype";

type Selected = { asset: Asset; quantity: number; borrowUnit?: AssetUnit };

const defaultBrands = ["Wardah", "Make Over", "Emina", "Corporate", "Kahf"] as const;
const maxRequestDocumentSize = 5 * 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read this file."));
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

export function RequestFlowScreen({
  items,
  revisionRequest,
  initialWbsCodes = [],
}: {
  items: Selected[];
  revisionRequest?: PrototypeRequest;
  initialWbsCodes?: string[];
}) {
  const router = useRouter();
  const {
    catalogAssets: assets,
    events,
    requests,
    returnReceipts,
    createRequest,
    resubmitRequest,
    savePersistedRequest,
    bookingLoading,
    bookingError,
    currentUser,
    operationalLocations: registeredLocations,
    vendorLoading,
    vendorError,
  } = usePrototype();
  const brands = [...new Set([...defaultBrands, ...assets.map(asset => asset.brand)])].filter(brand => !["All Brand", "Belum diketahui"].includes(brand));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const [brand, setBrand] = useState<(typeof brands)[number]>(
    (revisionRequest?.brand as (typeof brands)[number]) ?? "Wardah",
  );
  const brandEvents = getSelectableEvents(events, brand);
  const [eventId, setEventId] = useState(
    revisionRequest?.eventId ?? brandEvents[0]?.id ?? "",
  );
  const event = events.find(
    (item) => item.id === eventId && item.brand === brand,
  );
  const [projectName, setProjectName] = useState(
    revisionRequest?.projectName ?? event?.name ?? "",
  );
  const [projectAddress, setProjectAddress] = useState(
    revisionRequest?.projectAddress ??
      (event ? `${event.venue}, ${event.city}` : ""),
  );
  const [siteContact, setSiteContactText] = useState(
    revisionRequest?.siteContact ?? event?.pic ?? "",
  );
  const [siteContactInternalId, setSiteContactInternalId] = useState(
    revisionRequest?.siteContactInternalId,
  );
  const setSiteContact = (value: string) => {
    setSiteContactText(value);
    setSiteContactInternalId(undefined);
  };
  const [spaceLength, setSpaceLength] = useState(
    revisionRequest?.spaceLength ?? "",
  );
  const [spaceWidth, setSpaceWidth] = useState(
    revisionRequest?.spaceWidth ?? "",
  );
  const [spaceHeight, setSpaceHeight] = useState(
    revisionRequest?.spaceHeight ?? "",
  );
  const [projectDetails, setProjectDetails] = useState(
    revisionRequest?.projectDetails ?? "",
  );
  const [budgetCode, setBudgetCode] = useState(
    revisionRequest?.budgetCode ?? "",
  );
  const [supportingDocuments, setSupportingDocuments] = useState<
    RequestDocument[]
  >(revisionRequest?.supportingDocuments ?? []);
  const [documentError, setDocumentError] = useState("");
  const [startDate, setStartDate] = useState(
    revisionRequest?.startDate ?? event?.startDate ?? "2026-08-12",
  );
  const [endDate, setEndDate] = useState(
    revisionRequest?.endDate ?? event?.endDate ?? "2026-08-16",
  );
  const [selected, setSelected] = useState<Selected[]>(() =>
    items.length ? items : [],
  );
  const [query, setQuery] = useState("");
  const [assetBrandFilter, setAssetBrandFilter] = useState("All brands");
  const [assetCategoryFilter, setAssetCategoryFilter] =
    useState("All categories");
  const [wbsInput, setWbsInput] = useState("");
  const [wbsCodes, setWbsCodes] = useState<string[]>(initialWbsCodes);
  const [wbsError, setWbsError] = useState("");
  const [step, setStep] = useState(1);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  const [usageType, setUsageType] = useState<
    "Registered event" | "Vendor workshop" | "Ad-hoc"
  >(revisionRequest?.usageType ?? "Registered event");
  const [locationId, setLocationId] = useState(
    revisionRequest?.destinationLocationId ??
      registeredLocations.find(
        (location) => location.type === "Internal warehouse",
      )?.id ??
      "",
  );
  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "Delivery" | "Pickup"
  >(revisionRequest?.fulfillmentGroups?.[0]?.method ?? "Delivery");
  const [editingFulfillment, setEditingFulfillment] = useState(false);
  const [fulfillmentDate, setFulfillmentDate] = useState(
    revisionRequest?.pickupDate ?? event?.startDate ?? "2026-08-12",
  );
  const [fulfillmentTime, setFulfillmentTime] = useState(
    revisionRequest?.pickupTime ?? "10:00",
  );
  const [fulfillmentReturnDate, setFulfillmentReturnDate] = useState(
    revisionRequest?.returnDate ?? event?.endDate ?? "2026-08-16",
  );
  const [fulfillmentReturnTime, setFulfillmentReturnTime] = useState(
    revisionRequest?.returnTime ?? "12:00",
  );
  const [adHocPurpose, setAdHocPurpose] = useState<string>(
    revisionRequest?.adHocPurpose ?? "Photoshoot",
  );
  const [adHocLocationType, setAdHocLocationType] = useState<
    "Store" | "Outside Store"
  >(revisionRequest?.adHocLocationType ?? "Store");
  const [adHocPlace, setAdHocPlace] = useState(
    revisionRequest?.adHocPlace ?? "",
  );
  const [boothType, setBoothType] = useState<
    "" | "Regular Booth" | "Custom Booth"
  >(revisionRequest?.boothType ?? "");
  const boothUsage = getBoothUsageValidation(
    boothType || undefined,
    startDate,
    endDate,
  );
  const boothError = boothUsage.invalidDateRange
    ? "Enter a valid usage date range before continuing."
    : boothUsage.exceedsLimit
      ? `This booth request covers ${boothUsage.usageDays} calendar days. Booth use is limited to 30 days; extension approval is required before continuing.`
      : "";
  const hasRequiredBooth =
    boothType !== "Regular Booth" ||
    selected.some(({ asset }) => asset.category === "Booth");
  const canContinueWithoutAssets = boothType === "Custom Booth";
  const operationalWindow = useMemo(
    () =>
      getOperationalWindowFromFields(
        fulfillmentDate,
        fulfillmentTime,
        fulfillmentReturnDate,
        fulfillmentReturnTime,
      ),
    [
      fulfillmentDate,
      fulfillmentReturnDate,
      fulfillmentReturnTime,
      fulfillmentTime,
    ],
  );
  const windowValidation = validateOperationalWindow(
    startDate,
    endDate,
    operationalWindow,
  );
  const reservations = useMemo(
    () =>
      deriveReservations(
        requests.filter((request) => request.id !== revisionRequest?.id),
        assets,
        events,
        returnReceipts,
      ),
    [assets, events, requests, returnReceipts, revisionRequest?.id],
  );
  const assetBrands = [...new Set(assets.map((asset) => asset.brand))];
  const assetCategories = [...new Set(assets.map((asset) => asset.category))];
  const matchingAssets = assets.filter(
    (asset) =>
      `${asset.name} ${asset.brand} ${asset.category} ${asset.location}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (assetBrandFilter === "All brands" || asset.brand === assetBrandFilter) &&
      (assetCategoryFilter === "All categories" ||
        asset.category === assetCategoryFilter),
  );
  const pickerCriteria = JSON.stringify([query, assetBrandFilter, assetCategoryFilter]);
  const [pickerPaging, setPickerPaging] = useState({criteria:"", count:24});
  const pickerCount = pickerPaging.criteria === pickerCriteria ? pickerPaging.count : 24;
  const selectedLocation = registeredLocations.find(
    (location) => location.id === locationId,
  );
  const resolvedProjectAddress =
    usageType === "Registered event"
      ? event
        ? `${event.venue}, ${event.city}`
        : ""
      : projectAddress;
  const resolvedProjectName =
    usageType === "Registered event" ? (event?.name ?? "") : projectName;
  const contextError =
    usageType === "Vendor workshop" && !selectedLocation
      ? "Choose an active database vendor warehouse to replace this legacy destination."
      : usageType === "Ad-hoc" &&
          adHocLocationType === "Outside Store" &&
          !adHocPlace.trim() &&
          !selectedLocation
        ? vendorLoading
          ? "Loading vendor warehouses…"
          : vendorError || "Select an active registered destination."
        : usageType === "Registered event" && !event
          ? "Select a registered Event for this Brand."
          : !resolvedProjectName.trim()
            ? "Enter a project name."
            : !resolvedProjectAddress.trim()
              ? "Enter the project's full address."
              : usageType === "Ad-hoc" &&
                  adHocLocationType === "Store" &&
                  !selectedLocation
                ? "Select an existing Store location."
                : "";
  const budgetCodeError = !budgetCode.trim();
  const storeLocations = registeredLocations.filter(
    (location) => location.type === "Store",
  );
  const destinationLabel =
    usageType === "Registered event"
      ? event
        ? `${event.venue}, ${event.city}`
        : "Select an event"
      : usageType === "Ad-hoc" &&
          adHocLocationType === "Outside Store" &&
          adHocPlace.trim()
        ? adHocPlace.trim()
        : `${selectedLocation?.name ?? "Registered location"}, ${selectedLocation?.city ?? ""}`;
  const destination = resolvedProjectAddress.trim() || destinationLabel;
  const readiness = useMemo(
    () =>
      selected.map(({ asset, quantity }) => ({
        asset,
        quantity,
        result: getRequestEligibility(
          asset,
          startDate,
          endDate,
          quantity,
          reservations,
          operationalWindow,
        ),
      })),
    [endDate, operationalWindow, reservations, selected, startDate],
  );
  const blocked = readiness.filter(({ result }) => !result.eligible);
  const assetCountLabel = selected.length === 1 ? "asset" : "assets";
  const returnPlan = useMemo(
    () =>
      Object.values(
        selected.reduce<Record<string, Selected[]>>((groups, item) => {
          (groups[item.asset.location] ??= []).push(item);
          return groups;
        }, {}),
      ),
    [selected],
  );

  const selectBrand = (nextBrand: (typeof brands)[number]) => {
    setSiteContactInternalId(undefined);
    const compatibleEvent =
      event && event.brand === nextBrand ? event : undefined;
    setBrand(nextBrand);
    setEventId(compatibleEvent?.id ?? "");
    if (usageType === "Ad-hoc" && adHocLocationType === "Store") {
      const nextLocation = storeLocations.find((location) =>
        location.name.startsWith(nextBrand),
      );
      if (nextLocation) selectLocation(nextLocation.id);
    }
  };
  const selectEvent = (nextId: string) => {
    const next = events.find(
      (item) => item.id === nextId && item.brand === brand,
    );
    if (!next) return;
    setEventId(next.id);
    setProjectName(next.name);
    setProjectAddress(`${next.venue}, ${next.city}`);
    setSiteContact(next.pic);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
    setFulfillmentDate(next.startDate);
    setFulfillmentReturnDate(next.endDate);
  };
  const selectUsageType = (next: typeof usageType) => {
    setSiteContactInternalId(undefined);
    setUsageType(next);
    setProjectName(next === "Registered event" ? (event?.name ?? "") : "");
    if (next === "Registered event") {
      setProjectAddress(event ? `${event.venue}, ${event.city}` : "");
      setSiteContact(event?.pic ?? "");
      return;
    }
    const nextLocation = storeLocations.find((location) =>
      location.name.startsWith(brand),
    );
    setAdHocLocationType("Store");
    setAdHocPlace("");
    if (nextLocation) {
      setLocationId(nextLocation.id);
      setProjectAddress(
        nextLocation.vendorId
          ? nextLocation.address
          : `${nextLocation.address}, ${nextLocation.city}`,
      );
      setSiteContact(nextLocation.contact ?? "");
    }
  };
  const selectLocation = (nextId: string) => {
    setSiteContactInternalId(undefined);
    const nextLocation = registeredLocations.find(
      (location) => location.id === nextId,
    );
    setLocationId(nextId);
    setAdHocPlace("");
    if (nextLocation) {
      setProjectAddress(
        nextLocation.vendorId
          ? nextLocation.address
          : `${nextLocation.address}, ${nextLocation.city}`,
      );
      setSiteContact(nextLocation.contact ?? "");
    }
  };
  const toggleAsset = (asset: Asset) =>
    setSelected((current) =>
      current.some((item) => item.asset.id === asset.id)
        ? current.filter((item) => item.asset.id !== asset.id)
        : [...current, { asset, quantity: 1 }],
    );
  const removeAsset = (assetId: string) =>
    setSelected((current) =>
      current.filter((item) => item.asset.id !== assetId),
    );
  const changeQuantity = (assetId: string, delta: number) =>
    setSelected((current) =>
      current.map((item) =>
        item.asset.id !== assetId
          ? item
          : {
              ...item,
              quantity: changeBorrowQuantity(
                item.asset,
                item.quantity,
                item.borrowUnit ?? stockUnit(item.asset),
                delta,
              ),
            },
      ),
    );
  const addWbsCode = () => {
    const code = normalizeWbsCode(wbsInput);
    if (!code) {
      setWbsError("Enter a WBS code first.");
      return;
    }
    if (wbsCodes.includes(code)) {
      setWbsError("That WBS reference is already in this request.");
      return;
    }
    setWbsCodes((current) => [...current, code]);
    setWbsInput("");
    setWbsError("");
  };
  const addRequestDocuments = async (
    category: RequestDocumentCategory,
    fileList: FileList | null,
  ) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const oversize = files.filter((file) => file.size > maxRequestDocumentSize);
    const acceptable = files.filter(
      (file) =>
        file.size <= maxRequestDocumentSize &&
        (file.type === "application/pdf" || file.type.startsWith("image/")),
    );
    if (oversize.length) {
      setDocumentError("Each file must be 5 MB or smaller.");
    } else if (acceptable.length !== files.length) {
      setDocumentError("Use PDF or image files for supporting documents.");
    } else {
      setDocumentError("");
    }
    const remainingSlots = Math.max(0, 5 - supportingDocuments.length);
    const filesToRead = acceptable.slice(0, remainingSlots);
    if (acceptable.length > remainingSlots) {
      setDocumentError("A request can include up to 5 supporting documents.");
    }
    try {
      const documents = await Promise.all(
        filesToRead.map(async (file): Promise<RequestDocument> => ({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          category,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl: await readFileAsDataUrl(file),
        })),
      );
      setSupportingDocuments((current) => [...current, ...documents]);
    } catch {
      setDocumentError("One of the selected files could not be read.");
    }
  };
  const submit = async () => {
    if (
      (!selected.length && !canContinueWithoutAssets) ||
      blocked.length ||
      boothError ||
      contextError ||
      !hasRequiredBooth ||
      !windowValidation.valid ||
      budgetCodeError
    )
      return;
    const selectedDestinationType: RequestDraft["destinationType"] =
      selectedLocation
        ? selectedLocation.type === "Store"
          ? "Other"
          : selectedLocation.type
        : undefined;
    const usesNewPlace =
      usageType === "Ad-hoc" &&
      adHocLocationType === "Outside Store" &&
      Boolean(adHocPlace.trim());
    const destinationType =
      usageType === "Registered event"
        ? "Event venue"
        : usesNewPlace ||
            (usageType === "Ad-hoc" && adHocLocationType === "Store")
          ? "Other"
          : (selectedDestinationType ?? "Internal warehouse");
    const resolvedActivityName = resolvedProjectName.trim();
    const draft: RequestDraft = {
      items: selected.map(({ asset, quantity, borrowUnit }) => ({
        assetId: asset.id,
        quantity,
        stockUnit: stockUnit(asset),
        borrowedUnit: borrowUnit ?? stockUnit(asset),
        unitsPerPackage: asset.unitPolicy?.unitsPerPackage,
      })),
      usageType,
      eventMode:
        usageType === "Registered event"
          ? "Registered Event"
          : usageType === "Ad-hoc"
            ? "Ad-hoc Event"
            : undefined,
      eventId: usageType === "Registered event" ? event?.id : undefined,
      campaign: usageType === "Registered event" ? event?.campaign : undefined,
      brand:
        usageType === "Registered event" || usageType === "Ad-hoc"
          ? brand
          : undefined,
      activityName: resolvedActivityName,
      projectName: resolvedActivityName,
      projectAddress: resolvedProjectAddress.trim(),
      siteContact: siteContact.trim() || undefined,
      ...(siteContactInternalId ? { siteContactInternalId } : {}),
      spaceLength: spaceLength || undefined,
      spaceWidth: spaceWidth || undefined,
      spaceHeight: spaceHeight || undefined,
      projectDetails: projectDetails.trim() || undefined,
      budgetCode: budgetCode.trim(),
      supportingDocuments,
      adHocPurpose:
        usageType === "Ad-hoc"
          ? (adHocPurpose as RequestDraft["adHocPurpose"])
          : undefined,
      adHocLocationType: usageType === "Ad-hoc" ? adHocLocationType : undefined,
      adHocPlace:
        usageType === "Ad-hoc" && adHocLocationType === "Outside Store"
          ? adHocPlace.trim() || undefined
          : undefined,
      boothType: boothType || undefined,
      wbsCodes,
      startDate,
      endDate,
      destination,
      destinationType,
      destinationVendorId:
        destinationType === "Vendor workshop" ||
        destinationType === "Vendor warehouse"
          ? selectedLocation?.vendorId
          : undefined,
      destinationLocationId:
        usageType === "Registered event" ||
        (usageType === "Ad-hoc" &&
          adHocLocationType === "Outside Store" &&
          adHocPlace.trim())
          ? undefined
          : selectedLocation?.id,
      purpose:
        usageType === "Registered event"
          ? resolvedActivityName || event?.name || "Registered event"
          : usageType === "Ad-hoc"
            ? resolvedActivityName || adHocPurpose
            : resolvedActivityName || usageType,
      contact:
        revisionRequest?.contact ??
        `${currentUser.name} · ${currentUser.email}`,
      pickupDate: fulfillmentDate,
      pickupTime: fulfillmentTime,
      returnDate: fulfillmentReturnDate,
      returnTime: fulfillmentReturnTime,
      notes: "",
      fulfillmentGroups: [
        {
          id: "Fulfillment 1",
          method: fulfillmentMethod,
          source: "Asset operations",
          destination,
          destinationType,
          destinationVendorId:
            destinationType === "Vendor workshop" ||
            destinationType === "Vendor warehouse"
              ? selectedLocation?.vendorId
              : undefined,
          destinationLocationId:
            usageType === "Registered event" || usesNewPlace
              ? undefined
              : selectedLocation?.id,
          window: `${fulfillmentDate} ${fulfillmentTime} to ${fulfillmentReturnDate} ${fulfillmentReturnTime}`,
          pickupDate: fulfillmentDate,
          pickupTime: fulfillmentTime,
          returnDate: fulfillmentReturnDate,
          returnTime: fulfillmentReturnTime,
          contact: selectedLocation?.vendorId
            ? siteContact
            : (revisionRequest?.fulfillmentGroups?.[0]?.contact ??
              currentUser.name),
          itemIds: selected.map((item) => item.asset.id),
          state: "Planned",
        },
      ],
      returnGroups: returnPlan.map((group, index) => ({
        id: `Return ${index + 1}`,
        method: "User return",
        from: destination,
        to: group[0].asset.location,
        window: `${fulfillmentReturnDate} · ${fulfillmentReturnTime}`,
        itemIds: group.map((item) => item.asset.id),
      })),
    };
    setSubmitting(true);
    setSubmitError("");
    try {
      if (draft.destinationVendorId && draft.destinationLocationId)
        await validateVendorLocation(
          draft.destinationLocationId,
          currentUser.id,
        );
      const request = durableBookingEnabled
        ? await savePersistedRequest(
            draft,
            revisionRequest,
            (() => {
              const payload = JSON.stringify(draft);
              if (attempt.current?.payload !== payload)
                attempt.current = { payload, key: crypto.randomUUID() };
              return attempt.current.key;
            })(),
          )
        : revisionRequest
          ? resubmitRequest(revisionRequest.id, draft)
          : createRequest(draft);
      router.push(`/requests/${request.id}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not submit this Request.";
      const assetName =
        error instanceof BookingClientError && error.assetId
          ? assets.find((asset) => asset.id === error.assetId)?.name
          : undefined;
      setSubmitError(assetName ? `${assetName}: ${message}` : message);
      if (
        error instanceof BookingClientError &&
        (error.code === "CONFLICT" || error.code === "STALE")
      ) {
        attempt.current = null;
        setStep(2);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 4)
    return (
      <AppShell pageLabel="Review request" showHeaderSearch={false}>
        <div className="mx-auto max-w-6xl space-y-6 pb-32 lg:pb-8">
          <header className="flex items-start justify-between gap-4">
            <div>
              <Button
                className="text-link"
                onPress={() => setStep(3)}
                size="sm"
                variant="ghost"
              >
                ← Back to fulfillment
              </Button>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                {revisionRequest
                  ? `Review changes to ${revisionRequest.id}`
                  : "Review your request"}
              </h1>
              <p className="text-muted mt-2 max-w-xl text-sm">
                Confirm the destination, selected assets, and where every asset
                returns after the activation.
              </p>
            </div>
            <Chip color="accent" variant="soft">
              Ready to submit
            </Chip>
          </header>
          <RequestSteps step={4} />
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <section className="grid min-w-0 gap-6 lg:col-span-2">
              <Card className="border-border gap-4 border p-4 sm:p-6">
                <p className="text-muted text-xs font-medium">Usage plan</p>
                <h2 className="text-lg font-semibold">{resolvedProjectName}</h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted text-xs">Usage type</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {usageType === "Ad-hoc" ? "Ad-hoc Event" : usageType}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Brand</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {usageType === "Registered event" ||
                      usageType === "Ad-hoc"
                        ? brand
                        : "—"}
                    </dd>
                  </div>
                  {event ? (
                    <div>
                      <dt className="text-muted text-xs">Parent event</dt>
                      <dd className="mt-1 text-sm font-medium break-words">
                        {getParentEvent(events, event)?.name ??
                          "Standalone event"}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-muted text-xs">Booth type</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {boothType || "No booth"}
                    </dd>
                  </div>
                  {usageType === "Ad-hoc" ? (
                    <div>
                      <dt className="text-muted text-xs">Purpose</dt>
                      <dd className="mt-1 text-sm font-medium break-words">
                        {adHocPurpose} ·{" "}
                        {adHocLocationType === "Store"
                          ? "Store"
                          : "Outside Store"}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-muted text-xs">Borrowing period</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {startDate} to {endDate} ·{" "}
                      {boothType ? `${boothUsage.usageDays} calendar days` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Full project address</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {destination}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Requesting PIC</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {currentUser.name} · {currentUser.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Project-site PIC</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {siteContact || "Not provided"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Space dimensions</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {spaceLength || "—"} × {spaceWidth || "—"} ×{" "}
                      {spaceHeight || "—"} m
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Other event details</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {projectDetails || "None provided"}
                    </dd>
                  </div>
                </dl>
                {boothError ? <p role="alert">{boothError}</p> : null}
                {windowValidation.error ? (
                  <p
                    className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                    role="alert"
                  >
                    {windowValidation.error}
                  </p>
                ) : null}
                {wbsCodes.length ? (
                  <div className="border-border grid gap-1 border-t pt-3 text-sm">
                    <strong>WBS References</strong>
                    <span>{wbsCodes.join(" · ")}</span>
                    <small>Manual references · not externally validated</small>
                  </div>
                ) : null}
                <div className="border-border grid gap-1 border-t pt-3 text-sm">
                  <strong>Budget code</strong>
                  <span>{budgetCode || "Not provided"}</span>
                  <small>
                    Manual entry · not verified against a finance system
                  </small>
                </div>
                {supportingDocuments.length ? (
                  <div className="border-border grid gap-2 border-t pt-4 text-sm">
                    <strong>Supporting documents</strong>
                    <ul>
                      {supportingDocuments.map((document) => (
                        <li key={document.id}>
                          <a
                            href={document.dataUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {document.category}: {document.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
              <Card className="border-border gap-4 border p-4 sm:p-6">
                <p className="text-muted text-xs font-medium">
                  Selected assets
                </p>
                <h2 className="text-lg font-semibold">
                  {selected.length} {assetCountLabel} will be prepared
                </h2>
                <ul className="divide-border grid divide-y text-sm">
                  {readiness.map(({ asset, quantity }) => (
                    <li
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:justify-between"
                      key={asset.id}
                    >
                      <span className="grid gap-1">
                        <strong className="line-clamp-2" title={asset.name}>
                          {asset.name}
                        </strong>
                        <small>
                          {quantity} {stockUnit(asset)} · {asset.category}
                        </small>
                      </span>
                      <span className="text-muted flex items-center gap-2 text-xs">
                        <Undo2 size={14} /> Return to {asset.location}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="border-border gap-4 border p-4 sm:p-6">
                <p className="text-muted text-xs font-medium">Fulfillment</p>
                <h2 className="text-lg font-semibold">
                  {fulfillmentMethod} from Asset operations
                </h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted text-xs">Usage</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {startDate} – {endDate}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Destination</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {destination}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Loading in</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {fulfillmentDate} · {fulfillmentTime}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">Loading out</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {fulfillmentReturnDate} · {fulfillmentReturnTime}
                    </dd>
                  </div>
                </dl>
                {windowValidation.error ? (
                  <p
                    className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                    role="alert"
                  >
                    {windowValidation.error}
                  </p>
                ) : null}
                {blocked.length ? (
                  <p
                    className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                    role="alert"
                  >
                    Resolve the selected Asset reservation conflict before
                    submitting.
                  </p>
                ) : null}
                <h3 className="text-sm font-semibold">Return plan</h3>
                <div className="bg-surface-secondary grid gap-3 rounded-xl p-4 text-sm">
                  {returnPlan.map((group) => (
                    <div className="grid gap-1" key={group[0].asset.location}>
                      <strong>{group[0].asset.location}</strong>
                      <span>
                        {group.map((item) => item.asset.name).join(", ")}
                      </span>
                      <small>
                        Return by {fulfillmentReturnDate} at{" "}
                        {fulfillmentReturnTime}
                      </small>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
            <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block">
              <RequestSummary
                title={`${selected.length} ${assetCountLabel} selected`}
                project={resolvedProjectName}
                dates={`${fulfillmentDate} · ${fulfillmentTime} → ${fulfillmentReturnDate} · ${fulfillmentReturnTime}`}
                destination={destination}
              >
                <Card.Footer className="text-muted flex-col items-stretch gap-3 text-xs">
                  {submitError || bookingError ? (
                    <p role="alert">{submitError || bookingError}</p>
                  ) : null}
                  <p>
                    After submission, this request goes to approval. Asset
                    availability will be rechecked.
                  </p>
                  <Button
                    className="w-full"
                    isDisabled={
                      !windowValidation.valid ||
                      Boolean(blocked.length) ||
                      Boolean(boothError) ||
                      budgetCodeError ||
                      submitting ||
                      bookingLoading ||
                      Boolean(bookingError)
                    }
                    onPress={submit}
                    variant="primary"
                  >
                    {submitting ? "Submitting…" : "Submit request"}
                  </Button>
                  <Button
                    className="w-full"
                    onPress={() => setStep(1)}
                    variant="secondary"
                  >
                    Edit request
                  </Button>
                </Card.Footer>
              </RequestSummary>
            </aside>
          </div>
          <div className="request-review__mobile-submit">
            {submitError || bookingError ? (
              <p role="alert">{submitError || bookingError}</p>
            ) : null}
            <Button
              isDisabled={
                (!selected.length && !canContinueWithoutAssets) ||
                Boolean(blocked.length) ||
                Boolean(boothError) ||
                !hasRequiredBooth ||
                budgetCodeError ||
                submitting ||
                bookingLoading ||
                Boolean(bookingError)
              }
              onPress={submit}
              variant="primary"
            >
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </div>
      </AppShell>
    );

  const selectionActions = (
    <div className="grid w-full grid-cols-1 gap-2">
      <Button
        className="w-full"
        isDisabled={
          Boolean(boothError) ||
          budgetCodeError ||
          (!selected.length && !canContinueWithoutAssets) ||
          !hasRequiredBooth ||
          Boolean(blocked.length)
        }
        onPress={() => {
          setIsSelectionOpen(false);
          setStep(3);
        }}
        variant="primary"
      >
        Continue to fulfillment →
      </Button>
      <Button
        className="w-full"
        onPress={() => {
          setIsSelectionOpen(false);
          setStep(1);
        }}
        variant="secondary"
      >
        ← Back
      </Button>
    </div>
  );

  return (
    <AppShell pageLabel="New request" showHeaderSearch={false}>
      <>
        <div className="mx-auto max-w-6xl space-y-6 pb-32 lg:pb-8">
          <header className="flex items-start justify-between gap-4">
            <div>
              <Link
                className="text-accent text-xs font-medium"
                href="/requests"
              >
                Requests / New request
              </Link>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Build a request
              </h1>
              <p className="text-muted mt-2 max-w-xl text-sm">
                Plan the use, choose assets, then confirm how they move.
              </p>
            </div>
            <Chip color="accent" variant="soft">
              Step {step} of 4
            </Chip>
          </header>
          <RequestSteps step={step} />
          {submitError ? (
            <p
              className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <section
              className={`grid min-w-0 gap-6 lg:col-span-2 ${step === 2 ? "pb-64 lg:pb-0" : ""}`}
            >
              {step === 1 ? (
                <>
                  <Card className="border-border gap-5 border p-4 sm:p-6">
                    <Card.Header className="flex-row items-start justify-between gap-3">
                      <div>
                        <p className="text-muted text-xs font-medium">
                          1. Usage context
                        </p>
                        <Card.Title>
                          Where will these assets be used?
                        </Card.Title>
                      </div>
                      <CalendarDays size={19} />
                    </Card.Header>
                    <p className="text-muted text-sm">
                      Choose a registered event or an ad-hoc use. Vendor
                      workshops are destinations under Ad-hoc. For relocation
                      without a usage period, use Transfer.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(["Registered event", "Ad-hoc"] as const).map(
                        (option) => (
                          <Button
                            aria-pressed={usageType === option}
                            className="w-full sm:w-auto"
                            variant={
                              usageType === option ? "primary" : "secondary"
                            }
                            key={option}
                            onPress={() => selectUsageType(option)}
                            type="button"
                          >
                            {option === "Ad-hoc" ? "Ad-hoc Event" : option}
                          </Button>
                        ),
                      )}
                    </div>
                    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                      {usageType === "Registered event" ? (
                        <>
                          <HeroSelect
                            variant="secondary"
                            label="Brand"
                            onChange={(value) =>
                              selectBrand(value as (typeof brands)[number])
                            }
                            options={brands.map((item) => ({
                              label: item,
                              value: item,
                            }))}
                            value={brand}
                          />
                          <HeroSelect
                            variant="secondary"
                            label="Event / activation"
                            onChange={selectEvent}
                            options={brandEvents.map((item) => ({
                              label: getEventPickerLabel(events, item),
                              value: item.id,
                            }))}
                            value={event?.id ?? ""}
                          />
                        </>
                      ) : usageType === "Vendor workshop" ? (
                        <HeroSelect
                          variant="secondary"
                          label="Registered vendor workshop"
                          isDisabled={vendorLoading}
                          onChange={selectLocation}
                          options={registeredLocations
                            .filter(
                              (location) =>
                                location.type === "Vendor workshop" ||
                                location.type === "Vendor warehouse",
                            )
                            .map((location) => ({
                              label: `${location.vendorName} · ${location.name} · ${location.city}`,
                              value: location.id,
                            }))}
                          value={locationId}
                        />
                      ) : (
                        <>
                          <HeroSelect
                            variant="secondary"
                            label="Brand"
                            onChange={(value) =>
                              selectBrand(value as (typeof brands)[number])
                            }
                            options={brands.map((item) => ({
                              label: item,
                              value: item,
                            }))}
                            value={brand}
                          />
                          <HeroSelect
                            variant="secondary"
                            label="Ad-hoc purpose"
                            onChange={setAdHocPurpose}
                            options={[
                              "Photoshoot",
                              "Training",
                              "Internal testing",
                            ].map((purpose) => ({
                              label: purpose,
                              value: purpose,
                            }))}
                            value={adHocPurpose}
                          />
                          <HeroSelect
                            variant="secondary"
                            label="Location type"
                            onChange={(value) => {
                              const next = value as "Store" | "Outside Store";
                              setAdHocLocationType(next);
                              if (next === "Store") {
                                const match =
                                  storeLocations.find(
                                    (location) => location.id === locationId,
                                  ) ?? storeLocations[0];
                                if (match) selectLocation(match.id);
                              }
                            }}
                            options={["Store", "Outside Store"].map(
                              (value) => ({ label: value, value }),
                            )}
                            value={adHocLocationType}
                          />
                          {adHocLocationType === "Store" ? (
                            <HeroSelect
                              variant="secondary"
                              label="Registered Store"
                              onChange={selectLocation}
                              options={storeLocations
                                .filter((location) =>
                                  location.name.startsWith(brand),
                                )
                                .map((location) => ({
                                  label: `${location.name} · ${location.city}`,
                                  value: location.id,
                                }))}
                              value={locationId}
                            />
                          ) : (
                            <>
                              <HeroSelect
                                variant="secondary"
                                label="Registered destination"
                                isDisabled={vendorLoading}
                                onChange={selectLocation}
                                options={registeredLocations.map(
                                  (location) => ({
                                    label: location.vendorId
                                      ? location.name
                                      : `${location.name} · ${location.city}`,
                                    value: location.id,
                                  }),
                                )}
                                value={locationId}
                              />
                              {vendorLoading ? (
                                <p role="status" className="text-muted text-xs">
                                  Loading vendor warehouses…
                                </p>
                              ) : vendorError ? (
                                <p
                                  role="alert"
                                  className="text-danger-soft-foreground text-xs"
                                >
                                  {vendorError}
                                </p>
                              ) : null}
                              <label className="grid min-w-0 gap-2 text-sm font-medium">
                                New place (optional)
                                <Input
                                  variant="secondary"
                                  className="w-full min-w-0"
                                  onChange={(input) => {
                                    const value = input.currentTarget.value;
                                    setAdHocPlace(value);
                                    setProjectAddress(value);
                                    setSiteContactInternalId(undefined);
                                  }}
                                  placeholder="Request-scoped; not saved as Location"
                                  value={adHocPlace}
                                />
                              </label>
                            </>
                          )}
                        </>
                      )}
                      <label className="grid min-w-0 gap-2 text-sm font-medium">
                        Project name
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          onChange={(input) =>
                            setProjectName(input.currentTarget.value)
                          }
                          placeholder="Name this booth project"
                          value={resolvedProjectName}
                          readOnly={usageType === "Registered event"}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-sm font-medium">
                        Full project address
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          onChange={(input) =>
                            setProjectAddress(input.currentTarget.value)
                          }
                          placeholder="Street, building / venue, city"
                          value={resolvedProjectAddress}
                          readOnly={usageType === "Registered event"}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-sm font-medium">
                        Borrowing period starts
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          onChange={(input) =>
                            setStartDate(input.currentTarget.value)
                          }
                          type="date"
                          value={startDate}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-sm font-medium">
                        Borrowing period ends
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          onChange={(input) =>
                            setEndDate(input.currentTarget.value)
                          }
                          type="date"
                          value={endDate}
                        />
                      </label>
                    </div>
                    <div className="bg-surface-secondary flex items-start gap-3 rounded-xl p-4 text-sm">
                      <MapPin size={16} />
                      <span className="grid gap-1">
                        <strong>{destination}</strong>
                        <small className="text-muted">
                          PIC defaults to your account · {currentUser.name}
                        </small>
                      </span>
                    </div>
                    <section
                      className="border-border space-y-3 border-t pt-5"
                      aria-labelledby="request-wbs-title"
                    >
                      <div>
                        <h3
                          className="flex items-center gap-2 text-sm font-semibold"
                          id="request-wbs-title"
                        >
                          WBS References{" "}
                          <span className="text-muted text-xs font-normal">
                            Optional
                          </span>
                        </h3>
                        <p className="text-muted mt-1 text-xs">
                          Add manual references if available. Example: ABC12345.
                          AssetHub does not verify WBS codes externally.
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:flex-row">
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          aria-label="WBS code (optional)"
                          onChange={(event) => {
                            setWbsInput(event.currentTarget.value);
                            setWbsError("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addWbsCode();
                            }
                          }}
                          placeholder="e.g. ABC12345"
                          value={wbsInput}
                        />
                        <Button
                          isDisabled={!wbsInput.trim()}
                          onPress={addWbsCode}
                          size="sm"
                          variant="primary"
                        >
                          <Plus size={15} /> Add reference
                        </Button>
                      </div>
                      {wbsError ? <small role="alert">{wbsError}</small> : null}
                      {wbsCodes.length ? (
                        <ul>
                          {wbsCodes.map((code) => (
                            <li key={code}>
                              <span>{code}</span>
                              <Button
                                aria-label={`Remove WBS ${code}`}
                                onPress={() =>
                                  setWbsCodes((current) =>
                                    current.filter((item) => item !== code),
                                  )
                                }
                                size="sm"
                                variant="ghost"
                              >
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {!wbsCodes.length && !wbsError ? (
                        <small>
                          Optional · Add one or more references if available.
                        </small>
                      ) : null}
                      <label className="border-border grid gap-2 border-t pt-4 text-sm font-medium">
                        <span className="flex items-center gap-2">
                          Budget code{" "}
                          <span className="text-danger text-xs font-normal">
                            Required
                          </span>
                        </span>
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          aria-label="Budget code (required)"
                          aria-required="true"
                          onChange={(input) =>
                            setBudgetCode(input.currentTarget.value)
                          }
                          placeholder="Enter the project budget code"
                          value={budgetCode}
                        />
                        <small>
                          Enter the code provided by your budget owner. AssetHub
                          does not validate it against a finance system.
                        </small>
                      </label>
                    </section>
                  </Card>
                  <Card className="border-border gap-5 border p-4 sm:p-6">
                    <Card.Header className="flex-row items-start justify-between gap-3">
                      <div>
                        <p className="text-muted text-xs font-medium">
                          Project information
                        </p>
                        <Card.Title>Booth and venue details</Card.Title>
                      </div>
                    </Card.Header>
                    <p className="text-muted text-sm">
                      Add the on-site contact, space dimensions, and any layout
                      notes that help the operations team prepare.
                    </p>
                    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                      <RequestSiteContactField
                        actor={currentUser}
                        value={siteContact}
                        internalId={siteContactInternalId}
                        onChange={(value, id) => {
                          setSiteContactText(value);
                          setSiteContactInternalId(id);
                        }}
                      />
                      <fieldset className="request-space-dimensions">
                        <legend>Space area dimensions (metres)</legend>
                        <label className="grid min-w-0 gap-2 text-sm font-medium">
                          Length
                          <Input
                            variant="secondary"
                            className="w-full min-w-0"
                            min="0"
                            onChange={(input) =>
                              setSpaceLength(input.currentTarget.value)
                            }
                            placeholder="Length"
                            step="0.1"
                            type="number"
                            value={spaceLength}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-medium">
                          Width
                          <Input
                            variant="secondary"
                            className="w-full min-w-0"
                            min="0"
                            onChange={(input) =>
                              setSpaceWidth(input.currentTarget.value)
                            }
                            placeholder="Width"
                            step="0.1"
                            type="number"
                            value={spaceWidth}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-medium">
                          Height
                          <Input
                            variant="secondary"
                            className="w-full min-w-0"
                            min="0"
                            onChange={(input) =>
                              setSpaceHeight(input.currentTarget.value)
                            }
                            placeholder="Height"
                            step="0.1"
                            type="number"
                            value={spaceHeight}
                          />
                        </label>
                      </fieldset>
                      <label className="col-span-full grid min-w-0 gap-2 text-sm font-medium">
                        Other event / venue details
                        <TextArea
                          variant="secondary"
                          className="w-full min-w-0"
                          onChange={(input) =>
                            setProjectDetails(input.target.value)
                          }
                          placeholder="Access, floor loading limits, setup notes, or other constraints"
                          value={projectDetails}
                        />
                      </label>
                    </div>
                  </Card>
                  <Card className="border-border gap-5 border p-4 sm:p-6">
                    <Card.Header className="flex-row items-start justify-between gap-3">
                      <div>
                        <p className="text-muted text-xs font-medium">
                          Supporting documents
                        </p>
                        <Card.Title>
                          Venue layout and loading letters
                        </Card.Title>
                      </div>
                    </Card.Header>
                    <p className="text-muted text-sm">
                      Venue layout and loading-in letter · PDF or image, up to 5
                      MB each and 5 files. Loading-out letters are added when
                      starting a return. Files stay in this browser session.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(
                        [
                          "Floor plan / venue layout",
                          "Loading-in letter",
                        ] as RequestDocumentCategory[]
                      ).map((category) => (
                        <label
                          className="border-border bg-surface-secondary flex min-w-0 flex-col gap-2 rounded-xl border border-dashed p-4 text-xs"
                          key={category}
                        >
                          <FileUp size={22} aria-hidden="true" />
                          <strong>{category}</strong>
                          <small>Choose a file · PDF or image</small>
                          <input
                            className="file:bg-surface file:text-foreground w-full min-w-0 text-xs file:mr-2 file:rounded-lg file:border-0 file:p-2"
                            accept="application/pdf,image/*"
                            aria-label={`Upload ${category}`}
                            disabled={supportingDocuments.length >= 5}
                            multiple
                            onChange={(input) => {
                              void addRequestDocuments(
                                category,
                                input.currentTarget.files,
                              );
                              input.currentTarget.value = "";
                            }}
                            type="file"
                          />
                        </label>
                      ))}
                    </div>
                    {documentError ? (
                      <p
                        className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                        role="alert"
                      >
                        {documentError}
                      </p>
                    ) : null}
                    {supportingDocuments.length ? (
                      <ul className="grid gap-3 text-xs">
                        {supportingDocuments.map((document) => (
                          <li key={document.id}>
                            <span>
                              <strong>{document.category}</strong>
                              <small>
                                {document.name} ·{" "}
                                {(document.size / 1024).toFixed(0)} KB
                              </small>
                            </span>
                            <Button
                              aria-label={`Remove ${document.name}`}
                              onPress={() =>
                                setSupportingDocuments((current) =>
                                  current.filter(
                                    (item) => item.id !== document.id,
                                  ),
                                )
                              }
                              size="sm"
                              variant="ghost"
                            >
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Card>
                  {contextError ? (
                    <p
                      className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                      role="alert"
                    >
                      {contextError}
                    </p>
                  ) : null}
                  <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
                    <span>Step 1 of 4</span>
                    <Button
                      isDisabled={Boolean(contextError) || budgetCodeError}
                      onPress={() => setStep(2)}
                      variant="primary"
                    >
                      Choose assets →
                    </Button>
                  </div>
                </>
              ) : null}
              {step === 2 ? (
                <>
                  <section className="grid min-w-0 gap-4">
                    <header className="flex flex-col items-start gap-4 xl:flex-row xl:justify-between">
                      <div>
                        <p className="text-muted text-xs">2. Select assets</p>
                        <h2 className="text-lg font-semibold">
                          Pick the assets you need
                        </h2>
                        <span className="text-muted mt-1 block text-sm">
                          Filter the list, then use + to add each available
                          asset.
                        </span>
                      </div>
                      <SearchField
                        aria-label="Search assets"
                        className="w-full max-w-md min-w-0"
                        onChange={setQuery}
                        value={query}
                      >
                        <SearchField.Group>
                          <SearchField.SearchIcon />
                          <SearchField.Input placeholder="Search assets" />
                          <SearchField.ClearButton aria-label="Clear asset search" />
                        </SearchField.Group>
                      </SearchField>
                    </header>
                    <div
                      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                      aria-label="Asset filters"
                    >
                      <HeroSelect
                        variant="secondary"
                        label="Booth requirement"
                        onChange={(value) =>
                          setBoothType(
                            value === "No booth"
                              ? ""
                              : (value as "Regular Booth" | "Custom Booth"),
                          )
                        }
                        options={[
                          "No booth",
                          "Regular Booth",
                          "Custom Booth",
                        ].map((value) => ({ label: value, value }))}
                        value={boothType || "No booth"}
                      />
                      <HeroSelect
                        variant="secondary"
                        label="Brand"
                        onChange={setAssetBrandFilter}
                        options={[
                          { label: "All brands", value: "All brands" },
                          ...assetBrands.map((item) => ({
                            label: item,
                            value: item,
                          })),
                        ]}
                        value={assetBrandFilter}
                      />
                      <HeroSelect
                        variant="secondary"
                        label="Category"
                        onChange={setAssetCategoryFilter}
                        options={[
                          { label: "All categories", value: "All categories" },
                          ...assetCategories.map((item) => ({
                            label: item,
                            value: item,
                          })),
                        ]}
                        value={assetCategoryFilter}
                      />
                    </div>
                    <p className="text-muted text-xs">
                      Regular Booth requires a Booth asset. Custom Booth is
                      recorded as a request requirement only.
                    </p>
                    {boothError ? (
                      <p
                        className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                        role="alert"
                      >
                        {boothError}
                      </p>
                    ) : null}
                    <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4">
                      {matchingAssets.slice(0, pickerCount).map((asset) => {
                        const item = selected.find(
                          (candidate) => candidate.asset.id === asset.id,
                        );
                        const eligibility = getRequestEligibility(
                          asset,
                          startDate,
                          endDate,
                          item?.quantity ?? 1,
                          reservations,
                          operationalWindow,
                        );
                        return (
                          <Card
                            className={
                              item
                                ? eligibility.eligible
                                  ? "request-asset is-selected border-accent flex h-full flex-col gap-0 overflow-hidden border p-0"
                                  : "request-asset is-selected is-conflicted border-danger flex h-full flex-col gap-0 overflow-hidden border p-0"
                                : "request-asset border-border flex h-full flex-col gap-0 overflow-hidden border p-0"
                            }
                            key={asset.id}
                          >
                            <AssetArtwork
                              asset={asset}
                              variant="tile"
                              aspectRatio="16:9"
                            />
                            <Card.Content className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                              <div className="text-muted flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span>{asset.brand}</span>
                                {asset.availability === "available" ? (
                                  <Chip
                                    color="default"
                                    variant="tertiary"
                                    size="sm"
                                    className="border-border border"
                                  >
                                    Available
                                  </Chip>
                                ) : (
                                  <AssetStatus status={asset.availability} />
                                )}
                              </div>
                              <Card.Title
                                className="line-clamp-2 min-h-12 text-base break-words"
                                title={asset.name}
                              >
                                {asset.name}
                              </Card.Title>
                              <div className="text-muted flex flex-wrap items-start gap-2 text-xs">
                                <span
                                  className="line-clamp-2 min-w-0 flex-1"
                                  title={asset.location}
                                >
                                  {asset.location}
                                </span>
                                <Chip
                                  size="sm"
                                  variant="soft"
                                  color={
                                    asset.condition === "Good"
                                      ? "success"
                                      : asset.condition === "Fair"
                                        ? "warning"
                                        : "danger"
                                  }
                                >
                                  {asset.condition}
                                </Chip>
                              </div>
                              <p
                                className={`line-clamp-3 text-xs ${eligibility.eligible ? "text-success-soft-foreground" : "text-muted"}`}
                                title={eligibility.warnings.join(" · ")}
                              >
                                {eligibility.eligible
                                  ? "Ready for selected dates"
                                  : eligibility.warnings[0]}
                              </p>
                              {item &&
                              borrowingUnits(asset).filter(
                                (unit) =>
                                  unit === stockUnit(asset) ||
                                  (asset.availableQuantity ?? 1) >=
                                    asset.unitPolicy!.unitsPerPackage!,
                              ).length > 1 ? (
                                <div className="grid gap-2">
                                  <HeroSelect
                                    label={`Borrowing unit for ${asset.name}`}
                                    value={item.borrowUnit ?? stockUnit(asset)}
                                    options={borrowingUnits(asset)
                                      .filter(
                                        (unit) =>
                                          unit === stockUnit(asset) ||
                                          (asset.availableQuantity ?? 1) >=
                                            asset.unitPolicy!.unitsPerPackage!,
                                      )
                                      .map((unit) => ({
                                        label:
                                          unit === asset.unitPolicy?.packageUnit
                                            ? `${unit} (${asset.unitPolicy.unitsPerPackage} ${stockUnit(asset)})`
                                            : unit,
                                        value: unit,
                                      }))}
                                    onChange={(unit) =>
                                      setSelected((current) =>
                                        current.map((selectedItem) =>
                                          selectedItem.asset.id !== asset.id
                                            ? selectedItem
                                            : {
                                                ...selectedItem,
                                                borrowUnit: unit as AssetUnit,
                                                quantity:
                                                  unit ===
                                                  asset.unitPolicy?.packageUnit
                                                    ? asset.unitPolicy
                                                        .unitsPerPackage!
                                                    : 1,
                                              },
                                        ),
                                      )
                                    }
                                  />
                                  <p>
                                    {item.quantity} {stockUnit(asset)} allocated
                                  </p>
                                </div>
                              ) : null}
                              <div className="border-border text-muted mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                                {item && asset.supportsQuantity ? (
                                  <span className="flex items-center gap-2">
                                    <Button
                                      aria-label={`Remove one ${asset.name}`}

                                      onPress={() => {
                                        changeQuantity(asset.id, -1);
                                      }}
                                      isIconOnly
                                      size="sm"
                                      variant="primary"
                                    >
                                      <Minus size={13} />
                                    </Button>
                                    <span>
                                      {item.quantity /
                                        (item.borrowUnit ===
                                        asset.unitPolicy?.packageUnit
                                          ? (asset.unitPolicy
                                              ?.unitsPerPackage ?? 1)
                                          : 1)}{" "}
                                      {item.borrowUnit ?? stockUnit(asset)}
                                    </span>
                                    <Button
                                      aria-label={`Add one ${asset.name}`}

                                      onPress={() => {
                                        changeQuantity(asset.id, 1);
                                      }}
                                      isIconOnly
                                      size="sm"
                                      variant="primary"
                                    >
                                      <Plus size={13} />
                                    </Button>
                                  </span>
                                ) : (
                                  <span>
                                    {item
                                      ? `In request · 1 ${stockUnit(asset)}`
                                      : "Select asset"}
                                  </span>
                                )}
                                <Button
                                  aria-label={
                                    item
                                      ? `Remove ${asset.name} from request`
                                      : `Add ${asset.name} to request`
                                  }
                                  className="request-asset__toggle"
                                  isDisabled={!eligibility.eligible && !item}

                                  onPress={() => toggleAsset(asset)}
                                  isIconOnly
                                  size="sm"
                                  variant="primary"
                                >
                                  {item ? (
                                    <Check size={16} />
                                  ) : (
                                    <Plus size={16} />
                                  )}
                                </Button>
                              </div>
                            </Card.Content>
                          </Card>
                        );
                      })}
                    </div>
                    {matchingAssets.length > pickerCount ? <Button variant="secondary" onPress={() => setPickerPaging({criteria:pickerCriteria,count:pickerCount+24})}>Show more assets ({pickerCount} of {matchingAssets.length})</Button> : null}
                  </section>
                  {boothType === "Custom Booth" ? (
                    <Card className="border-accent bg-accent-soft gap-2 border p-4 text-sm">
                      <strong>Custom Booth requirement</strong>
                      <p>
                        No existing Asset is required for this booth type. Add
                        any other assets if needed, then continue.
                      </p>
                    </Card>
                  ) : null}
                  {boothType === "Regular Booth" && !hasRequiredBooth ? (
                    <p
                      className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                      role="alert"
                    >
                      Select at least one available Booth asset for a Regular
                      Booth request.
                    </p>
                  ) : null}
                  {boothError ? (
                    <p
                      className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                      role="alert"
                    >
                      {boothError}
                    </p>
                  ) : null}
                </>
              ) : null}
              {step === 3 ? (
                <Card className="border-border gap-5 border p-4 sm:p-6">
                  <Card.Header className="flex-row items-start justify-between gap-3">
                    <div>
                      <p className="text-muted text-xs font-medium">
                        3. Fulfillment
                      </p>
                      <Card.Title>How should the assets get there?</Card.Title>
                    </div>
                    <MapPin size={19} />
                  </Card.Header>
                  <p className="text-muted text-sm">
                    Choose a delivery or pickup plan. Adjust pickup and return
                    timing before submission. Usage dates remain separate from
                    this operational reservation window.
                  </p>
                  {windowValidation.error ? (
                    <p
                      className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                      role="alert"
                    >
                      {windowValidation.error}
                    </p>
                  ) : null}
                  {blocked.length ? (
                    <p
                      className="bg-danger-soft text-danger-soft-foreground rounded-xl p-3 text-sm"
                      role="alert"
                    >
                      A selected Asset now conflicts with another operational
                      reservation. Go back to Select Assets to remove it.
                    </p>
                  ) : null}
                  <RadioGroup
                    aria-label="Fulfillment method"
                    value={fulfillmentMethod}
                    onChange={(value) =>
                      setFulfillmentMethod(value as "Delivery" | "Pickup")
                    }
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {(["Delivery", "Pickup"] as const).map((method) => (
                      <Radio
                        key={method}
                        value={method}
                        className={`rounded-xl border p-4 ${fulfillmentMethod === method ? "border-accent bg-accent-soft" : "border-border"}`}
                      >
                        <Radio.Content>
                          <Radio.Control>
                            <Radio.Indicator />
                          </Radio.Control>
                          {method}
                        </Radio.Content>
                        <Description className="mt-2 text-xs">
                          {method === "Delivery"
                            ? "We arrange transport to the destination."
                            : "Someone collects the assets from the source."}
                        </Description>
                      </Radio>
                    ))}
                  </RadioGroup>
                  <div className="bg-surface-secondary grid gap-4 rounded-xl p-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin size={17} />
                      <div className="grid gap-1">
                        <span className="text-muted text-xs">From</span>
                        <strong>Asset operations</strong>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin size={17} />
                      <div className="grid gap-1">
                        <span className="text-muted text-xs">Destination</span>
                        <strong>{destination}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="border-border space-y-2 border-t pt-4 text-sm">
                    <strong>Items · {selected.length}</strong>
                    <ul>
                      {selected.map(({ asset, quantity }) => (
                        <li key={asset.id}>
                          {asset.name}
                          {asset.supportsQuantity
                            ? ` × ${quantity} ${stockUnit(asset)}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-border flex items-start justify-between gap-3 rounded-xl border p-4 text-sm">
                    <div className="grid gap-1">
                      <strong>
                        {fulfillmentMethod} · {fulfillmentDate} ·{" "}
                        {fulfillmentTime}
                      </strong>
                      <span>
                        Return · {fulfillmentReturnDate} ·{" "}
                        {fulfillmentReturnTime}
                      </span>
                      <small>PIC: {currentUser.name}</small>
                    </div>
                    <Button
                      onPress={() => setEditingFulfillment((open) => !open)}
                      size="sm"
                      variant="secondary"
                    >
                      {editingFulfillment ? "Done" : "Edit details"}
                    </Button>
                  </div>
                  {editingFulfillment ? (
                    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-2 text-sm font-medium">
                        Loading-in date
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          onChange={(input) =>
                            setFulfillmentDate(input.currentTarget.value)
                          }
                          type="date"
                          value={fulfillmentDate}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-sm font-medium">
                        Loading-in time
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          onChange={(input) =>
                            setFulfillmentTime(input.currentTarget.value)
                          }
                          type="time"
                          value={fulfillmentTime}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-sm font-medium">
                        Loading-out date
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          onChange={(input) =>
                            setFulfillmentReturnDate(input.currentTarget.value)
                          }
                          type="date"
                          value={fulfillmentReturnDate}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-sm font-medium">
                        Loading-out time
                        <Input
                          variant="secondary"
                          className="w-full min-w-0"
                          onChange={(input) =>
                            setFulfillmentReturnTime(input.currentTarget.value)
                          }
                          type="time"
                          value={fulfillmentReturnTime}
                        />
                      </label>
                    </div>
                  ) : null}
                  <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
                    <Button onPress={() => setStep(2)} variant="secondary">
                      ← Back
                    </Button>
                    <Button
                      isDisabled={
                        !windowValidation.valid ||
                        Boolean(blocked.length) ||
                        Boolean(boothError)
                      }
                      onPress={() => setStep(4)}
                      variant="primary"
                    >
                      Review request →
                    </Button>
                  </div>
                </Card>
              ) : null}
            </section>
            <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block">
              <RequestSummary
                title={`${selected.length} ${assetCountLabel} selected`}
                project={resolvedProjectName || "Name this project"}
                dates={`${startDate} to ${endDate}${boothType ? ` · ${boothType} · ${boothUsage.usageDays} days` : ""}`}
                destination={destination}
              >
                {boothError || contextError ? (
                  <p role="alert">{boothError || contextError}</p>
                ) : null}
                <div className="max-h-[40dvh] overflow-y-auto">
                  <RequestSelectionList
                    items={readiness}
                    onRemove={removeAsset}
                  />
                </div>
                <Card.Footer className="text-muted flex-col items-stretch gap-3 text-xs">
                  {blocked.length ? (
                    <p>
                      {blocked.length} selected{" "}
                      {blocked.length === 1 ? "asset needs" : "assets need"}{" "}
                      attention before review.
                    </p>
                  ) : (
                    <p>
                      Selected items stay visible while you build the request.
                    </p>
                  )}
                  {step === 2 ? selectionActions : null}
                </Card.Footer>
              </RequestSummary>
            </aside>
          </div>
          {step === 2 ? (
            <Card
              aria-label="Request summary"
              className="border-border bg-surface fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-35 gap-3 border p-3 shadow-md lg:hidden"
            >
              <Card.Header className="gap-1">
                <span className="text-muted text-xs font-medium">
                  Request summary
                </span>
                <Button
                  className="mobile-selection-dock__count h-auto w-full flex-col items-start"
                  variant="ghost"
                  onPress={() => setIsSelectionOpen(true)}
                  type="button"
                >
                  <strong>
                    {selected.length} {assetCountLabel} selected
                  </strong>
                  <span className="text-muted text-xs">
                    View selected items
                  </span>
                </Button>
              </Card.Header>
              <Card.Footer className="w-full">{selectionActions}</Card.Footer>
            </Card>
          ) : null}
          <Modal.Backdrop
            isOpen={isSelectionOpen}
            onOpenChange={setIsSelectionOpen}
          >
            <Modal.Container placement="bottom">
              <Modal.Dialog
                className="request-selection-sheet"
                aria-label="Selected assets"
              >
                <Modal.Header className="request-selection-sheet__header">
                  <div>
                    <Modal.Heading>
                      {selected.length} {assetCountLabel} selected
                    </Modal.Heading>
                    <p className="text-muted text-sm">
                      {projectName || "New project"} · {startDate} to {endDate}
                    </p>
                  </div>

                  <Button
                    aria-label="Close selected assets"
                    onPress={() => setIsSelectionOpen(false)}
                    isIconOnly
                    size="sm"
                    variant="ghost"
                  >
                    <X />
                  </Button>
                </Modal.Header>
                <RequestSelectionList
                  items={readiness}
                  onRemove={removeAsset}
                />
                <Modal.Footer className="request-selection-sheet__footer">
                  {blocked.length ? (
                    <p>
                      {blocked.length} selected{" "}
                      {blocked.length === 1 ? "asset" : "assets"} need attention
                      before review.
                    </p>
                  ) : null}
                  {selectionActions}
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </div>
      </>
    </AppShell>
  );
}

type ReadyRequestItem = {
  asset: Asset;
  quantity: number;
  result: ReturnType<typeof getRequestEligibility>;
};

function RequestSelectionList({
  items,
  onRemove,
}: {
  items: ReadyRequestItem[];
  onRemove: (assetId: string) => void;
}) {
  if (!items.length)
    return (
      <div className="text-muted grid justify-items-center gap-3 py-8 text-center text-xs">
        <PackageOpen className="size-8" aria-hidden="true" />
        <strong className="text-foreground">Your selection starts here</strong>
        <p>
          Choose assets in the next step. They stay visible while you build the
          request.
        </p>
      </div>
    );
  return (
    <ul className="grid max-h-80 gap-3 overflow-y-auto">
      {items.map(({ asset, quantity, result }) => (
        <li
          className={`grid grid-cols-6 items-start gap-2 rounded-xl border p-3 ${result.eligible ? "border-border" : "border-danger"}`}
          key={asset.id}
        >
          <div className="col-span-1 overflow-hidden rounded-lg">
            <AssetArtwork
              asset={asset}
              variant="tile"
              aspectRatio="1:1"
              showLabels={false}
            />
          </div>
          <span className="col-span-4 grid min-w-0 gap-1 text-xs">
            <strong className="line-clamp-2" title={asset.name}>
              {asset.name}
            </strong>
            <small>
              {quantity} {stockUnit(asset)} · {asset.category}
            </small>
            <small>
              {asset.brand} · {asset.location}
            </small>
            {!result.eligible && result.warnings[0] ? (
              <small className="text-danger-soft-foreground">
                {result.warnings[0]}
              </small>
            ) : null}
          </span>
          <Chip
            className="col-span-4 col-start-2"
            color={result.eligible ? "success" : "danger"}
            size="sm"
            variant="soft"
          >
            {result.eligible ? "Ready" : "Blocked"}
          </Chip>
          <Button
            className="col-start-6 row-start-1"
            aria-label={`Remove ${asset.name}`}

            onPress={() => onRemove(asset.id)}
            isIconOnly
            size="sm"
            variant="ghost"
          >
            <X size={16} />
          </Button>
        </li>
      ))}
    </ul>
  );
}
