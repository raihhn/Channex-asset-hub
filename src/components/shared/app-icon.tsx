import type { SVGProps } from "react";
import {
  House,
  Boxes,
  Plus,
  ClipboardList,
  User,
  Search,
  MapPin,
  Clock,
  ShieldCheck,
  TriangleAlert,
  Images,
  ChevronLeft,
  ChevronRight,
  Camera,
  Building2,
  Truck,
  Package,
} from "lucide-react";

const icons = {
  home: House,
  assets: Boxes,
  plus: Plus,
  requests: ClipboardList,
  user: User,
  search: Search,
  location: MapPin,
  clock: Clock,
  condition: ShieldCheck,
  issue: TriangleAlert,
  images: Images,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  camera: Camera,
  destination: Building2,
  delivery: Truck,
  pickup: Package,
} as const;
export type AppIconName = keyof typeof icons;

export function AppIcon({
  name,
  title,
  ...props
}: SVGProps<SVGSVGElement> & { name: AppIconName; title?: string }) {
  const Icon = icons[name];
  return (
    <Icon
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className="app-icon"
      size={20}
      strokeWidth={1.8}
      {...props}
    />
  );
}
