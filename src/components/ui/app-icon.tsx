import type { ReactElement, SVGProps } from "react";

export type AppIconName =
  | "home"
  | "assets"
  | "plus"
  | "requests"
  | "user"
  | "search"
  | "location"
  | "clock"
  | "condition"
  | "issue"
  | "images"
  | "chevron-left"
  | "chevron-right"
  | "camera"
  | "destination"
  | "delivery"
  | "pickup";

const paths: Record<AppIconName, ReactElement> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  assets: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4.5 7.5 7.5 4 7.5-4M12 11.5V21" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  requests: (
    <>
      <rect height="17" rx="2" width="14" x="5" y="4" />
      <path d="M9 4v-2M15 4v-2M8 10h8M8 14h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  condition: (
    <>
      <path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  issue: (
    <>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  images: (
    <>
      <rect height="14" rx="2" width="17" x="3" y="5" />
      <circle cx="8" cy="10" r="1.5" />
      <path d="m4 17 4.5-4 3 2 2.5-2 5 4" />
    </>
  ),
  "chevron-left": <path d="m14.5 5-7 7 7 7" />,
  "chevron-right": <path d="m9.5 5 7 7-7 7" />,
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1-1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="14" r="3.5" />
    </>
  ),
  destination: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8M8 13h5M12 19v2" />
    </>
  ),
  delivery: (
    <>
      <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  pickup: (
    <>
      <path d="M4 10h16v10H4zM7 10V6h10v4M8 14h8" />
    </>
  ),
};

export function AppIcon({
  name,
  title,
  ...props
}: SVGProps<SVGSVGElement> & { name: AppIconName; title?: string }) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className="app-icon"
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="20"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
