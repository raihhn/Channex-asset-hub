"use client";

import { useState } from "react";
import {
  Autocomplete,
  Select,
  Label,
  ListBox,
  SearchField,
  useFilter,
} from "@heroui/react";

type Option = { label: string; value: string };

/** Search belongs to the popup; only a registered option changes the value. */
export function HeroSelect({
  label,
  options,
  placeholder = "Search and select…",
  value,
  onChange,
  variant = "primary",
  isDisabled = false,
}: {
  variant?: "primary" | "secondary";
  isDisabled?: boolean;
  label: string;
  options: Option[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <Select
      className="hero-select w-full min-w-0"
      variant={variant}
      isDisabled={isDisabled}
      selectionMode="single"
      onOpenChange={() => setQuery("")}
      value={options.some((option) => option.value === value) ? value : null}
      onChange={(key) => {
        if (key !== null && !Array.isArray(key)) onChange(String(key));
      }}
      placeholder={placeholder}
    >
      <Label>{label}</Label>
      <Select.Trigger className="min-h-11 w-full min-w-0 items-center">
        <Select.Value className="text-foreground min-w-0 truncate font-normal" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <Autocomplete.Filter
          inputValue={query}
          onInputChange={setQuery}
          filter={(text, query) =>
            query
              .trim()
              .split(/\s+/)
              .every((term) => contains(text, term))
          }
        >
          <SearchField
            value={query}
            onChange={setQuery}
            className="px-3 py-2"
            autoFocus
            aria-label={`Search ${label}`}
            variant="primary"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder={`Search ${label.toLowerCase()}…`}
              />
              <SearchField.ClearButton aria-label={`Clear ${label} search`} />
            </SearchField.Group>
          </SearchField>
          <ListBox
            renderEmptyState={() => (
              <p className="text-muted p-4 text-sm">
                No matches. Try another search.
              </p>
            )}
          >
            {options.map((option) => (
              <ListBox.Item
                id={option.value}
                key={option.value}
                textValue={option.label}
              >
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Select.Popover>
    </Select>
  );
}
