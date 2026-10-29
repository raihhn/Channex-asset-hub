import { createHash } from "node:crypto";
const clean = (v) => String(v ?? "").trim();
const key = (v) =>
  clean(v)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const brandAliases = {
  makeover: "Make Over",
  light: "Lightplus",
  lightplus: "Lightplus",
  earthlife: "Earth Love Life",
  earthlovelife: "Earth Love Life",
  allbrand: "All Brand",
  wardah: "Wardah",
  wardahcolourcircuit: "Wardah",
  wardahskincare: "Wardah",
  labore: "Labore",
  kahf: "Kahf",
};
export function parseQuantity(value, unit) {
  const raw = clean(value),
    match = raw.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?(?:\s*\(.*\))?$/i);
  const aliases = {
    pcs: "Pcs",
    pc: "Pcs",
    unit: "Unit",
    set: "Set",
    dus: "Dus",
    box: "Box",
    pack: "Pack",
    roll: "Roll",
    meter: "Meter",
  };
  const explicit = aliases[key(unit)],
    embedded = aliases[key(match?.[2])];
  return {
    quantity: match ? Number(match[1]) : null,
    unit: explicit ?? embedded ?? null,
    conflict: !!explicit && !!embedded && explicit !== embedded,
  };
}
export function buildWarehouseAliases(warehouses, sourceVendors) {
  const map = new Map();
  for (const w of warehouses.filter((w) => w.warehouse_id)) {
    const row = sourceVendors.find(
      (s) => s.vendor === w.vendor && s.warehouse === w.warehouse,
    );
    const names = [
      `${w.vendor} ${w.warehouse}`,
      `${w.legal_name ?? ""} ${w.warehouse}`,
    ];
    if (row) {
      if (w.vendor === "Ofsorts")
        names.push(
          `Orang Seni Sejahtera (Ofsorts${w.warehouse === "Jakarta" ? "" : " " + w.warehouse})`,
        );
      else if (w.vendor === "Volk")
        names.push(`Kinarya Artha Jaya Nusantara (Volk ${w.warehouse})`);
      else
        names.push(row.legalName ? `${row.legalName} (${w.vendor})` : w.vendor);
      if (
        sourceVendors.filter((s) => s.vendor === w.vendor && s.address).length >
          1 &&
        w.vendor !== "Ofsorts" &&
        w.vendor !== "Volk"
      ) {
        names.length = 2;
        names.push(`${row.vendor} ${row.warehouse}`);
      }
    }
    names.push(w.vendor === "Dua Garis Imagi" ? `DGI ${w.warehouse}` : "");
    if (w.vendor === "Hanuman")
      names.push("Imaji Nova Caraka (Hanuman)", "Hanuman");
    for (const n of names.filter(Boolean)) {
      const k = key(n);
      if (!map.has(k)) map.set(k, []);
      if (!map.get(k).some((x) => x.warehouse_id === w.warehouse_id))
        map.get(k).push(w);
    }
  }
  return map;
}
export function mapSourceRow(source, aliases) {
  const v = source.values;
  const notes = [v.Z, v.AC].filter(Boolean).join("\n");
  let locationLabel = clean(v.N),
    unknownLocation = false;
  const warnings = [];
  // Explicit source corrections, kept reviewable; partial/component transfers are not whole-asset relocations.
  if (source.sheet === "ALL BRAND (Storedev)") {
    if (source.row === 4) locationLabel = "DGI Jatim";
    if (source.row === 18) locationLabel = "Hanuman";
    if ([47, 222].includes(source.row)) {
      // User explicitly confirmed DGI Jateng is the Semarang warehouse.
      locationLabel = "DGI Semarang";
    }
    if (source.row === 45) {
      locationLabel = "Lokasi belum dikonfirmasi";
      unknownLocation = true;
      warnings.push(
        "Notes menyatakan asset tidak ada di Hanuman; lokasi tujuan tidak dicantumkan.",
      );
    }
    if ([62, 63, 397].includes(source.row)) {
      unknownLocation = true;
      warnings.push(
        "Notes menyebut pemecahan/transfer sebagian; jumlah dan lokasi setiap bagian perlu dikonfirmasi.",
      );
      locationLabel =
        source.row === 62
          ? "DGI Jabar / Gerai Cipta"
          : source.row === 63
            ? "Kitiran Bandung / DGI Jabar"
            : "Studio Kreasindo / DGI Lampung";
    }
  }
  const isInternal = v.M === "Internal";
  const matches = aliases.get(key(locationLabel)) ?? [];
  const warehouse =
    !unknownLocation && matches.length === 1 ? matches[0] : null;
  if (!isInternal && !warehouse && !unknownLocation)
    warnings.push(
      `Warehouse belum terpetakan: ${locationLabel || "belum diisi"}.`,
    );
  if (!locationLabel) {
    locationLabel = "Lokasi belum dikonfirmasi";
    warnings.push("Warehouse belum diisi.");
  }
  const qty = parseQuantity(v.P, v.Q);
  if (source.sheet === "ALL BRAND (Storedev)" && source.row === 56)
    qty.quantity = 1;
  if (qty.quantity === null || qty.quantity <= 0)
    warnings.push("Jumlah stok belum valid; nilai sumber dipertahankan.");
  if (!qty.unit)
    warnings.push("UoM belum diisi; tidak mengasumsikan Pcs/Unit.");
  if (qty.conflict) warnings.push("UoM kolom dan teks Qty berbeda.");
  const classification =
    key(v.B) === "asset"
      ? "ASSET"
      : key(v.B) === "inventory"
        ? "INVENTORY"
        : "UNCLASSIFIED";
  if (classification === "UNCLASSIFIED")
    warnings.push("Klasifikasi Asset/Inventory belum diisi.");
  const primary = clean(v.E),
    code = clean(v.D);
  const independent =
    source.sheet === "ALL BRAND (Gd.Internal)" &&
    [2, 3, 4].includes(source.row);
  if (!independent && qty.unit === "Set")
    warnings.push(
      "Komposisi paket / item mandiri belum dikonfirmasi; Set adalah satuan stok sumber.",
    );
  const name = independent
    ? `Totem Skybridge — ${code.split("\n").slice(1).join(" ").trim()}`
    : primary;
  const conditionText = clean(v.X),
    physical = clean(v.AB);
  const conditionEvidence =
    clean(v.AC) || `${notes} ${conditionText} ${clean(v.W)}`;
  const damaged =
    /(rusak|perlu.*(?:maintenance|perbaikan|repaint|touch up)|minus tower|tidak lengkap)/i.test(
      conditionEvidence.replace(/tidak perlu maintenance/gi, ""),
    );
  const good =
    key(conditionText) === "baik" ||
    /kondisi bagus tidak perlu maintenance/i.test(v.AC ?? "");
  const notFound = ["tidak", "x"].includes(key(physical));
  const statusActive = key(v.W) === "aktif";
  const positivePhysical = ["tersedia", "√"].includes(physical.toLowerCase());
  const importedReady =
    !damaged &&
    !notFound &&
    good &&
    (statusActive || positivePhysical) &&
    !unknownLocation &&
    !!warehouse &&
    qty.quantity > 0 &&
    !!qty.unit &&
    !qty.conflict &&
    classification !== "UNCLASSIFIED";
  if (!source.photos.length)
    warnings.push("Tidak ada foto yang dapat diekstrak dari baris ini.");
  if (!good) warnings.push("Kondisi perlu pemeriksaan.");
  if (warehouse && (!warehouse.active || !warehouse.address_verified))
    warnings.push(
      "Warehouse master masih inactive atau alamat belum dikonfirmasi.",
    );
  const rowKey = source.sheet + ":" + source.row;
  const id =
    "xls-" + createHash("sha256").update(rowKey).digest("hex").slice(0, 24);
  const category = /booth/i.test(v.G ?? "")
    ? "Booth"
    : /display/i.test(v.G ?? "")
      ? "Display"
      : /posm/i.test(v.G ?? "")
        ? "POSM"
        : clean(v.G)
          ? "Supporting asset"
          : "Unclassified";
  if (!clean(v.G))
    warnings.push(
      "Kategori barang belum diisi; event/koleksi tidak dijadikan kategori barang.",
    );
  const brand = brandAliases[key(v.H)] ?? (clean(v.H) || "Belum diketahui");
  const event = source.sheet === "ALL BRAND (Gd.Internal)" ? clean(v.AA) : "";
  const record = {
    id,
    code: code || id,
    name,
    brand,
    category,
    classification,
    type: clean(v.G) || "Kategori belum diisi",
    location: warehouse
      ? `${warehouse.vendor} — ${warehouse.warehouse}`
      : locationLabel,
    locationType: isInternal
      ? "Internal warehouse"
      : v.M === "Eksternal"
        ? "Vendor warehouse"
        : "Other",
    warehouseId: warehouse?.warehouse_id,
    vendorId: warehouse?.vendor_id,
    availability:
      importedReady && warehouse?.active ? "available" : "unavailable",
    condition: good && !damaged ? "Good" : "Needs review",
    producedAt: "",
    ageLabel: "Belum diketahui",
    lastUsed: "Belum diketahui",
    lastUsedContext: event,
    description: notes || "Diimpor dari data monitoring asset.",
    artwork: category === "Booth" ? "pavilion" : "kit",
    tone: "teal",
    photos: source.photos.map((p, i) => ({
      id: `${id}-photo-${i}`,
      view: "Other",
      required: false,
      caption: `Foto sumber ${source.sheet} ${p.sourceCell}`,
      objectKey: p.key,
      mimeType: p.mimeType,
    })),
    issues: [],
    history: [
      {
        date: "2026-10-14",
        title: "Import data asset",
        detail: `${source.sheet}, baris ${source.row}`,
        kind: "Usage",
      },
    ],
    unitPolicy: qty.unit ? { stockUnit: qty.unit } : undefined,
    supportsQuantity: qty.quantity > 1,
    trackingType: qty.quantity > 1 ? "Quantity-based" : "Individual",
    totalQuantity: qty.quantity ?? undefined,
    availableQuantity: qty.quantity ?? 0,
    inspectionState:
      importedReady && warehouse?.active ? "Clear" : "Inspection pending",
    responsiblePic: clean(v.K),
    locationDetail: warehouse?.address ?? (isInternal ? clean(v.O) : ""),
    importInfo: {
      sheet: source.sheet,
      row: source.row,
      eventName: event || undefined,
      setupName: independent ? "Totem Skybridge" : undefined,
      trackingConfirmed: independent,
      sourceCategory: clean(v.G),
      sourceDate: clean(v.C),
      sourceQty: clean(v.P),
      sourceUnit: clean(v.Q),
      sourceBrand: clean(v.H),
      sourceCode: code,
      sourceStatus: clean(v.W),
      sourceCondition: conditionText,
      physicalConfirmation: physical,
      originalLocation: clean(v.N),
      resolvedLocation: locationLabel,
      notes,
      ownerName: clean(v.I),
      ownerEmail: clean(v.J),
      picEmail: clean(v.L),
      reference: clean(v.Y),
      unitValue: clean(v.U),
      sourceTotalValue: clean(v.V),
      warnings,
    },
  };
  return { record, warehouse, sourceKey: rowKey };
}
