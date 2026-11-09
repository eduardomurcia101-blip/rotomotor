const catalogGrid = document.querySelector(".catalog-grid");
const featuredGrid = document.querySelector("#productos .product-grid");
const productGrid = catalogGrid || featuredGrid;

if (productGrid) {
  const isCatalog = Boolean(catalogGrid);
  const originalCards = Array.from(productGrid.querySelectorAll(".product-card"));
  const imageByName = new Map(originalCards.map((card) => [
    card.dataset.name || card.querySelector("h3").textContent.trim(),
    card.querySelector(".product-art")?.getAttribute("src")
  ]));
  const fallbackImage = "assets/productos/placeholder.svg";
  const currencyFormatter = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0
  });
  const productsById = new Map();
  const cartKey = "rutamotor-carrito";
  const stockUpdatesKey = "rutamotor-stock-actualizado";
  const cart = readCart();
  const cartLink = document.querySelector("[data-cart-open]");
  const cartDialog = document.createElement("dialog");
  cartDialog.className = "cart-dialog";
  cartDialog.setAttribute("aria-labelledby", "cart-title");
  cartDialog.innerHTML = `
    <div class="cart-dialog-header">
      <h2 id="cart-title">Tu carrito</h2>
      <button class="cart-close" type="button" aria-label="Cerrar carrito">&times;</button>
    </div>
    <p class="cart-status" role="alert" hidden></p>
    <div class="cart-items"></div>
    <div class="cart-dialog-footer">
      <p class="cart-total">Total: <strong></strong></p>
      <button class="checkout-button" type="button">Confirmar compra</button>
    </div>
  `;
  document.body.append(cartDialog);

  const cartItems = cartDialog.querySelector(".cart-items");
  const cartStatus = cartDialog.querySelector(".cart-status");
  const cartTotal = cartDialog.querySelector(".cart-total strong");
  const checkoutButton = cartDialog.querySelector(".checkout-button");
  const cartToast = document.createElement("p");
  cartToast.className = "cart-toast";
  cartToast.setAttribute("role", "status");
  cartToast.setAttribute("aria-live", "polite");
  document.body.append(cartToast);

  function readCart() {
    try {
      const savedCart = JSON.parse(localStorage.getItem("rutamotor-carrito") || "[]");
      if (!Array.isArray(savedCart)) {
        throw new Error("El formato guardado no es una lista.");
      }

      return new Map(savedCart
        .filter((item) => Number.isSafeInteger(item.id) && Number.isSafeInteger(item.quantity) && item.quantity > 0)
        .map((item) => [item.id, item.quantity]));
    } catch (error) {
      console.error("No se pudo recuperar el carrito guardado:", error);
      return new Map();
    }
  }

  function saveCart() {
    localStorage.setItem(cartKey, JSON.stringify(
      Array.from(cart, ([id, quantity]) => ({ id, quantity }))
    ));
  }

  function updateCartCount() {
    const quantity = Array.from(cart.values()).reduce((sum, itemQuantity) => sum + itemQuantity, 0);
    cartLink.textContent = `🛒 Carrito (${quantity})`;
    cartLink.setAttribute("aria-label", `Ver carrito, ${quantity} ${quantity === 1 ? "producto" : "productos"}`);
  }

  function showCartStatus(message) {
    cartStatus.textContent = message;
    cartStatus.hidden = !message;
  }

  function showToast(message) {
    cartToast.textContent = message;
    cartToast.classList.add("visible");
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => cartToast.classList.remove("visible"), 2400);
  }

  function renderCart() {
    cartItems.replaceChildren();
    let total = 0;
    let lineCount = 0;

    cart.forEach((quantity, id) => {
      const product = productsById.get(id);
      if (!product) return;

      const subtotal = Number(product.precio_cop) * quantity;
      total += subtotal;
      lineCount += 1;

      const row = document.createElement("article");
      row.className = "cart-item";
      const details = document.createElement("div");
      details.className = "cart-item-details";
      const name = document.createElement("h3");
      name.textContent = product.nombre;
      const price = document.createElement("p");
      price.textContent = `$${currencyFormatter.format(Number(product.precio_cop))} c/u`;
      details.append(name, price);

      const controls = document.createElement("div");
      controls.className = "cart-item-controls";
      const decrease = document.createElement("button");
      decrease.type = "button";
      decrease.dataset.cartAction = "decrease";
      decrease.dataset.productId = String(id);
      decrease.setAttribute("aria-label", `Quitar una unidad de ${product.nombre}`);
      decrease.textContent = "−";
      const amount = document.createElement("span");
      amount.textContent = String(quantity);
      const increase = document.createElement("button");
      increase.type = "button";
      increase.dataset.cartAction = "increase";
      increase.dataset.productId = String(id);
      increase.setAttribute("aria-label", `Agregar una unidad de ${product.nombre}`);
      increase.textContent = "+";
      increase.disabled = quantity >= Number(product.stock);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart-remove";
      remove.dataset.cartAction = "remove";
      remove.dataset.productId = String(id);
      remove.textContent = "Eliminar";
      controls.append(decrease, amount, increase, remove);

      const lineTotal = document.createElement("strong");
      lineTotal.className = "cart-line-total";
      lineTotal.textContent = `$${currencyFormatter.format(subtotal)}`;
      row.append(details, controls, lineTotal);
      cartItems.append(row);
    });

    if (lineCount === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "cart-empty";
      emptyMessage.textContent = "Tu carrito está vacío.";
      cartItems.append(emptyMessage);
    }

    cartTotal.textContent = `$${currencyFormatter.format(total)}`;
    checkoutButton.disabled = lineCount === 0;
    updateCartCount();
  }

  function updateProductCards() {
    productGrid.querySelectorAll(".product-card[data-product-id]").forEach((card) => {
      const product = productsById.get(Number(card.dataset.productId));
      if (!product) return;

      const stock = Number(product.stock);
      card.dataset.stock = String(stock);
      const stockLabel = card.querySelector(".product-stock");
      if (stockLabel) {
        stockLabel.textContent = `Disponibles: ${stock} unidades`;
      }

      const addButton = card.querySelector(".add-button");
      if (addButton) {
        addButton.disabled = stock <= 0;
        addButton.textContent = stock > 0 ? "Agregar" : "Agotado";
      }
    });
  }

  function notifyStockChanged(inventory) {
    try {
      localStorage.setItem(stockUpdatesKey, JSON.stringify({
        at: Date.now(),
        inventory
      }));
    } catch (error) {
      console.error("No se pudo notificar el cambio de inventario a otras páginas:", error);
    }
  }

  function addToCart(product, button) {
    const currentQuantity = cart.get(Number(product.id)) || 0;
    if (currentQuantity >= Number(product.stock)) {
      showToast(`No hay más unidades disponibles de ${product.nombre}.`);
      return;
    }

    cart.set(Number(product.id), currentQuantity + 1);
    saveCart();
    renderCart();
    showToast(`${product.nombre} se agregó al carrito.`);
    button.textContent = "Agregado";
    window.setTimeout(() => {
      if (button.isConnected) button.textContent = "Agregar";
    }, 900);
  }

  function showReceipt(receipt) {
    const page = document.createElement("main");
    page.className = "receipt-page";
    const article = document.createElement("article");
    article.className = "receipt";
    const brand = document.createElement("p");
    brand.className = "receipt-brand";
    brand.textContent = "RUTA MOTOR";
    const title = document.createElement("h1");
    title.textContent = "Recibo de compra";
    const success = document.createElement("p");
    success.className = "receipt-success";
    success.textContent = "Compra confirmada";
    const metadata = document.createElement("dl");
    metadata.className = "receipt-metadata";

    for (const [label, value] of [
      ["Recibo", receipt.numero],
      ["Fecha", new Date(receipt.fecha).toLocaleString("es-CO")]
    ]) {
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.textContent = value;
      metadata.append(term, detail);
    }

    const items = document.createElement("div");
    items.className = "receipt-items";
    receipt.productos.forEach((product) => {
      const row = document.createElement("div");
      row.className = "receipt-item";
      const description = document.createElement("span");
      description.textContent = `${product.nombre} × ${product.cantidad}`;
      const subtotal = document.createElement("strong");
      subtotal.textContent = `$${currencyFormatter.format(Number(product.subtotal_cop))}`;
      row.append(description, subtotal);
      items.append(row);
    });

    const total = document.createElement("p");
    total.className = "receipt-total";
    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Total pagado";
    const totalAmount = document.createElement("strong");
    totalAmount.textContent = `$${currencyFormatter.format(Number(receipt.total_cop))}`;
    total.append(totalLabel, totalAmount);
    const homeLink = document.createElement("a");
    homeLink.className = "receipt-home-button";
    homeLink.href = "index.html";
    homeLink.textContent = "Volver al inicio";
    article.append(brand, title, success, metadata, items, total, homeLink);
    page.append(article);
    cart.clear();
    localStorage.removeItem(cartKey);
    document.body.classList.add("receipt-only");
    document.body.replaceChildren(page);
  }

  cartLink.addEventListener("click", (event) => {
    event.preventDefault();
    showCartStatus("");
    renderCart();
    cartDialog.showModal();
  });
  cartDialog.querySelector(".cart-close").addEventListener("click", () => cartDialog.close());
  cartDialog.addEventListener("click", (event) => {
    if (event.target === cartDialog) cartDialog.close();
  });
  cartItems.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;

    const id = Number(button.dataset.productId);
    const quantity = cart.get(id) || 0;
    if (button.dataset.cartAction === "remove" || (button.dataset.cartAction === "decrease" && quantity <= 1)) {
      cart.delete(id);
    } else if (button.dataset.cartAction === "decrease") {
      cart.set(id, quantity - 1);
    } else if (button.dataset.cartAction === "increase") {
      const product = productsById.get(id);
      if (product && quantity < Number(product.stock)) cart.set(id, quantity + 1);
    }
    saveCart();
    renderCart();
    showCartStatus("");
  });
  checkoutButton.addEventListener("click", async () => {
    checkoutButton.disabled = true;
    checkoutButton.textContent = "Procesando compra…";
    showCartStatus("");

    try {
      const response = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Array.from(cart, ([id, quantity]) => ({ id, quantity }))
        })
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await loadProducts();
        throw new Error(result.error || "No se pudo confirmar la compra.");
      }
      if (Array.isArray(result.inventario)) {
        notifyStockChanged(result.inventario);
        await loadProducts();
      }
      showReceipt(result);
    } catch (error) {
      console.error("No se pudo confirmar la compra:", error);
      showCartStatus(error.message);
      checkoutButton.disabled = false;
      checkoutButton.textContent = "Confirmar compra";
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".add-button");
    if (!button) return;

    const card = button.closest(".product-card");
    const product = productsById.get(Number(card?.dataset.productId));
    if (product) addToCart(product, button);
  });

  function normalizedCategory(value) {
    const normalized = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .trim();

    if (normalized.includes("bateria")) return "baterias";
    if (normalized.includes("motor") || normalized.includes("filtro")) return "motor-filtros";
    if (normalized.includes("llanta") || normalized.includes("rueda")) return "llantas-ruedas";
    if (normalized.includes("iluminacion") || normalized.includes("luz")) return "iluminacion";
    return normalized.replace(/\s+/g, "-");
  }

  function displayCategory(value, category) {
    const labels = {
      baterias: "Baterías",
      "motor-filtros": "Motor y filtros",
      "llantas-ruedas": "Llantas y ruedas",
      iluminacion: "Iluminación"
    };
    const label = labels[category];
    return label || value;
  }

  function createProductCard(product) {
    const name = String(product.nombre);
    const category = normalizedCategory(String(product.categoria));
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.productId = String(product.id);
    card.dataset.stock = String(product.stock);

    if (isCatalog) {
      card.dataset.category = category;
      card.dataset.name = name;
    }

    const image = document.createElement("img");
    image.className = "product-art";
    image.src = imageByName.get(name) || fallbackImage;
    image.dataset.fallback = fallbackImage;
    image.alt = `Imagen de ${name}`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.src = image.dataset.fallback;
      image.removeAttribute("data-fallback");
    }, { once: true });

    const info = document.createElement("div");
    info.className = "product-info";

    if (isCatalog) {
      const categoryLabel = document.createElement("p");
      categoryLabel.className = "product-category";
      categoryLabel.textContent = displayCategory(String(product.categoria), category);
      info.append(categoryLabel);
    }

    const heading = document.createElement("h3");
    heading.textContent = name;

    const description = document.createElement("p");
    description.textContent = String(product.descripcion || "");

    const bottom = document.createElement("div");
    bottom.className = "product-bottom";

    const price = document.createElement("span");
    price.className = "price";
    price.textContent = `$${currencyFormatter.format(Number(product.precio_cop))}`;

    const button = document.createElement("button");
    button.className = "add-button";
    button.type = "button";
    button.textContent = Number(product.stock) > 0 ? "Agregar" : "Agotado";
    button.disabled = Number(product.stock) <= 0;
    bottom.append(price, button);
    info.append(heading, description, bottom);

    const stock = document.createElement("p");
    stock.className = "product-stock";
    stock.textContent = `Disponibles: ${Number(product.stock)} unidades`;
    info.append(stock);

    card.append(image, info);
    return card;
  }

  function showMessage(message, className) {
    const notice = document.createElement("p");
    notice.className = className;
    notice.setAttribute("role", "status");
    notice.textContent = message;
    productGrid.replaceChildren(notice);
  }

  let hasLoadedProducts = false;
  let productsRequest = null;

  async function loadProducts() {
    if (productsRequest) return productsRequest;

    productsRequest = (async () => {
      if (!hasLoadedProducts) showMessage("Cargando productos…", "products-loading");
      const response = await fetch("/api/productos");
      if (!response.ok) {
        throw new Error(`El servidor respondió ${response.status}`);
      }

      const products = await response.json();
      if (!Array.isArray(products)) {
        throw new Error("La respuesta del servidor no contiene una lista de productos.");
      }
      productsById.clear();
      products.forEach((product) => productsById.set(Number(product.id), product));

      if (!hasLoadedProducts) {
        if (isCatalog) {
          productGrid.replaceChildren(...products.map(createProductCard));
          initializeCatalog();
        } else {
          const preferredNames = originalCards.map((card) =>
            card.dataset.name || card.querySelector("h3").textContent.trim()
          );
          const featured = preferredNames
            .map((name) => products.find((product) => product.nombre === name))
            .filter(Boolean);
          const selection = featured.length ? featured : products.slice(0, 4);
          productGrid.replaceChildren(...selection.map(createProductCard));
        }
        hasLoadedProducts = true;
      } else {
        updateProductCards();
      }
      renderCart();
    })()
      .catch((error) => {
        console.error("No se pudieron sincronizar los productos y el inventario desde MySQL:", error);
        if (!hasLoadedProducts) {
          showMessage("No se pudieron cargar los productos desde la base de datos. Comprueba el servidor y la conexión.", "products-error");
        }
      })
      .finally(() => {
        productsRequest = null;
      });

    return productsRequest;
  }

  function initializeCatalog() {
    const filterButtons = Array.from(document.querySelectorAll("[data-category-filter]"));
    const searchInput = document.querySelector("#catalog-search");
    const searchForm = document.querySelector("#catalog-search-form");
    const productCount = document.querySelector("#product-count");
    const categoryNames = {
      todas: "Todos los productos",
      baterias: "Baterías",
      "motor-filtros": "Motor y filtros",
      "llantas-ruedas": "Llantas y ruedas",
      iluminacion: "Iluminación"
    };
    const productCards = Array.from(productGrid.querySelectorAll(".product-card"));
    let activeCategory = "todas";

    function renderProducts() {
      const searchTerm = searchInput.value.trim().toLocaleLowerCase("es");
      let visibleCount = 0;

      productCards.forEach((card) => {
        const matchesCategory = activeCategory === "todas" || card.dataset.category === activeCategory;
        const matchesSearch = card.dataset.name.toLocaleLowerCase("es").includes(searchTerm);
        const isVisible = matchesCategory && matchesSearch;
        card.hidden = !isVisible;
        if (isVisible) visibleCount += 1;
      });

      productCount.textContent = `${visibleCount} ${visibleCount === 1 ? "producto" : "productos"} · ${categoryNames[activeCategory]}`;

      let emptyMessage = productGrid.querySelector(".no-products");
      if (visibleCount === 0 && !emptyMessage) {
        emptyMessage = document.createElement("p");
        emptyMessage.className = "no-products";
        emptyMessage.textContent = "No encontramos productos con esa búsqueda. Prueba con otro nombre.";
        productGrid.append(emptyMessage);
      } else if (visibleCount > 0 && emptyMessage) {
        emptyMessage.remove();
      }
    }

    function setCategory(category) {
      activeCategory = categoryNames[category] ? category : "todas";
      filterButtons.forEach((button) => {
        const isActive = button.dataset.categoryFilter === activeCategory;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      renderProducts();
    }

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const category = button.dataset.categoryFilter;
        setCategory(category);
        history.replaceState(null, "", category === "todas" ? "#categorias" : `#${category}`);
      });
    });

    searchInput.addEventListener("input", renderProducts);
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      renderProducts();
    });

    const initialCategory = window.location.hash.slice(1);
    setCategory(categoryNames[initialCategory] ? initialCategory : "todas");
  }

  if (isCatalog) {
    document.querySelector("#product-count").textContent = "Cargando productos…";
  }
  window.addEventListener("focus", loadProducts);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadProducts();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === stockUpdatesKey) loadProducts();
  });
  window.setInterval(() => {
    if (document.visibilityState === "visible") loadProducts();
  }, 10000);
  renderCart();
  loadProducts();
}
