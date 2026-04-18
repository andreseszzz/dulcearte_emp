import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import { useLocalStorage } from "./hooks/useLocalStorage";
import InventoryPage from "./pages/InventoryPage";
import MetricsClientsPage from "./pages/MetricsClientsPage";
import NewBatchPage from "./pages/NewBatchPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import {
  ASSIGNMENT_SELECTION_OPTIONS,
  DEFAULT_BATCHES,
  DEFAULT_INGREDIENTS,
  DEFAULT_USERS
} from "./data/defaultData";
import { toNumber } from "./utils/format";
import { applyBatchRegistration } from "./utils/batchCalculations";
import {
  convertInputPriceToUnitPrice,
  normalizePriceBasis
} from "./utils/ingredientPricing";
import {
  normalizeBatchesData,
  normalizeIngredientsData,
  normalizeUsersData,
  STORAGE_KEYS
} from "./utils/storage";

const DATA_MIGRATION_VERSION = "2026-04-18.v6";
const ASSIGNMENT_SELECTION_VALUES = new Set(
  ASSIGNMENT_SELECTION_OPTIONS.map((option) => option.value)
);

function normalizeAssignmentSelectionType(selectionType) {
  if (selectionType === "Galleta") {
    return "Solo galleta";
  }

  return ASSIGNMENT_SELECTION_VALUES.has(selectionType) ? selectionType : "Limon";
}

function mergeAssignmentsByUserAndSelection(entries) {
  const grouped = new Map();

  (entries || []).forEach((entry) => {
    const userId = String(entry?.userId || "").trim();
    if (!userId) {
      return;
    }

    const selectionType = normalizeAssignmentSelectionType(entry.selectionType);
    const dessertsSelected = Math.max(Math.floor(toNumber(entry.dessertsSelected)), 1);
    const key = `${userId}::${selectionType}`;
    const current = grouped.get(key) || {
      userId,
      selectionType,
      dessertsSelected: 0
    };

    grouped.set(key, {
      ...current,
      dessertsSelected: current.dessertsSelected + dessertsSelected
    });
  });

  return Array.from(grouped.values());
}

const NAVIGATION_ITEMS = [
  { id: "inventory", label: "Inventario", icon: "I", section: "Operacion" },
  { id: "new-batch", label: "Nueva tanda", icon: "T", section: "Operacion" },
  { id: "users", label: "Usuarios", icon: "U", section: "Operacion" },
  {
    id: "reports",
    label: "Informes",
    icon: "R",
    section: "Analitica",
    children: [{ id: "client-metrics", label: "Metricas Clientes", icon: "M" }]
  }
];

function findNavigationLabelById(items, targetId) {
  for (const item of items) {
    if (item.id === targetId) {
      return item.label;
    }

    const childLabel = findNavigationLabelById(item.children || [], targetId);
    if (childLabel) {
      return childLabel;
    }
  }

  return "";
}

function makeId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeIngredientPayload(payload) {
  const normalizedUnit = payload.unit;
  const normalizedPriceBasis = normalizePriceBasis(normalizedUnit, payload.priceBasis);
  const normalizedQuantity = toNumber(payload.quantityAvailable);
  const normalizedInputPrice = toNumber(payload.pricePerUnit);

  if (normalizedUnit === "g" && normalizedQuantity <= 0 && normalizedInputPrice > 0) {
    throw new Error("Para ingredientes en gramos, la cantidad disponible debe ser mayor a 0.");
  }

  return {
    name: payload.name.trim(),
    quantityAvailable: normalizedQuantity,
    unit: normalizedUnit,
    pricePerUnit: convertInputPriceToUnitPrice(
      normalizedInputPrice,
      normalizedUnit,
      normalizedPriceBasis,
      normalizedQuantity
    ),
    priceBasis: normalizedPriceBasis,
    affectsCookieCost: Boolean(payload.affectsCookieCost)
  };
}

function normalizeUserPayload(payload) {
  return {
    name: payload.name.trim(),
    contact: payload.contact.trim(),
    preferredFlavor: payload.preferredFlavor
  };
}

