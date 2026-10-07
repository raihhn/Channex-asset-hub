"use client";

import { Label, ListBox, Select } from "@heroui/react";

type Option = { label: string; value: string };

export function HeroSelect({
  label,
  options,
  placeholder = "Select an option",
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      className="hero-select"
      onChange={(key) => onChange(String(key ?? ""))}
      placeholder={placeholder}
      value={value || null}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value className="text-foreground" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item id={option.value} key={option.value}>
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
