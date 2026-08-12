import { primaryNavigation } from "@/lib/constants/navigation";

export function MobileBottomNav() {
  return (
    <nav aria-label="Mobile primary navigation" className="mobile-bottom-nav">
      {primaryNavigation.map((item, index) => (
        <span
          aria-current={index === 0 ? "page" : undefined}
          className={index === 0 ? "is-active" : ""}
          key={item.area}
        >
          <span aria-hidden="true" className="mobile-bottom-nav__icon">
            {index + 1}
          </span>
          {item.label}
        </span>
      ))}
      <button
        aria-label="Open secondary navigation"
        className="mobile-bottom-nav__more"
        type="button"
      >
        More
      </button>
    </nav>
  );
}
