"use client";

import { localIdentityMessage } from "@/lib/actor-client";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button, Card, Chip, Input } from "@heroui/react";

import { AssetCard } from "@/components/domain/asset-card";
import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroSelect } from "@/components/shared/hero-select";
import { usePrototype } from "@/features/prototype/prototype-provider";
import {
  getAssetClassification,
  getAssetClassificationLabel,
} from "@/lib/domain/asset-governance";
import type { AssetAvailability, AssetClassification } from "@/types/prototype";

type Filters = {
  brand: string;
  category: string;
  location: string;
  availability: "" | AssetAvailability;
  classification: "" | AssetClassification;
};
const emptyFilters: Filters = {
  brand: "",
  category: "",
  location: "",
  availability: "",
  classification: "",
};
const availabilityFilters: Array<Filters["availability"]> = [
  "",
  "available",
  "reserved",
  "in-use",
  "maintenance",
];

export function AssetDiscoveryScreen({
  initialQuery = "",
}: {
  initialQuery?: string;
}) {
  const {
    catalogAssets: assets,
    assetLoading,
    assetError,
    currentUser,
    refreshLocalIdentity,
  } = usePrototype();
  const router = useRouter();
  const canRegister = currentUser.roles.some((role) =>
    ["SUPER_ADMIN", "STORE_DEV"].includes(role),
  );
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () =>
      assets.filter((asset) => {
        const terms =
          `${asset.assetNumber ?? ""} ${asset.legacyReference ?? ""} ${asset.importInfo?.sourceCode ?? ""} ${asset.code} ${asset.name} ${asset.brand} ${asset.category} ${asset.type} ${asset.location}`.toLowerCase();
        return (
          (!deferredQuery || terms.includes(deferredQuery.toLowerCase())) &&
          (!filters.brand || asset.brand === filters.brand) &&
          (!filters.category || asset.category === filters.category) &&
          (!filters.location || asset.location === filters.location) &&
          (!filters.availability ||
            asset.availability === filters.availability) &&
          (!filters.classification ||
            getAssetClassification(asset) === filters.classification)
        );
      }),
    [assets, deferredQuery, filters],
  );
  const criteria = JSON.stringify([deferredQuery, filters]);
  const [paging, setPaging] = useState({ criteria: "", count: 24 });
  const visibleCount = paging.criteria === criteria ? paging.count : 24;
  const activeFilters = Object.entries(filters).filter(([, value]) =>
    Boolean(value),
  );
  const brands = [...new Set(assets.map((asset) => asset.brand))];
  const locations = [...new Set(assets.map((asset) => asset.location))];
  const categories = [...new Set(assets.map((asset) => asset.category))];

  return (
    <AppShell pageLabel="Inventory">
      <div className="inventory-screen">
        <section className="inventory-screen__header">
          <div>
            <p>Asset inventory</p>
            <h1>Find the right asset.</h1>
            <span>
              Check existing inventory before starting a new production request.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canRegister ? (
              <Button
                variant="primary"
                onPress={() => router.push("/assets/new")}
              >
                <Plus size={17} aria-hidden="true" /> Add asset
              </Button>
            ) : null}
            <Button
              className="inventory-screen__filter-button"
              onPress={() => setShowAdvanced((value) => !value)}
              variant="secondary"
            >
              <SlidersHorizontal size={17} /> Filters{" "}
              {activeFilters.length ? `(${activeFilters.length})` : ""}
            </Button>
          </div>
        </section>
        <Card className="inventory-finder">
          <div className="inventory-finder__search">
            <Search size={18} />
            <Input
              className="min-w-0 flex-1"
              aria-label="Search assets"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search name, brand, category, or location"
              value={query}
            />
            {query ? (
              <Button
                aria-label="Clear search"
                isIconOnly
                onPress={() => setQuery("")}
                size="sm"
                variant="ghost"
              >
                <X size={16} />
              </Button>
            ) : null}
          </div>
          <div className="inventory-finder__quick-filters">
            {availabilityFilters.map((status) => (
              <Button
                className={filters.availability === status ? "is-selected" : ""}
                key={status || "all"}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    availability: status,
                  }))
                }
                size="sm"
                variant="ghost"
              >
                {status ? status.replace("-", " ") : "All availability"}
              </Button>
            ))}
          </div>
          {showAdvanced ? (
            <div className="inventory-finder__advanced">
              <FilterSelect
                label="Brand"
                onChange={(brand) =>
                  setFilters((current) => ({ ...current, brand }))
                }
                options={brands}
                value={filters.brand}
              />
              <FilterSelect
                label="Category"
                onChange={(category) =>
                  setFilters((current) => ({ ...current, category }))
                }
                options={categories}
                value={filters.category}
              />
              <FilterSelect
                label="Location"
                onChange={(location) =>
                  setFilters((current) => ({ ...current, location }))
                }
                options={locations}
                value={filters.location}
              />
              <HeroSelect
                label="Classification"
                onChange={(classification) =>
                  setFilters((current) => ({
                    ...current,
                    classification: classification as Filters["classification"],
                  }))
                }
                options={[
                  { label: "All classifications", value: "" },
                  { label: "Asset", value: "ASSET" },
                  { label: "Reusable Inventory", value: "INVENTORY" },
                  { label: "Unclassified", value: "UNCLASSIFIED" },
                ]}
                value={filters.classification}
              />
            </div>
          ) : null}
        </Card>
        <div className="inventory-screen__result-bar">
          <p>
            <strong>{results.length}</strong> assets matching your view
          </p>
          <div>
            {activeFilters.map(([key, value]) => (
              <Chip key={key} size="sm" variant="soft">
                {key === "classification"
                  ? getAssetClassificationLabel({
                      classification: value as AssetClassification,
                    })
                  : key}
                :{" "}
                {key === "classification"
                  ? getAssetClassificationLabel({
                      classification: value as AssetClassification,
                    })
                  : value}
              </Chip>
            ))}
            {activeFilters.length || query ? (
              <Button
                onPress={() => {
                  setFilters(emptyFilters);
                  setQuery("");
                }}
                size="sm"
                variant="ghost"
              >
                Clear all
              </Button>
            ) : null}
          </div>
        </div>
        {assetLoading ? (
          <p role="status">Loading asset database…</p>
        ) : assetError ? (
          <div role="alert" className="grid justify-items-start gap-3">
            <p>{localIdentityMessage(assetError)}</p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onPress={() => {
                  refreshLocalIdentity();
                  router.push("/me");
                }}
              >
                Select local identity
              </Button>
              <Button
                variant="tertiary"
                onPress={() => window.location.reload()}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : results.length ? (
          <div className="inventory-results">
            {results.slice(0, visibleCount).map((asset) => (
              <AssetCard asset={asset} key={asset.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            actionHref="/assets"
            actionLabel="Reset inventory view"
            detail="Try another asset name, location, or availability state."
            title="No assets match this view"
          />
        )}
        {results.length > visibleCount ? (
          <Button
            variant="secondary"
            onPress={() => setPaging({ criteria, count: visibleCount + 24 })}
          >
            Show more assets ({Math.min(visibleCount, results.length)} of{" "}
            {results.length})
          </Button>
        ) : null}
      </div>
    </AppShell>
  );
}

function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <HeroSelect
      label={label}
      onChange={onChange}
      options={[
        { label: `All ${label.toLowerCase()}s`, value: "" },
        ...options.map((option) => ({ label: option, value: option })),
      ]}
      value={value}
    />
  );
}
