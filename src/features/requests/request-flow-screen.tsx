"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  MapPin,
  Minus,
  Plus,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { Button, Card, Chip, Input, TextArea } from "@heroui/react";

import { AssetArtwork } from "@/components/domain/asset-artwork";
import { AssetStatus } from "@/components/domain/asset-status";
import { AppShell } from "@/components/shared/app-shell";
import { Button as BaseButton } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { BookingClientError, durableBookingEnabled } from "@/lib/booking-client";
import { getRequestEligibility } from "@/lib/fixtures/request-eligibility";
import {
  deriveReservations,
  getOperationalWindowFromFields,
  validateOperationalWindow,
} from "@/lib/domain/reservations";
import { registeredLocations } from "@/lib/fixtures/registered-locations";
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

type Selected = { asset: Asset; quantity: number };

const brands = ["Wardah", "Make Over", "Emina", "Corporate", "Kahf"] as const;
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

export function RequestFlowScreen({ items, revisionRequest, initialWbsCodes = [] }: { items: Selected[]; revisionRequest?: PrototypeRequest; initialWbsCodes?: string[] }) {
  const router = useRouter();
  const { assets, events, requests, returnReceipts, createRequest, resubmitRequest, savePersistedRequest, bookingLoading, bookingError, currentUser } = usePrototype();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const [brand, setBrand] = useState<(typeof brands)[number]>((revisionRequest?.brand as (typeof brands)[number]) ?? "Wardah");
  const brandEvents = getSelectableEvents(events, brand);
  const [eventId, setEventId] = useState(revisionRequest?.eventId ?? brandEvents[0]?.id ?? "");
  const event = events.find(
    (item) => item.id === eventId && item.brand === brand,
  );
  const [projectName, setProjectName] = useState(revisionRequest?.projectName ?? event?.name ?? "");
  const [projectAddress, setProjectAddress] = useState(
    revisionRequest?.projectAddress ?? (event ? `${event.venue}, ${event.city}` : ""),
  );
  const [siteContact, setSiteContact] = useState(revisionRequest?.siteContact ?? event?.pic ?? "");
  const [spaceLength, setSpaceLength] = useState(revisionRequest?.spaceLength ?? "");
  const [spaceWidth, setSpaceWidth] = useState(revisionRequest?.spaceWidth ?? "");
  const [spaceHeight, setSpaceHeight] = useState(revisionRequest?.spaceHeight ?? "");
  const [projectDetails, setProjectDetails] = useState(revisionRequest?.projectDetails ?? "");
  const [budgetCode, setBudgetCode] = useState(revisionRequest?.budgetCode ?? "");
  const [supportingDocuments, setSupportingDocuments] = useState<
    RequestDocument[]
  >(revisionRequest?.supportingDocuments ?? []);
  const [documentError, setDocumentError] = useState("");
  const [startDate, setStartDate] = useState(revisionRequest?.startDate ?? event?.startDate ?? "2026-08-12");
  const [endDate, setEndDate] = useState(revisionRequest?.endDate ?? event?.endDate ?? "2026-08-16");
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
    revisionRequest?.destinationLocationId ?? registeredLocations.find(
      (location) => location.type === "Internal warehouse",
    )?.id ?? "",
  );
  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "Delivery" | "Pickup"
  >(revisionRequest?.fulfillmentGroups?.[0]?.method ?? "Delivery");
  const [editingFulfillment, setEditingFulfillment] = useState(false);
  const [fulfillmentDate, setFulfillmentDate] = useState(
    revisionRequest?.pickupDate ?? event?.startDate ?? "2026-08-12",
  );
  const [fulfillmentTime, setFulfillmentTime] = useState(revisionRequest?.pickupTime ?? "10:00");
  const [fulfillmentReturnDate, setFulfillmentReturnDate] = useState(
    revisionRequest?.returnDate ?? event?.endDate ?? "2026-08-16",
  );
  const [fulfillmentReturnTime, setFulfillmentReturnTime] = useState(revisionRequest?.returnTime ?? "12:00");
  const [adHocPurpose, setAdHocPurpose] = useState<string>(revisionRequest?.adHocPurpose ?? "Photoshoot");
  const [adHocLocationType, setAdHocLocationType] = useState<
    "Store" | "Outside Store"
  >(revisionRequest?.adHocLocationType ?? "Store");
  const [adHocPlace, setAdHocPlace] = useState(revisionRequest?.adHocPlace ?? "");
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
    () => deriveReservations(requests.filter((request) => request.id !== revisionRequest?.id), assets, events, returnReceipts),
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
  const selectedLocation = registeredLocations.find(
    (location) => location.id === locationId,
  );
  const contextError =
    usageType === "Registered event" && !event
      ? "Select a registered Event for this Brand."
      : !projectName.trim()
        ? "Enter a project name."
        : !projectAddress.trim()
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
  const destination = projectAddress.trim() || destinationLabel;
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
    setUsageType(next);
    setProjectName(next === "Registered event" ? (event?.name ?? "") : "");
    if (next === "Registered event") {
      setProjectAddress(event ? `${event.venue}, ${event.city}` : "");
      setSiteContact(event?.pic ?? "");
    }
    const preferredLocation = registeredLocations.find(
      (location) =>
        location.type ===
        (next === "Vendor workshop" ? "Vendor workshop" : "Internal warehouse"),
    );
    const nextLocation =
      next === "Ad-hoc"
        ? storeLocations.find((location) => location.name.startsWith(brand))
        : preferredLocation;
    if (nextLocation) {
      setLocationId(nextLocation.id);
      setProjectAddress(`${nextLocation.address}, ${nextLocation.city}`);
      setSiteContact(nextLocation.contact ?? "");
    }
  };
  const selectLocation = (nextId: string) => {
    const nextLocation = registeredLocations.find(
      (location) => location.id === nextId,
    );
    setLocationId(nextId);
    if (nextLocation) {
      setProjectAddress(`${nextLocation.address}, ${nextLocation.city}`);
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
              quantity: Math.max(
                1,
                Math.min(
                  item.asset.availableQuantity ?? 1,
                  item.quantity + delta,
                ),
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
    const destinationType =
      usageType === "Registered event"
        ? "Event venue"
        : usageType === "Ad-hoc" && adHocLocationType === "Store"
          ? "Other"
          : (selectedDestinationType ?? "Internal warehouse");
    const resolvedActivityName = projectName.trim();
    const draft: RequestDraft = {
      items: selected.map(({ asset, quantity }) => ({
        assetId: asset.id,
        quantity,
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
      projectAddress: projectAddress.trim(),
      siteContact: siteContact.trim() || undefined,
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
        usageType === "Vendor workshop"
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
      contact: revisionRequest?.contact ?? `${currentUser.name} · ${currentUser.email}`,
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
            usageType === "Vendor workshop"
              ? selectedLocation?.vendorId
              : undefined,
          destinationLocationId:
            usageType === "Registered event" ? undefined : selectedLocation?.id,
          window: `${fulfillmentDate} ${fulfillmentTime} to ${fulfillmentReturnDate} ${fulfillmentReturnTime}`,
          pickupDate: fulfillmentDate,
          pickupTime: fulfillmentTime,
          returnDate: fulfillmentReturnDate,
          returnTime: fulfillmentReturnTime,
          contact: revisionRequest?.fulfillmentGroups?.[0]?.contact ?? currentUser.name,
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
      const request = durableBookingEnabled
        ? await savePersistedRequest(draft, revisionRequest, (() => {
            const payload = JSON.stringify(draft);
            if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
            return attempt.current.key;
          })())
        : revisionRequest ? resubmitRequest(revisionRequest.id, draft) : createRequest(draft);
      router.push(`/requests/${request.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit this Request.";
      const assetName = error instanceof BookingClientError && error.assetId ? assets.find((asset) => asset.id === error.assetId)?.name : undefined;
      setSubmitError(assetName ? `${assetName}: ${message}` : message);
      if (error instanceof BookingClientError && (error.code === "CONFLICT" || error.code === "STALE")) {
        attempt.current = null;
        setStep(2);
      }
    } finally { setSubmitting(false); }
  };

  if (step === 4)
    return (
      <AppShell pageLabel="Review request">
        <div className="request-workspace request-review">
          <header className="request-workspace__header">
            <div>
              <Button
                className="text-link"
                onPress={() => setStep(3)}
                size="sm"
                variant="tertiary"
              >
                ← Back to fulfillment
              </Button>
              <h1>{revisionRequest ? `Review changes to ${revisionRequest.id}` : "Review your request"}</h1>
              <p>
                Confirm the destination, selected assets, and where every asset
                returns after the activation.
              </p>
            </div>
            <Chip color="accent" variant="soft">
              Ready to submit
            </Chip>
          </header>
          <div className="request-review__grid">
            <section className="request-review__content">
              <Card className="review-panel">
                <p>Usage plan</p>
                <h2>{projectName}</h2>
                <dl>
                  <div>
                    <dt>Usage type</dt>
                    <dd>
                      {usageType === "Ad-hoc" ? "Ad-hoc Event" : usageType}
                    </dd>
                  </div>
                  <div>
                    <dt>Brand</dt>
                    <dd>
                      {usageType === "Registered event" ||
                      usageType === "Ad-hoc"
                        ? brand
                        : "—"}
                    </dd>
                  </div>
                  {event ? (
                    <div>
                      <dt>Parent event</dt>
                      <dd>
                        {getParentEvent(events, event)?.name ??
                          "Standalone event"}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Booth type</dt>
                    <dd>{boothType || "No booth"}</dd>
                  </div>
                  {usageType === "Ad-hoc" ? (
                    <div>
                      <dt>Purpose</dt>
                      <dd>
                        {adHocPurpose} ·{" "}
                        {adHocLocationType === "Store"
                          ? "Store"
                          : "Outside Store"}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Borrowing period</dt>
                    <dd>
                      {startDate} to {endDate} ·{" "}
                      {boothType ? `${boothUsage.usageDays} calendar days` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Full project address</dt>
                    <dd>{destination}</dd>
                  </div>
                  <div>
                    <dt>Requesting PIC</dt>
                    <dd>
                      {currentUser.name} · {currentUser.email}
                    </dd>
                  </div>
                  <div>
                    <dt>Project-site PIC</dt>
                    <dd>{siteContact || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Space dimensions</dt>
                    <dd>
                      {spaceLength || "—"} × {spaceWidth || "—"} ×{" "}
                      {spaceHeight || "—"} m
                    </dd>
                  </div>
                  <div>
                    <dt>Other event details</dt>
                    <dd>{projectDetails || "None provided"}</dd>
                  </div>
                </dl>
                {boothError ? <p role="alert">{boothError}</p> : null}
                {windowValidation.error ? (
                  <p className="request-validation-error" role="alert">
                    {windowValidation.error}
                  </p>
                ) : null}
                {wbsCodes.length ? (
                  <div className="request-wbs-review">
                    <strong>WBS References</strong>
                    <span>{wbsCodes.join(" · ")}</span>
                    <small>Manual references · not externally validated</small>
                  </div>
                ) : null}
                <div className="request-wbs-review">
                  <strong>Budget code</strong>
                  <span>{budgetCode || "Not provided"}</span>
                  <small>
                    Manual entry · not verified against a finance system
                  </small>
                </div>
                {supportingDocuments.length ? (
                  <div className="request-review-documents">
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
              <Card className="review-panel">
                <p>Selected assets</p>
                <h2>
                  {selected.length} {assetCountLabel} will be prepared
                </h2>
                <ul className="review-items">
                  {readiness.map(({ asset, quantity }) => (
                    <li key={asset.id}>
                      <span>
                        <strong>{asset.name}</strong>
                        <small>
                          {quantity} x {asset.category}
                        </small>
                      </span>
                      <span className="review-return">
                        <Undo2 size={14} /> Return to {asset.location}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="review-panel">
                <p>Fulfillment</p>
                <h2>{fulfillmentMethod} from Asset operations</h2>
                <dl>
                  <div>
                    <dt>Usage</dt>
                    <dd>
                      {startDate} – {endDate}
                    </dd>
                  </div>
                  <div>
                    <dt>Destination</dt>
                    <dd>{destination}</dd>
                  </div>
                  <div>
                    <dt>Loading in</dt>
                    <dd>
                      {fulfillmentDate} · {fulfillmentTime}
                    </dd>
                  </div>
                  <div>
                    <dt>Loading out</dt>
                    <dd>
                      {fulfillmentReturnDate} · {fulfillmentReturnTime}
                    </dd>
                  </div>
                </dl>
                {windowValidation.error ? (
                  <p className="request-validation-error" role="alert">
                    {windowValidation.error}
                  </p>
                ) : null}
                {blocked.length ? (
                  <p className="request-validation-error" role="alert">
                    Resolve the selected Asset reservation conflict before
                    submitting.
                  </p>
                ) : null}
                <h3>Return plan</h3>
                <div className="review-return-groups">
                  {returnPlan.map((group) => (
                    <div key={group[0].asset.location}>
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
            <aside className="request-summary">
              <Card>
                <header>
                  <p>Ready to submit</p>
                  <h2>
                    {selected.length} {assetCountLabel} selected
                  </h2>
                </header>
                <div className="request-summary__context">
                  <span>{destination}</span>
                  <small>
                    {fulfillmentDate} · {fulfillmentTime} →{" "}
                    {fulfillmentReturnDate} · {fulfillmentReturnTime}
                  </small>
                </div>
                <footer>
                  {submitError || bookingError ? <p role="alert">{submitError || bookingError}</p> : null}
                  <p>
                    After submission, this request goes to approval. Asset
                    availability will be rechecked.
                  </p>
                  <Button
                    fullWidth
                    isDisabled={
                      !windowValidation.valid ||
                      Boolean(blocked.length) ||
                      Boolean(boothError) ||
                      budgetCodeError
                      || submitting || bookingLoading || Boolean(bookingError)
                    }
                    onPress={submit}
                    variant="primary"
                  >
                    {submitting ? "Submitting…" : "Submit request"}
                  </Button>
                  <Button
                    fullWidth
                    onPress={() => setStep(1)}
                    variant="secondary"
                  >
                    Edit request
                  </Button>
                </footer>
              </Card>
            </aside>
          </div>
          <div className="request-review__mobile-submit">
            {submitError || bookingError ? <p role="alert">{submitError || bookingError}</p> : null}
            <Button
              isDisabled={
                (!selected.length && !canContinueWithoutAssets) ||
                Boolean(blocked.length) ||
                Boolean(boothError) ||
                !hasRequiredBooth ||
                budgetCodeError
                || submitting || bookingLoading || Boolean(bookingError)
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

  return (
    <AppShell pageLabel="New request">
      <Sheet onOpenChange={setIsSelectionOpen} open={isSelectionOpen}>
        <div className="request-workspace">
          <header className="request-workspace__header">
            <div>
              <Link href="/requests">Requests</Link>
              <h1>Build a request</h1>
              <p>Plan the use, choose assets, then confirm how they move.</p>
            </div>
            <Chip color="accent" variant="soft">
              Step {step} of 4
            </Chip>
          </header>
          <nav className="request-stepper" aria-label="Request steps">
            {[
              "Usage & dates",
              "Select assets",
              "Fulfillment",
              "Review & submit",
            ].map((label, index) => (
              <span
                aria-current={step === index + 1 ? "step" : undefined}
                className={
                  step === index + 1
                    ? "is-active"
                    : step > index + 1
                      ? "is-complete"
                      : ""
                }
                key={label}
              >
                <i>{index + 1}</i>
                {label}
              </span>
            ))}
          </nav>
          {submitError ? <p className="request-validation-error" role="alert">{submitError}</p> : null}
          <div className="request-workspace__grid">
            <section className="request-workspace__canvas">
              {step === 1 ? (
                <>
                  <Card className="request-context-card">
                    <header>
                      <div>
                        <p>1. Usage context</p>
                        <h2>Where will these assets be used?</h2>
                      </div>
                      <CalendarDays size={19} />
                    </header>
                    <p className="request-context-card__helper">
                      Choose an event or registered destination. Availability is
                      checked against the usage dates.
                    </p>
                    <div className="request-usage-options">
                      {(
                        [
                          "Registered event",
                          "Vendor workshop",
                          "Ad-hoc",
                        ] as const
                      ).map((option) => (
                        <button
                          aria-pressed={usageType === option}
                          className={usageType === option ? "is-selected" : ""}
                          key={option}
                          onClick={() => selectUsageType(option)}
                          type="button"
                        >
                          {option === "Ad-hoc" ? "Ad-hoc Event" : option}
                        </button>
                      ))}
                    </div>
                    <div className="request-context-card__fields">
                      <label>
                        Project name
                        <Input
                          onChange={(input) =>
                            setProjectName(input.currentTarget.value)
                          }
                          placeholder="Name this booth project"
                          value={projectName}
                        />
                      </label>
                      {usageType === "Registered event" ? (
                        <>
                          <HeroSelect
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
                          label="Registered vendor workshop"
                          onChange={selectLocation}
                          options={registeredLocations
                            .filter(
                              (location) => location.type === "Vendor workshop",
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
                                label="Registered destination"
                                onChange={selectLocation}
                                options={registeredLocations.map(
                                  (location) => ({
                                    label: `${location.name} · ${location.city}`,
                                    value: location.id,
                                  }),
                                )}
                                value={locationId}
                              />
                              <label>
                                New place (optional)
                                <Input
                                  onChange={(input) => {
                                    const value = input.currentTarget.value;
                                    setAdHocPlace(value);
                                    setProjectAddress(value);
                                  }}
                                  placeholder="Request-scoped; not saved as Location"
                                  value={adHocPlace}
                                />
                              </label>
                            </>
                          )}
                        </>
                      )}
                      <label>
                        Full project address
                        <Input
                          onChange={(input) =>
                            setProjectAddress(input.currentTarget.value)
                          }
                          placeholder="Street, building / venue, city"
                          value={projectAddress}
                        />
                      </label>
                      <label>
                        Borrowing period starts
                        <Input
                          onChange={(input) =>
                            setStartDate(input.currentTarget.value)
                          }
                          type="date"
                          value={startDate}
                        />
                      </label>
                      <label>
                        Borrowing period ends
                        <Input
                          onChange={(input) =>
                            setEndDate(input.currentTarget.value)
                          }
                          type="date"
                          value={endDate}
                        />
                      </label>
                    </div>
                    <div className="request-context-card__event">
                      <MapPin size={16} />
                      <span>
                        <strong>{destination}</strong>
                        <small>
                          PIC defaults to your account ·{" "}
                          {currentUser.name}
                        </small>
                      </span>
                    </div>
                    <section
                      className="request-wbs-entry"
                      aria-labelledby="request-wbs-title"
                    >
                      <div>
                        <h3 id="request-wbs-title">
                          WBS References <span>Optional</span>
                        </h3>
                        <p>
                          Add manual references if available. Example: ABC12345.
                          AssetHub does not verify WBS codes externally.
                        </p>
                      </div>
                      <div className="request-wbs-entry__input">
                        <Input
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
                          Optional · WBS ownership and required contexts are not
                          yet defined.
                        </small>
                      ) : null}
                      <label className="request-budget-code">
                        Budget code <span>Required</span>
                        <Input
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
                  <Card className="request-project-details">
                    <header>
                      <div>
                        <p>Project information</p>
                        <h2>Booth and venue details</h2>
                      </div>
                    </header>
                    <p className="request-context-card__helper">
                      Add the on-site contact, space dimensions, and any layout
                      notes that help the operations team prepare.
                    </p>
                    <div className="request-context-card__fields">
                      <label className="request-project-details__wide">
                        Project-site PIC (name and contact)
                        <Input
                          onChange={(input) =>
                            setSiteContact(input.currentTarget.value)
                          }
                          placeholder="Name · phone number"
                          value={siteContact}
                        />
                      </label>
                      <fieldset className="request-space-dimensions">
                        <legend>Space area dimensions (metres)</legend>
                        <label>
                          Length
                          <Input
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
                        <label>
                          Width
                          <Input
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
                        <label>
                          Height
                          <Input
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
                      <label className="request-project-details__wide">
                        Other event / venue details
                        <TextArea
                          onChange={(input) =>
                            setProjectDetails(input.target.value)
                          }
                          placeholder="Access, floor loading limits, setup notes, or other constraints"
                          value={projectDetails}
                        />
                      </label>
                    </div>
                  </Card>
                  <Card className="request-project-documents">
                    <header>
                      <div>
                        <p>Supporting documents</p>
                        <h2>Venue layout and loading letters</h2>
                      </div>
                    </header>
                    <p className="request-context-card__helper">
                      Optional · PDF or image, up to 5 MB each and 5 files per
                      request. Prototype files stay in this browser session and
                      are not uploaded to permanent storage.
                    </p>
                    <div className="request-document-upload-grid">
                      {(
                        [
                          "Floor plan / venue layout",
                          "Loading-in letter",
                          "Loading-out letter",
                        ] as RequestDocumentCategory[]
                      ).map((category) => (
                        <label key={category}>
                          {category}
                          <input
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
                      <p className="request-validation-error" role="alert">
                        {documentError}
                      </p>
                    ) : null}
                    {supportingDocuments.length ? (
                      <ul className="request-document-list">
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
                    <p className="request-validation-error" role="alert">
                      {contextError}
                    </p>
                  ) : null}
                  <div className="request-step-actions">
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
                  <section className="request-inventory">
                    <header>
                      <div>
                        <p>2. Select assets</p>
                        <h2>Pick the assets you need</h2>
                        <span>
                          Filter the list, then use + to add each available
                          asset.
                        </span>
                      </div>
                      <div className="request-inventory__search">
                        <Search size={16} />
                        <Input
                          aria-label="Search assets"
                          onChange={(input) =>
                            setQuery(input.currentTarget.value)
                          }
                          placeholder="Search assets"
                          value={query}
                        />
                      </div>
                    </header>
                    <div
                      className="request-inventory__filters"
                      aria-label="Asset filters"
                    >
                      <HeroSelect
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
                    <p className="request-picker-filter-help">
                      Regular Booth requires a Booth asset. Custom Booth is
                      recorded as a request requirement only.
                    </p>
                    {boothError ? (
                      <p className="request-validation-error" role="alert">
                        {boothError}
                      </p>
                    ) : null}
                    <div className="request-inventory__grid">
                      {matchingAssets.map((asset) => {
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
                                  ? "request-asset is-selected"
                                  : "request-asset is-selected is-conflicted"
                                : "request-asset"
                            }
                            key={asset.id}
                          >
                            <AssetArtwork asset={asset} variant="tile" />
                            <div>
                              <div className="request-asset__top">
                                <span>{asset.brand}</span>
                                <AssetStatus status={asset.availability} />
                              </div>
                              <h3>{asset.name}</h3>
                              <small>
                                {asset.location} · {asset.condition}
                              </small>
                              <p>
                                {eligibility.eligible
                                  ? "Ready for selected dates"
                                  : eligibility.warnings[0]}
                              </p>
                              <div className="request-asset__actions">
                                {item && asset.supportsQuantity ? (
                                  <span>
                                    <Button
                                      aria-label={`Remove one ${asset.name}`}
                                      isIconOnly
                                      onClick={(input) => {
                                        input.stopPropagation();
                                        changeQuantity(asset.id, -1);
                                      }}
                                      size="sm"
                                      variant="primary"
                                    >
                                      <Minus size={13} />
                                    </Button>
                                    {item.quantity}
                                    <Button
                                      aria-label={`Add one ${asset.name}`}
                                      isIconOnly
                                      onClick={(input) => {
                                        input.stopPropagation();
                                        changeQuantity(asset.id, 1);
                                      }}
                                      size="sm"
                                      variant="primary"
                                    >
                                      <Plus size={13} />
                                    </Button>
                                  </span>
                                ) : (
                                  <span>
                                    {item ? "In request" : "Select asset"}
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
                                  isIconOnly
                                  onPress={() => toggleAsset(asset)}
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
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                  {boothType === "Custom Booth" ? (
                    <Card className="request-custom-booth-note">
                      <strong>Custom Booth requirement</strong>
                      <p>
                        No existing Asset is required for this booth type. Add
                        any other assets if needed, then continue.
                      </p>
                    </Card>
                  ) : null}
                  {boothType === "Regular Booth" && !hasRequiredBooth ? (
                    <p className="request-validation-error" role="alert">
                      Select at least one available Booth asset for a Regular
                      Booth request.
                    </p>
                  ) : null}
                  {boothError ? (
                    <p className="request-validation-error" role="alert">
                      {boothError}
                    </p>
                  ) : null}
                  <div className="request-step-actions">
                    <Button onPress={() => setStep(1)} variant="secondary">
                      ← Back
                    </Button>
                    <Button
                      isDisabled={
                        Boolean(boothError) ||
                        budgetCodeError ||
                        (!selected.length && !canContinueWithoutAssets) ||
                        !hasRequiredBooth ||
                        Boolean(blocked.length)
                      }
                      onPress={() => setStep(3)}
                      variant="primary"
                    >
                      Continue to fulfillment →
                    </Button>
                  </div>
                </>
              ) : null}
              {step === 3 ? (
                <Card className="request-context-card fulfillment-step">
                  <header>
                    <div>
                      <p>3. Fulfillment</p>
                      <h2>How should the assets get there?</h2>
                    </div>
                    <MapPin size={19} />
                  </header>
                  <p className="request-context-card__helper">
                    Choose a delivery or pickup plan. Adjust pickup and return
                    timing before submission. Usage dates remain separate from
                    this operational reservation window.
                  </p>
                  {windowValidation.error ? (
                    <p className="request-validation-error" role="alert">
                      {windowValidation.error}
                    </p>
                  ) : null}
                  {blocked.length ? (
                    <p className="request-validation-error" role="alert">
                      A selected Asset now conflicts with another operational
                      reservation. Go back to Select Assets to remove it.
                    </p>
                  ) : null}
                  <div className="fulfillment-method-options">
                    {(["Delivery", "Pickup"] as const).map((method) => (
                      <button
                        aria-pressed={fulfillmentMethod === method}
                        className={
                          fulfillmentMethod === method
                            ? "fulfillment-method-choice is-selected"
                            : "fulfillment-method-choice"
                        }
                        key={method}
                        onClick={() => setFulfillmentMethod(method)}
                        type="button"
                      >
                        <strong>{method}</strong>
                        <small>
                          {method === "Delivery"
                            ? "We arrange transport to the destination."
                            : "Someone collects the assets from the source."}
                        </small>
                      </button>
                    ))}
                  </div>
                  <div className="fulfillment-group__route">
                    <div className="fulfillment-place">
                      <MapPin size={17} />
                      <div>
                        <span>From</span>
                        <strong>Asset operations</strong>
                      </div>
                    </div>
                    <div className="fulfillment-place">
                      <MapPin size={17} />
                      <div>
                        <span>Destination</span>
                        <strong>{destination}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="fulfillment-items">
                    <strong>Items · {selected.length}</strong>
                    <ul>
                      {selected.map(({ asset, quantity }) => (
                        <li key={asset.id}>
                          {asset.name}
                          {asset.supportsQuantity ? ` × ${quantity}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="fulfillment-edit-card">
                    <div>
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
                    <div className="request-context-card__fields fulfillment-details-editor">
                      <label>
                        Loading-in date
                        <Input
                          onChange={(input) =>
                            setFulfillmentDate(input.currentTarget.value)
                          }
                          type="date"
                          value={fulfillmentDate}
                        />
                      </label>
                      <label>
                        Loading-in time
                        <Input
                          onChange={(input) =>
                            setFulfillmentTime(input.currentTarget.value)
                          }
                          type="time"
                          value={fulfillmentTime}
                        />
                      </label>
                      <label>
                        Loading-out date
                        <Input
                          onChange={(input) =>
                            setFulfillmentReturnDate(input.currentTarget.value)
                          }
                          type="date"
                          value={fulfillmentReturnDate}
                        />
                      </label>
                      <label>
                        Loading-out time
                        <Input
                          onChange={(input) =>
                            setFulfillmentReturnTime(input.currentTarget.value)
                          }
                          type="time"
                          value={fulfillmentReturnTime}
                        />
                      </label>
                    </div>
                  ) : null}
                  <div className="request-step-actions">
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
            <aside className="request-summary">
              <Card>
                <header>
                  <p>Request summary</p>
                  <h2>
                    {selected.length} {assetCountLabel} selected
                  </h2>
                </header>
                <div className="request-summary__context">
                  <span>{projectName || "Name this project"}</span>
                  <small>
                    {startDate} to {endDate}
                    {boothType
                      ? ` · ${boothType} · ${boothUsage.usageDays} days`
                      : ""}
                  </small>
                </div>
                {boothError || contextError ? (
                  <p role="alert">{boothError || contextError}</p>
                ) : null}
                <RequestSelectionList
                  items={readiness}
                  onRemove={removeAsset}
                />
                <footer>
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
                  <Button
                    fullWidth
                    isDisabled={
                      Boolean(boothError) ||
                      Boolean(contextError) ||
                      (step === 3 && !windowValidation.valid) ||
                      (step === 3 && Boolean(blocked.length)) ||
                      budgetCodeError ||
                      (!selected.length && !canContinueWithoutAssets) ||
                      Boolean(blocked.length) ||
                      !hasRequiredBooth
                    }
                    onPress={() => setStep(step === 1 ? 2 : step === 2 ? 3 : 4)}
                    variant="primary"
                  >
                    {step === 1
                      ? "Select assets"
                      : step === 2
                        ? "Continue"
                        : "Review request"}
                  </Button>
                </footer>
              </Card>
            </aside>
          </div>
          {selected.length > 0 && step === 2 ? (
            <div className="mobile-selection-dock">
              <button
                className="mobile-selection-dock__count"
                onClick={() => setIsSelectionOpen(true)}
                type="button"
              >
                <strong>
                  {selected.length} {assetCountLabel} selected
                </strong>
                <span>View selected items</span>
              </button>
              <Button
                fullWidth
                isDisabled={
                  Boolean(blocked.length) ||
                  Boolean(boothError) ||
                  !hasRequiredBooth
                }
                onPress={() => setStep(3)}
                variant="primary"
              >
                Continue
              </Button>
            </div>
          ) : null}
          <SheetContent
            className="request-selection-sheet"
            showCloseButton={false}
            side="bottom"
          >
            <SheetHeader className="request-selection-sheet__header">
              <div>
                <SheetTitle>
                  {selected.length} {assetCountLabel} selected
                </SheetTitle>
                <SheetDescription>
                  {projectName || "New project"} · {startDate} to {endDate}
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <BaseButton
                  aria-label="Close selected assets"
                  size="icon"
                  variant="ghost"
                >
                  <X />
                </BaseButton>
              </SheetClose>
            </SheetHeader>
            <RequestSelectionList items={readiness} onRemove={removeAsset} />
            <SheetFooter className="request-selection-sheet__footer">
              {blocked.length ? (
                <p>
                  {blocked.length} selected{" "}
                  {blocked.length === 1 ? "asset" : "assets"} need attention
                  before review.
                </p>
              ) : null}
              <Button
                fullWidth
                isDisabled={
                  Boolean(boothError) ||
                  budgetCodeError ||
                  (!selected.length && !canContinueWithoutAssets) ||
                  Boolean(blocked.length) ||
                  !hasRequiredBooth
                }
                onPress={() => {
                  setIsSelectionOpen(false);
                  setStep(3);
                }}
                variant="primary"
              >
                Continue to fulfillment
              </Button>
            </SheetFooter>
          </SheetContent>
        </div>
      </Sheet>
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
      <p className="request-summary__empty">
        Start by adding an available asset.
      </p>
    );
  return (
    <ul className="request-selection-list">
      {items.map(({ asset, quantity, result }) => (
        <li className={result.eligible ? "" : "is-conflicted"} key={asset.id}>
          <AssetArtwork asset={asset} variant="tile" />
          <span className="request-selection-list__identity">
            <strong>{asset.name}</strong>
            <small>
              {quantity} × {asset.category}
            </small>
            <small>
              {asset.brand} · {asset.location}
            </small>
            {!result.eligible && result.warnings[0] ? (
              <small className="request-selection-list__warning">
                {result.warnings[0]}
              </small>
            ) : null}
          </span>
          <Chip
            color={result.eligible ? "success" : "danger"}
            size="sm"
            variant="soft"
          >
            {result.eligible ? "Ready" : "Blocked"}
          </Chip>
          <Button
            aria-label={`Remove ${asset.name}`}
            isIconOnly
            onPress={() => onRemove(asset.id)}
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
