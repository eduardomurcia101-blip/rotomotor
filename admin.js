const loginForm = document.querySelector("#admin-login-form");
const inventoryPanel = document.querySelector("#inventory-panel");
const message = document.querySelector("#admin-message");
const inventoryRows = document.querySelector("#inventory-rows");
const inventorySearch = document.querySelector("#inventory-search");
const products = new Map();
const stockUpdatesKey = "rutamotor-stock-actualizado";

function showMessage(text, kind = "error") {
  message.textContent = text;
  message.className = `admin-message ${kind}`;
  message.hidden = !text;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "No se pudo completar la solicitud.");
  }
  return result;
}

function renderProducts() {
  const searchTerm = inventorySearch.value.trim().toLocaleLowerCase("es");
  inventoryRows.replaceChildren();

  for (const product of products.values()) {
    const searchableText = `${product.nombre} ${product.categoria}`.toLocaleLowerCase("es");
    if (!searchableText.includes(searchTerm)) continue;

    const row = document.createElement("tr");
    row.dataset.productId = String(product.id);

    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    nameCell.className = "inventory-product-name";
    nameCell.textContent = product.nombre;

    const categoryCell = document.createElement("td");
    categoryCell.textContent = product.categoria;

    const stockCell = document.createElement("td");
    const stockInput = document.createElement("input");
    stockInput.className = "inventory-stock-input";
    stockInput.type = "number";
    stockInput.min = "0";
    stockInput.max = "2147483647";
    stockInput.step = "1";
    stockInput.value = String(product.stock);
    stockInput.dataset.savedStock = String(product.stock);
    stockInput.setAttribute("aria-label", `Stock de ${product.nombre}`);
    stockCell.append(stockInput);
    const stockNote = document.createElement("small");
    stockNote.className = "inventory-current-stock";
    stockNote.textContent = `Actual en base de datos: ${product.stock}`;
    stockCell.append(stockNote);

    const actionCell = document.createElement("td");
    const saveButton = document.createElement("button");
    saveButton.className = "admin-save-button";
    saveButton.type = "button";
    saveButton.dataset.saveStock = String(product.id);
    saveButton.textContent = "Guardar";
    actionCell.append(saveButton);

    row.append(nameCell, categoryCell, stockCell, actionCell);
    inventoryRows.append(row);
  }
}

async function loadInventory() {
  const result = await apiRequest("/api/admin/productos");
  const previousProducts = new Map(products);
  products.clear();
  result.forEach((product) => products.set(Number(product.id), product));

  if (inventoryRows.children.length === 0) {
    renderProducts();
    return;
  }

  for (const product of result) {
    const row = inventoryRows.querySelector(`[data-product-id="${Number(product.id)}"]`);
    if (!row) continue;

    const stockInput = row.querySelector(".inventory-stock-input");
    const stockNote = row.querySelector(".inventory-current-stock");
    const previousStock = previousProducts.get(Number(product.id))?.stock;
    stockNote.textContent = `Actual en base de datos: ${product.stock}`;

    if (String(stockInput.value) === String(previousStock ?? stockInput.dataset.savedStock)) {
      stockInput.value = String(product.stock);
    }
    stockInput.dataset.savedStock = String(product.stock);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  showMessage("");

  try {
    await apiRequest("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: loginForm.elements.username.value,
        password: loginForm.elements.password.value
      })
    });
    loginForm.reset();
    loginForm.hidden = true;
    inventoryPanel.hidden = false;
    await loadInventory();
    showMessage("Sesión iniciada. Puedes actualizar las existencias.", "success");
  } catch (error) {
    showMessage(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#admin-logout").addEventListener("click", async () => {
  try {
    await apiRequest("/api/admin/logout", { method: "POST" });
    products.clear();
    inventoryRows.replaceChildren();
    inventoryPanel.hidden = true;
    loginForm.hidden = false;
    showMessage("Sesión cerrada correctamente.", "success");
  } catch (error) {
    showMessage(error.message);
  }
});

inventoryRows.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-stock]");
  if (!button) return;

  const row = button.closest("tr");
  const stockInput = row.querySelector(".inventory-stock-input");
  const stock = Number(stockInput.value);
  if (!Number.isSafeInteger(stock) || stock < 0 || stock > 2147483647) {
    showMessage("El stock debe ser un número entero válido igual o mayor que cero.");
    stockInput.focus();
    return;
  }

  button.disabled = true;
  showMessage("");
  try {
    const product = await apiRequest(`/api/admin/productos/${button.dataset.saveStock}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock })
    });
    products.set(Number(product.id), product);
    stockInput.value = String(product.stock);
    stockInput.dataset.savedStock = String(product.stock);
    row.querySelector(".inventory-current-stock").textContent = `Actual en base de datos: ${product.stock}`;
    try {
      localStorage.setItem(stockUpdatesKey, JSON.stringify({ at: Date.now() }));
    } catch (storageError) {
      console.error("No se pudo notificar el cambio de inventario a otras páginas:", storageError);
    }
    showMessage(`Stock actualizado para ${product.nombre}.`, "success");
  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
  }
});

inventorySearch.addEventListener("input", renderProducts);
window.addEventListener("focus", () => {
  if (!inventoryPanel.hidden) loadInventory().catch((error) => showMessage(error.message));
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !inventoryPanel.hidden) {
    loadInventory().catch((error) => showMessage(error.message));
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === stockUpdatesKey && !inventoryPanel.hidden) {
    loadInventory().catch((error) => showMessage(error.message));
  }
});
window.setInterval(() => {
  if (document.visibilityState === "visible" && !inventoryPanel.hidden) {
    loadInventory().catch((error) => showMessage(error.message));
  }
}, 10000);

async function initializeAdmin() {
  try {
    const session = await apiRequest("/api/admin/session");
    if (!session.configured) {
      showMessage("No hay cuentas administrativas en la tabla admin de la base de datos.");
      return;
    }

    if (session.authenticated) {
      loginForm.hidden = true;
      inventoryPanel.hidden = false;
      await loadInventory();
      return;
    }

    loginForm.hidden = false;
  } catch (error) {
    showMessage(error.message);
  }
}

initializeAdmin();
