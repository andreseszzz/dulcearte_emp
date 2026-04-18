const BRAND_TITLE = "DulceArte";
const BRAND_SUBTITLE = "Control de produccion";

export default function Sidebar({
  navigationItems,
  activePage,
  onSelectPage,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile
}) {
  return (
    <>
      <aside
        className={[
          "sidebar",
          isCollapsed ? "collapsed" : "",
          isMobileOpen ? "mobile-open" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="sidebar-header">
          <div className="brand-block">
            <h2>{BRAND_TITLE}</h2>
            {!isCollapsed && <p>{BRAND_SUBTITLE}</p>}
          </div>
          <button
            type="button"
            className="icon-button desktop-only"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {isCollapsed ? ">" : "<"}
          </button>
          <button
            type="button"
            className="icon-button mobile-only"
            onClick={onCloseMobile}
            aria-label="Cerrar menu"
          >
            x
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegacion principal">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => {
                onSelectPage(item.id);
                onCloseMobile();
              }}
              title={item.label}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </aside>
      {isMobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
    </>
  );
}
