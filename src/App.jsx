import { useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import { useLocalStorage } from "./hooks/useLocalStorage";
import InventoryPage from "./pages/InventoryPage";
import NewBatchPage from "./pages/NewBatchPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import {
  DEFAULT_BATCHES,
  DEFAULT_INGREDIENTS,
  DEFAULT_USERS
} from "./data/defaultData";
import { toNumber } from "./utils/format";
import { applyBatchRegistration } from "./utils/batchCalculations";
import { STORAGE_KEYS } from "./utils/storage";

const NAVIGATION_ITEMS = [
  { id: "inventory", label: "Inventario", icon: "I" },
  { id: "new-batch", label: "Nueva tanda", icon: "T" },
  { id: "users", label: "Usuarios", icon: "U" },
  { id: "reports", label: "Informes", icon: "R" }
];

function makeId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeIngredientPayload(payload) {
  return {
    name: payload.name.trim(),
    quantityAvailable: toNumber(payload.quantityAvailable),
    unit: payload.unit,
    pricePerUnit: toNumber(payload.pricePerUnit)
  };
}

function normalizeUserPayload(payload) {
  return {
    name: payload.name.trim(),
    contact: payload.contact.trim(),
    preferredFlavor: payload.preferredFlavor,
    wantsCookie: Boolean(payload.wantsCookie)
  };
}

export default function App() {
  const [ingredients, setIngredients] = useLocalStorage(
    STORAGE_KEYS.ingredients,
    DEFAULT_INGREDIENTS
  );
  const [batches, setBatches] = useLocalStorage(STORAGE_KEYS.batches, DEFAULT_BATCHES);
  const [users, setUsers] = useLocalStorage(STORAGE_KEYS.users, DEFAULT_USERS);

  const [activePage, setActivePage] = useState("inventory");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const pageTitle = useMemo(
    () => NAVIGATION_ITEMS.find((item) => item.id === activePage)?.label ?? "Inventario",
    [activePage]
  );

  const handleCreateIngredient = (payload) => {
    const normalized = normalizeIngredientPayload(payload);

    if (!normalized.name) {
      throw new Error("El ingrediente debe tener nombre.");
    }

    const exists = ingredients.some(
      (ingredient) => ingredient.name.toLowerCase() === normalized.name.toLowerCase()
    );

    if (exists) {
      throw new Error("Ya existe un ingrediente con ese nombre.");
    }

    setIngredients((previous) => [...previous, { ...normalized, id: makeId("ing") }]);
  };

  const handleUpdateIngredient = (ingredientId, payload) => {
    const normalized = normalizeIngredientPayload(payload);

    const exists = ingredients.some(
      (ingredient) =>
        ingredient.id !== ingredientId &&
        ingredient.name.toLowerCase() === normalized.name.toLowerCase()
    );

    if (exists) {
      throw new Error("Ya existe un ingrediente con ese nombre.");
    }

    setIngredients((previous) =>
      previous.map((ingredient) =>
        ingredient.id === ingredientId ? { ...ingredient, ...normalized } : ingredient
      )
    );
  };

  const handleDeleteIngredient = (ingredientId) => {
    setIngredients((previous) => previous.filter((ingredient) => ingredient.id !== ingredientId));
  };

  const handleAdjustIngredientStock = (ingredientId, nextStock) => {
    const normalizedStock = toNumber(nextStock);

    if (normalizedStock < 0) {
      throw new Error("El stock ajustado no puede ser negativo.");
    }

    setIngredients((previous) =>
      previous.map((ingredient) =>
        ingredient.id === ingredientId
          ? {
              ...ingredient,
              quantityAvailable: normalizedStock
            }
          : ingredient
      )
    );
  };

  const handleRegisterBatch = (draft) => {
    const { updatedIngredients, preview } = applyBatchRegistration(draft, ingredients);

    const batchRecord = {
      id: makeId("batch"),
      createdAt: new Date().toISOString(),
      producedDesserts: preview.producedDesserts,
      totalCost: preview.totalCost,
      unitCost: preview.unitCost,
      items: preview.items,
      assignedUserIds: []
    };

    setIngredients(updatedIngredients);
    setBatches((previous) => [batchRecord, ...previous]);
  };

  const handleCreateUser = (payload) => {
    const normalized = normalizeUserPayload(payload);

    if (!normalized.name || !normalized.contact) {
      throw new Error("Nombre y contacto son obligatorios.");
    }

    setUsers((previous) => [...previous, { ...normalized, id: makeId("usr") }]);
  };

  const handleDeleteUser = (userId) => {
    setUsers((previous) => previous.filter((user) => user.id !== userId));
    setBatches((previous) =>
      previous.map((batch) => ({
        ...batch,
        assignedUserIds: (batch.assignedUserIds || []).filter((assignedId) => assignedId !== userId)
      }))
    );
  };

  const handleAssociateUserToBatch = (batchId, userId) => {
    if (!userId) {
      throw new Error("Debes seleccionar un usuario.");
    }

    setBatches((previous) =>
      previous.map((batch) => {
        if (batch.id !== batchId) {
          return batch;
        }

        const currentAssigned = batch.assignedUserIds || [];

        if (currentAssigned.includes(userId)) {
          return batch;
        }

        return {
          ...batch,
          assignedUserIds: [...currentAssigned, userId]
        };
      })
    );
  };

  const currentPage = (() => {
    if (activePage === "inventory") {
      return (
        <InventoryPage
          ingredients={ingredients}
          onCreateIngredient={handleCreateIngredient}
          onUpdateIngredient={handleUpdateIngredient}
          onDeleteIngredient={handleDeleteIngredient}
          onAdjustIngredientStock={handleAdjustIngredientStock}
        />
      );
    }

    if (activePage === "new-batch") {
      return (
        <NewBatchPage
          ingredients={ingredients}
          onRegisterBatch={handleRegisterBatch}
          latestBatch={batches[0]}
        />
      );
    }

    if (activePage === "users") {
      return (
        <UsersPage
          users={users}
          onCreateUser={handleCreateUser}
          onDeleteUser={handleDeleteUser}
        />
      );
    }

    return (
      <ReportsPage
        batches={batches}
        users={users}
        onAssociateUserToBatch={handleAssociateUserToBatch}
      />
    );
  })();

  return (
    <div className="app-shell">
      <Sidebar
        navigationItems={NAVIGATION_ITEMS}
        activePage={activePage}
        onSelectPage={setActivePage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="content-shell">
        <header className="topbar">
          <button
            type="button"
            className="icon-button mobile-only"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            =
          </button>
          <div>
            <h1>{pageTitle}</h1>
            <p>Inventario, costos y clientes para postres cuchareables de 115g aprox.</p>
          </div>
        </header>

        <main className="page-content">{currentPage}</main>
      </div>
    </div>
  );
}
