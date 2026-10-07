import { Input } from "@/components/ui/input";
import { AppIcon } from "@/components/ui/app-icon";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchField({
  value,
  onChange,
  placeholder = "Search assets",
}: SearchFieldProps) {
  return (
    <label className="search-field">
      <span aria-hidden="true">
        <AppIcon name="search" />
      </span>
      <Input
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}