function hasDataChanged(previousValue, nextValue) {
  return JSON.stringify(previousValue) !== JSON.stringify(nextValue);
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const currentVersion = window.localStorage.getItem(STORAGE_KEYS.dataMigrationVersion);
      if (currentVersion === DATA_MIGRATION_VERSION) {
        return;
      }

      const normalizedIngredients = normalizeIngredientsData(ingredients, DEFAULT_INGREDIENTS);
      const normalizedUsers = normalizeUsersData(users, DEFAULT_USERS);
      const normalizedBatches = normalizeBatchesData(batches, DEFAULT_BATCHES);

      if (hasDataChanged(ingredients, normalizedIngredients)) {
        setIngredients(normalizedIngredients);
      }

      if (hasDataChanged(users, normalizedUsers)) {
        setUsers(normalizedUsers);
      }

      if (hasDataChanged(batches, normalizedBatches)) {
        setBatches(normalizedBatches);
      }

      window.localStorage.setItem(STORAGE_KEYS.dataMigrationVersion, DATA_MIGRATION_VERSION);
    } catch (error) {
      console.error("No se pudo completar la migracion inicial de datos.", error);
    }
  }, []);

  const pageTitle = useMemo(
    () => findNavigationLabelById(NAVIGATION_ITEMS, activePage) || "Inventario",
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

    const ingredientExists = ingredients.some((ingredient) => ingredient.id === ingredientId);
    if (!ingredientExists) {
      throw new Error("El ingrediente que intentas actualizar ya no existe.");
    }

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
      cookieCostTotal: preview.cookieCostTotal,
      cookieUnitCost: preview.cookieUnitCost,
      unitCost: preview.unitCost,
      items: preview.items,
      assignedUsers: []
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
        assignedUsers: (batch.assignedUsers || []).filter((entry) => entry.userId !== userId)
      }))
    );
  };

  const handleAssociateUserToBatch = (batchId, userId, dessertsSelected, selectionType) => {
    if (!userId) {
      throw new Error("Debes seleccionar un usuario.");
    }

    const normalizedDesserts = Math.max(Math.floor(toNumber(dessertsSelected)), 1);
    const normalizedSelectionType = normalizeAssignmentSelectionType(selectionType);

    const batchToUpdate = batches.find((batch) => batch.id === batchId);
    if (!batchToUpdate) {
      throw new Error("No se encontro la tanda seleccionada.");
    }

    const currentAssigned = batchToUpdate.assignedUsers || [];
    const alreadyAssignedUnits = currentAssigned
      .reduce((sum, entry) => {
        return sum + toNumber(entry.dessertsSelected);
      }, 0);

    const projectedAssignedUnits = alreadyAssignedUnits + normalizedDesserts;

    if (projectedAssignedUnits > toNumber(batchToUpdate.producedDesserts)) {
      throw new Error("La suma de selecciones supera las unidades producidas en la tanda.");
    }

    setBatches((previous) =>
      previous.map((batch) => {
        if (batch.id !== batchId) {
          return batch;
        }

        const entries = batch.assignedUsers || [];

        const existingSelectionIndex = entries.findIndex(
          (entry) =>
            entry.userId === userId &&
            normalizeAssignmentSelectionType(entry.selectionType) === normalizedSelectionType
        );

        if (existingSelectionIndex >= 0) {
          return {
            ...batch,
            assignedUsers: entries.map((entry, index) => {
              if (index !== existingSelectionIndex) {
                return entry;
              }

              return {
                ...entry,
                dessertsSelected: toNumber(entry.dessertsSelected) + normalizedDesserts,
                selectionType: normalizedSelectionType
              };
            })
          };
        }

        return {
          ...batch,
          assignedUsers: [
            ...entries,
            {
              userId,
              dessertsSelected: normalizedDesserts,
              selectionType: normalizedSelectionType
            }
          ]
        };
      })
    );
  };

  const handleUpdateBatchAssignment = (
    batchId,
    assignmentIndex,
    dessertsSelected,
    selectionType
  ) => {
    const normalizedIndex = Math.floor(toNumber(assignmentIndex));
    const normalizedDesserts = Math.max(Math.floor(toNumber(dessertsSelected)), 1);
    const normalizedSelectionType = normalizeAssignmentSelectionType(selectionType);

    const batchToUpdate = batches.find((batch) => batch.id === batchId);
    if (!batchToUpdate) {
      throw new Error("No se encontro la tanda seleccionada.");
    }

    const currentAssigned = batchToUpdate.assignedUsers || [];
    if (normalizedIndex < 0 || normalizedIndex >= currentAssigned.length) {
      throw new Error("No se encontro la asignacion que intentas editar.");
    }

    const updatedEntries = currentAssigned.map((entry, index) =>
      index === normalizedIndex
        ? {
            ...entry,
            dessertsSelected: normalizedDesserts,
            selectionType: normalizedSelectionType
          }
        : entry
    );

    const mergedEntries = mergeAssignmentsByUserAndSelection(updatedEntries);
    const projectedAssignedUnits = mergedEntries.reduce(
      (sum, entry) => sum + toNumber(entry.dessertsSelected),
      0
    );

    if (projectedAssignedUnits > toNumber(batchToUpdate.producedDesserts)) {
      throw new Error("La suma de selecciones supera las unidades producidas en la tanda.");
    }

    setBatches((previous) =>
      previous.map((batch) =>
        batch.id === batchId
          ? {
              ...batch,
              assignedUsers: mergedEntries
            }
          : batch
      )
    );
  };

  const handleDeleteBatchAssignment = (batchId, assignmentIndex) => {
    const normalizedIndex = Math.floor(toNumber(assignmentIndex));

    const batchToUpdate = batches.find((batch) => batch.id === batchId);
    if (!batchToUpdate) {
      throw new Error("No se encontro la tanda seleccionada.");
    }

    const currentAssigned = batchToUpdate.assignedUsers || [];
    if (normalizedIndex < 0 || normalizedIndex >= currentAssigned.length) {
      throw new Error("No se encontro la asignacion que intentas eliminar.");
    }

    const nextEntries = currentAssigned.filter((_, index) => index !== normalizedIndex);

    setBatches((previous) =>
      previous.map((batch) =>
        batch.id === batchId
          ? {
              ...batch,
              assignedUsers: nextEntries
            }
          : batch
      )
    );
  };

  const handleDeleteBatch = (batchId) => {
    const batchExists = batches.some((batch) => batch.id === batchId);
    if (!batchExists) {
      throw new Error("No se encontro la tanda que intentas eliminar.");
    }

    setBatches((previous) => previous.filter((batch) => batch.id !== batchId));
  };

  const handleRestoreBatch = (batchToRestore, preferredIndex = 0) => {
    if (!batchToRestore || !batchToRestore.id) {
      throw new Error("No se pudo restaurar la tanda eliminada.");
    }

    const normalizedIndex = Math.max(Math.floor(toNumber(preferredIndex)), 0);

    setBatches((previous) => {
      if (previous.some((batch) => batch.id === batchToRestore.id)) {
        return previous;
      }

      const next = [...previous];
      const safeIndex = Math.min(normalizedIndex, next.length);
      next.splice(safeIndex, 0, batchToRestore);
      return next;
    });
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

    if (activePage === "client-metrics") {
      return <MetricsClientsPage batches={batches} users={users} />;
    }

    return (
      <ReportsPage
        batches={batches}
        users={users}
        onAssociateUserToBatch={handleAssociateUserToBatch}
        onUpdateBatchAssignment={handleUpdateBatchAssignment}
        onDeleteBatchAssignment={handleDeleteBatchAssignment}
        onDeleteBatch={handleDeleteBatch}
        onRestoreBatch={handleRestoreBatch}
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
            <p>Inventario, costos y clientes para postres cuchareables.</p>
          </div>
        </header>

        <main className="page-content">{currentPage}</main>
      </div>
    </div>
  );
}
