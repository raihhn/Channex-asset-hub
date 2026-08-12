type AppHeaderProps = {
  workspaceName: string;
};

export function AppHeader({ workspaceName }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span aria-hidden="true" className="brand-mark">
          A
        </span>
        <span>AssetHub</span>
      </div>
      <div className="app-header__context">
        <span className="app-header__workspace">{workspaceName}</span>
        <button
          aria-label="Open secondary navigation"
          className="app-header__menu"
          type="button"
        >
          <span aria-hidden="true">•••</span>
        </button>
      </div>
    </header>
  );
}
