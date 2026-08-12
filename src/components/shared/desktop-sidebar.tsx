import {
  desktopSecondaryNavigation,
  primaryNavigation,
} from "@/lib/constants/navigation";

export function DesktopSidebar() {
  return (
    <aside className="desktop-sidebar" aria-label="Desktop navigation">
      <div className="desktop-sidebar__brand">
        <span aria-hidden="true" className="brand-mark">
          A
        </span>
        AssetHub
      </div>
      <nav aria-label="Primary navigation">
        <p className="nav-label">Workspace</p>
        <ul className="navigation-list">
          {primaryNavigation.map((item, index) => (
            <li className={index === 0 ? "is-active" : ""} key={item.area}>
              {item.label}
            </li>
          ))}
        </ul>
        <p className="nav-label">Secondary</p>
        <ul className="navigation-list navigation-list--secondary">
          {desktopSecondaryNavigation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </nav>
      <p className="desktop-sidebar__note">Foundation navigation only</p>
    </aside>
  );
}
