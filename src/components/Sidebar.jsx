import { useMemo } from "react";

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
  const navigationSections = useMemo(() => {
    const grouped = [];
    const sectionIndexMap = new Map();

    navigationItems.forEach((item) => {
      const sectionName = String(item.section || "General");
      const existingIndex = sectionIndexMap.get(sectionName);

      if (existingIndex === undefined) {
        sectionIndexMap.set(sectionName, grouped.length);
        grouped.push({ title: sectionName, items: [item] });
        return;
      }

      grouped[existingIndex].items.push(item);
    });

    return grouped;
  }, [navigationItems]);

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
        <div className={`sidebar-header ${isCollapsed ? "collapsed" : ""}`}>
          {!isCollapsed ? (
            <div className="brand-block">
              <h2>{BRAND_TITLE}</h2>
              <p>{BRAND_SUBTITLE}</p>
            </div>
          ) : null}

          <div className="sidebar-header-actions">
            <button
              type="button"
              className="icon-button desktop-only sidebar-collapse-toggle"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
              title={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
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
        </div>

        {!isCollapsed ? (
          <div className="sidebar-workspace" aria-label="Espacio de trabajo">
            <span className="workspace-badge" aria-hidden="true">
              DA
            </span>
            <div className="workspace-meta">
              <strong>Espacio de trabajo</strong>
              <small>{BRAND_TITLE}</small>
            </div>
          </div>
        ) : null}

        <nav className="sidebar-nav" aria-label="Navegacion principal">
          {navigationSections.map((section) => (
            <div key={section.title} className="nav-section">
              {!isCollapsed ? <p className="nav-section-title">{section.title}</p> : null}

              {section.items.map((item) => {
                const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                const isParentExactActive = activePage === item.id;
                const isChildActive =
                  hasChildren && item.children.some((child) => child.id === activePage);

                return (
                  <div key={item.id} className="nav-group">
                    <button
                      type="button"
                      className={`nav-item ${isParentExactActive ? "active" : ""} ${isChildActive ? "branch-active" : ""}`}
                      onClick={() => {
                        onSelectPage(item.id);
                        onCloseMobile();
                      }}
                      title={item.label}
                      aria-current={isParentExactActive ? "page" : undefined}
                    >
                      <span className="nav-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      {!isCollapsed && <span>{item.label}</span>}
                    </button>

                    {!isCollapsed && hasChildren ? (
                      <div className="nav-subitems">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            className={`nav-item nav-subitem ${activePage === child.id ? "active" : ""}`}
                            onClick={() => {
                              onSelectPage(child.id);
                              onCloseMobile();
                            }}
                            title={child.label}
                            aria-current={activePage === child.id ? "page" : undefined}
                          >
                            <span className="nav-icon" aria-hidden="true">
                              {child.icon}
                            </span>
                            <span>{child.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      {isMobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
    </>
  );
}
