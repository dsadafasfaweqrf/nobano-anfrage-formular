const CATEGORIES = [
  "", "T-Shirt", "Poloshirt", "Hoodie / Kapuzenpullover", "Sweatshirt", "Jacke", "Weste",
  "Hemd / Bluse", "Arbeitsbekleidung", "Sporttrikot", "Kappe / Cap", "Mütze / Beanie",
  "Tasche / Rucksack", "Schürze", "Sonstiges"
];

const hash = new URLSearchParams(location.hash.slice(1));
const orderId = hash.get("id") || `NB-${Date.now().toString(36).toUpperCase()}`;
const prefill = decodePayload(hash.get("p"));
let productSequence = 0;
let currentStep = 1;
let selectedPreviewCategory = "";

document.getElementById("request-id").textContent = `Anfrage ${orderId}`;
document.getElementById("success-id").textContent = orderId;
if (!hash.get("p")) document.getElementById("prefill-note").hidden = true;

applyPrefill(prefill);
bindEvents();

function bindEvents() {
  document.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => {
    if (validateStep(currentStep)) goTo(Number(button.dataset.next));
  }));
  document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", () => goTo(Number(button.dataset.back))));
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => {
    const target = Number(button.dataset.go);
    if (target < currentStep || validateStep(currentStep)) goTo(target);
  }));
  document.getElementById("add-product").addEventListener("click", () => addProduct({}));
  document.getElementById("logoFile").addEventListener("change", (event) => {
    document.getElementById("file-name").textContent = event.target.files[0]?.name || "";
  });
  document.getElementById("intake-form").addEventListener("input", () => {
    if (currentStep === 4) buildSummary();
  });
  document.getElementById("intake-form").addEventListener("change", (event) => {
    if (event.target.matches('input[name="positions"]')) syncPlacementZones();
    if (event.target.matches('select[name$="_category"]')) refreshGarmentPreviewTabs();
  });
  document.getElementById("intake-form").addEventListener("submit", submitForm);
}

function applyPrefill(data) {
  const customer = data.customer || {};
  setValue("firstName", customer.firstName);
  setValue("lastName", customer.lastName);
  setValue("company", customer.company);

  const products = data.products?.length ? data.products : [{}];
  products.forEach(addProduct);

  const embellishment = data.embellishment || {};
  setRadio("embellishmentType", embellishment.type);
  setRadio("logoStatus", embellishment.logoStatus);
  setValue("motifColors", embellishment.motifColors);
  setValue("logoNotes", embellishment.logoNotes);
  setValue("embellishmentNotes", embellishment.notes);
  (embellishment.positions || []).forEach((position) => {
    const checkbox = [...document.querySelectorAll('input[name="positions"]')].find((item) => item.value === position);
    if (checkbox) checkbox.checked = true;
  });

  const contact = data.contact || {};
  setValue("email", contact.email);
  setValue("phone", contact.phone);
  setValue("deliveryAddress", contact.deliveryAddress);
  setValue("desiredDate", contact.desiredDate);
  setValue("contactNotes", contact.notes);
  setRadio("preferredChannel", contact.preferredChannel || "");
}

function addProduct(product = {}) {
  const root = document.getElementById("products");
  const index = productSequence++;
  const article = document.createElement("article");
  article.className = "product";
  article.dataset.product = index;
  article.innerHTML = `
    <div class="product-title"><strong>Textil ${root.children.length + 1}</strong>${root.children.length ? '<button type="button">Entfernen</button>' : ""}</div>
    <div class="grid grid-2">
      <label class="field"><span>Textilart</span><select name="p_${index}_category">${CATEGORIES.map((category) => `<option value="${escapeAttr(category)}"${category === (product.category || "") ? " selected" : ""}>${escapeHtml(category || "Bitte wählen")}</option>`).join("")}</select></label>
      <label class="field"><span>Sonstige Textilart <em>optional</em></span><input name="p_${index}_otherCategory" value="${escapeAttr(product.otherCategory)}" placeholder="z. B. Handtuch"></label>
      <label class="field"><span>Menge</span><input name="p_${index}_quantity" type="number" min="0" value="${product.quantity || ""}" placeholder="z. B. 5"></label>
      <label class="field"><span>Größen & Stückzahlen</span><input name="p_${index}_sizes" value="${escapeAttr(product.sizes)}" placeholder="z. B. 5 × S, 3 × M"></label>
      <label class="field"><span>Farbe</span><input name="p_${index}_color" value="${escapeAttr(product.color)}" placeholder="z. B. Schwarz"></label>
      <label class="field"><span>Material <em>optional</em></span><input name="p_${index}_material" value="${escapeAttr(product.material)}" placeholder="z. B. Bio-Baumwolle"></label>
      <label class="field"><span>Schnitt <em>optional</em></span><input name="p_${index}_fit" value="${escapeAttr(product.fit)}" placeholder="z. B. Unisex, tailliert"></label>
      <label class="field"><span>Weitere Textilwünsche <em>optional</em></span><input name="p_${index}_notes" value="${escapeAttr(product.notes)}" placeholder="Marke, Qualität, Artikel …"></label>
    </div>
  `;
  root.appendChild(article);
  if (Object.values(product).some(Boolean)) article.querySelectorAll("input, select").forEach((field) => field.value && field.classList.add("prefilled"));
  article.querySelector("button")?.addEventListener("click", () => {
    article.remove();
    [...root.children].forEach((item, position) => { item.querySelector(".product-title strong").textContent = `Textil ${position + 1}`; });
  });
}

function goTo(step) {
  currentStep = step;
  document.querySelectorAll(".step").forEach((section) => section.classList.toggle("active", Number(section.dataset.step) === step));
  document.querySelectorAll(".progress-step").forEach((button) => {
    const buttonStep = Number(button.dataset.go);
    button.classList.toggle("active", buttonStep === step);
    button.classList.toggle("done", buttonStep < step);
    button.querySelector("span").textContent = buttonStep < step ? "✓" : String(buttonStep);
  });
  if (step === 3) refreshGarmentPreviewTabs();
  if (step === 4) buildSummary();
  window.scrollTo({ top: document.querySelector(".progress").offsetTop - 20, behavior: "smooth" });
}

function refreshGarmentPreviewTabs() {
  const tabs = document.getElementById("garment-preview-tabs");
  if (!tabs) return;
  const categories = [...new Set(
    [...document.querySelectorAll('.product select[name$="_category"]')]
      .map((select) => select.value)
      .filter(Boolean)
  )];
  if (!categories.length) categories.push("T-Shirt");
  if (!categories.includes(selectedPreviewCategory)) selectedPreviewCategory = categories[0];

  tabs.innerHTML = categories.map((category) => `
    <button type="button" data-preview-category="${escapeAttr(category)}" class="${category === selectedPreviewCategory ? "active" : ""}">${escapeHtml(category)}</button>
  `).join("");
  tabs.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    selectedPreviewCategory = button.dataset.previewCategory;
    refreshGarmentPreviewTabs();
  }));
  renderGarmentPreview(selectedPreviewCategory);
}

function renderGarmentPreview(category) {
  const type = garmentTypeForCategory(category);
  const front = document.getElementById("garment-front");
  const back = document.getElementById("garment-back");
  if (!front || !back) return;

  const isCap = type === "cap";
  document.getElementById("preview-front-title").textContent = isCap ? "Vorderansicht" : "Vorderseite";
  document.getElementById("preview-back-title").textContent = isCap ? "Seitenansicht" : "Rückseite";
  document.getElementById("preview-front-subtitle").textContent = category;
  document.getElementById("preview-back-subtitle").textContent = category;
  front.innerHTML = garmentImagePreview(type, "front", category);
  back.innerHTML = garmentImagePreview(type, "back", category);
  syncPlacementZones();
}

function garmentTypeForCategory(category) {
  const mapping = {
    "T-Shirt": "tshirt",
    "Poloshirt": "polo",
    "Hoodie / Kapuzenpullover": "hoodie",
    "Sweatshirt": "sweatshirt",
    "Jacke": "jacket",
    "Arbeitsbekleidung": "workwear",
    "Weste": "vest",
    "Hemd / Bluse": "shirt",
    "Sporttrikot": "jersey",
    "Kappe / Cap": "cap",
    "Mütze / Beanie": "beanie",
    "Tasche / Rucksack": "bag",
    "Schürze": "apron",
    "Sonstiges": "other"
  };
  return mapping[category] || (category ? "other" : "tshirt");
}

const GARMENT_IMAGES = {
  tshirt: { front: "assets/garments/tshirt-front.png", back: "assets/garments/tshirt-back.png" },
  polo: { front: "assets/garments/polo-front.png", back: "assets/garments/polo-back.png" },
  hoodie: { front: "assets/garments/hoodie-front.png", back: "assets/garments/hoodie-back.png" },
  sweatshirt: { front: "assets/garments/sweatshirt-front.png", back: "assets/garments/sweatshirt-back.png" },
  jacket: { front: "assets/garments/jacket-front.png", back: "assets/garments/jacket-back.png" },
  vest: { front: "assets/garments/vest-front.png", back: "assets/garments/vest-back.png" },
  shirt: { front: "assets/garments/shirt-front.png", back: "assets/garments/shirt-back.png" },
  workwear: { front: "assets/garments/workwear-front.png", back: "assets/garments/workwear-back.png" },
  jersey: { front: "assets/garments/jersey-front.png", back: "assets/garments/jersey-back.png" },
  cap: { front: "assets/garments/cap-front.png", back: "assets/garments/cap-back.png" },
  beanie: { front: "assets/garments/beanie-front.png", back: "assets/garments/beanie-back.png" },
  bag: { front: "assets/garments/bag-front.png", back: "assets/garments/bag-back.png" },
  apron: { front: "assets/garments/apron-front.png", back: "assets/garments/apron-back.png" }
};

const PLACEMENT_MASK_IMAGE = "assets/garments/placement-mask.png";

refreshGarmentPreviewTabs();

function garmentImagePreview(type, side, category) {
  const source = GARMENT_IMAGES[type]?.[side];
  if (!source) {
    return `<div class="garment-empty"><strong>Keine Produktvorschau</strong><span>Für „${escapeHtml(category)}“ wird die Position individuell abgestimmt.</span></div>`;
  }
  return `
    <div class="garment-image-stage garment-${type}" role="img" aria-label="${escapeAttr(category)} ${side === "front" ? "Vorderseite" : "Rückseite"}">
      <img class="garment-art" src="${source}" alt="" decoding="async">
      ${garmentZoneImages(type, side)}
    </div>
  `;
}

function placementImage(position, className) {
  return `<img class="placement-zone ${className}" data-position="${escapeAttr(position)}" src="${PLACEMENT_MASK_IMAGE}" alt="" aria-hidden="true">`;
}

function garmentZoneImages(type, side) {
  if (type === "cap" || type === "beanie") {
    return side === "front" ? placementImage("Vorderseite groß", "zone-accessory-front") : "";
  }
  if (type === "bag" || type === "apron") {
    return side === "front"
      ? placementImage("Vorderseite groß", "zone-object-front")
      : placementImage("Rücken groß", "zone-object-back");
  }
  if (side === "back") {
    return [
      placementImage("Nacken", "zone-nape"),
      placementImage("Rücken oben", "zone-back-upper"),
      placementImage("Rücken groß", "zone-back-large"),
      placementImage("Rücken unten", "zone-back-lower")
    ].join("");
  }
  const sleeveZones = type === "vest" ? "" : [
    placementImage("Ärmel rechts", "zone-sleeve-right"),
    placementImage("Ärmel links", "zone-sleeve-left")
  ].join("");
  return [
    placementImage("Brust rechts", "zone-chest-right"),
    placementImage("Brust links", "zone-chest-left"),
    placementImage("Brust mittig", "zone-chest-center"),
    placementImage("Vorderseite groß", "zone-front-large"),
    sleeveZones
  ].join("");
}

function syncPlacementZones() {
  const selected = new Set(
    [...document.querySelectorAll('input[name="positions"]:checked')].map((input) => input.value)
  );
  document.querySelectorAll(".placement-zone[data-position]").forEach((zone) => {
    zone.classList.toggle("active", selected.has(zone.dataset.position));
  });
}

function validateStep(step) {
  if (step === 1) {
    const valid = ["firstName", "lastName", "company"].some((id) => document.getElementById(id).value.trim());
    document.getElementById("customer-error").classList.toggle("show", !valid);
    return valid;
  }
  if (step === 4) {
    const valid = Boolean(document.getElementById("email").value.trim() || document.getElementById("phone").value.trim());
    document.getElementById("contact-error").classList.toggle("show", !valid);
    return valid;
  }
  return true;
}

function collectData() {
  const form = document.getElementById("intake-form");
  const values = new FormData(form);
  const products = [...document.querySelectorAll(".product")].map((article) => {
    const index = article.dataset.product;
    return {
      category: values.get(`p_${index}_category`) || "",
      otherCategory: values.get(`p_${index}_otherCategory`) || "",
      quantity: Number(values.get(`p_${index}_quantity`) || 0),
      sizes: values.get(`p_${index}_sizes`) || "",
      color: values.get(`p_${index}_color`) || "",
      material: values.get(`p_${index}_material`) || "",
      fit: values.get(`p_${index}_fit`) || "",
      notes: values.get(`p_${index}_notes`) || ""
    };
  });
  return {
    orderId,
    schemaVersion: 1,
    customer: {
      firstName: values.get("firstName") || "",
      lastName: values.get("lastName") || "",
      company: values.get("company") || ""
    },
    products,
    embellishment: {
      type: values.get("embellishmentType") || "",
      positions: values.getAll("positions"),
      logoStatus: values.get("logoStatus") || "",
      logoNotes: values.get("logoNotes") || "",
      motifColors: values.get("motifColors") || "",
      notes: values.get("embellishmentNotes") || ""
    },
    contact: {
      email: values.get("email") || "",
      phone: values.get("phone") || "",
      preferredChannel: values.get("preferredChannel") || "",
      deliveryAddress: values.get("deliveryAddress") || "",
      desiredDate: values.get("desiredDate") || "",
      notes: values.get("contactNotes") || ""
    },
    logoFileName: document.getElementById("logoFile").files[0]?.name || "",
    submittedAt: new Date().toISOString(),
    source: prefill.source || { channel: "Link" }
  };
}

function buildSummary() {
  const data = collectData();
  const customerName = [data.customer.firstName, data.customer.lastName].filter(Boolean).join(" ");
  const products = data.products.map((product) => {
    const name = product.category === "Sonstiges" ? product.otherCategory || "Sonstiges" : product.category || "Noch offen";
    const article = product.quantity ? `${product.quantity} × ${name}` : name;
    return [article, product.color, product.sizes].filter(Boolean).join(" · ");
  }).join(" · ");
  document.getElementById("summary").innerHTML = `
    ${summaryGroup("Kunde", [["Name", customerName || "–"], ["Firma / Verein", data.customer.company || "–"]])}
    ${summaryGroup("Textilien", [["Artikel", products || "–"]])}
    ${summaryGroup("Veredelung", [["Art", data.embellishment.type || "–"], ["Position", data.embellishment.positions.join(", ") || "–"], ["Logo", data.embellishment.logoStatus || "–"]])}
    ${summaryGroup("Kontakt", [["E-Mail", data.contact.email || "–"], ["Telefon", data.contact.phone || "–"], ["Wunschtermin", data.contact.desiredDate || "–"]])}
  `;
}

function summaryGroup(title, rows) {
  return `<div class="summary-group"><strong>${escapeHtml(title)}</strong>${rows.map(([key, value]) => `<div class="summary-row"><span>${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></div>`).join("")}</div>`;
}

async function submitForm(event) {
  event.preventDefault();
  const error = document.getElementById("submit-error");
  error.textContent = "";
  if (!validateStep(4)) return;
  if (!document.getElementById("consent").checked) {
    error.textContent = "Bitte die Einwilligung bestätigen.";
    return;
  }

  const button = document.querySelector("button.submit");
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = "Wird übermittelt …";
  const data = collectData();
  const submitUrl = window.NOBANO_FORM_CONFIG?.submitUrl?.trim();

  try {
    if (submitUrl) {
      const body = new FormData();
      body.append("payload", JSON.stringify(data));
      const logo = document.getElementById("logoFile").files[0];
      if (logo) body.append("logo", logo);
      const response = await fetch(submitUrl, { method: "POST", body });
      if (!response.ok) throw new Error(`Übertragung fehlgeschlagen (${response.status})`);
    } else {
      const saved = JSON.parse(localStorage.getItem("nobano-demo-submissions") || "[]");
      localStorage.setItem("nobano-demo-submissions", JSON.stringify([data, ...saved].slice(0, 20)));
      const whatsappLink = document.getElementById("whatsapp-confirm");
      whatsappLink.href = `https://wa.me/4915754223894?text=${encodeURIComponent(buildWhatsAppConfirmation(data))}`;
      whatsappLink.hidden = false;
      document.getElementById("success-message").textContent = "Deine Angaben sind vorbereitet. Bitte sende die Zusammenfassung jetzt noch per WhatsApp an Nobano.";
    }

    document.getElementById("intake-form").hidden = true;
    document.querySelector(".progress").hidden = true;
    document.querySelector(".intro").hidden = true;
    document.getElementById("success").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (submissionError) {
    error.textContent = submissionError.message || "Die Anfrage konnte nicht übermittelt werden. Bitte später erneut versuchen.";
    button.disabled = false;
    button.innerHTML = original;
  }
}

function buildWhatsAppConfirmation(data) {
  const customer = [data.customer.firstName, data.customer.lastName].filter(Boolean).join(" ") || data.customer.company || "Nicht angegeben";
  const products = data.products.map((product, index) => {
    const category = product.category === "Sonstiges" ? product.otherCategory || "Sonstiges" : product.category || "Noch offen";
    return `${index + 1}. ${product.quantity || "?"} × ${category}; Größen: ${product.sizes || "offen"}; Farbe: ${product.color || "offen"}`;
  }).join("\n");
  return [
    `Hallo Nobano, hier ist meine bestätigte Anfrage ${data.orderId}:`,
    "",
    `Kunde: ${customer}`,
    data.customer.company ? `Firma/Verein: ${data.customer.company}` : "",
    "",
    "Textilien:",
    products,
    "",
    `Veredelung: ${data.embellishment.type || "offen"}`,
    `Position: ${data.embellishment.positions.join(", ") || "offen"}`,
    `Logo: ${data.embellishment.logoStatus || "offen"}`,
    data.logoFileName ? `Logo-Datei: ${data.logoFileName} – bitte im Chat anhängen` : "",
    `Kontakt: ${data.contact.email || data.contact.phone || "offen"}`,
    `Wunschtermin: ${data.contact.desiredDate || "offen"}`,
    data.contact.notes ? `Hinweise: ${data.contact.notes}` : ""
  ].filter((line) => line !== "").join("\n");
}

function setValue(id, value) {
  if (!value) return;
  const field = document.getElementById(id);
  if (!field) return;
  field.value = value;
  field.classList.add("prefilled");
}

function setRadio(name, value) {
  if (!value) return;
  const radio = [...document.querySelectorAll(`input[name="${name}"]`)].find((item) => item.value === value);
  if (radio) radio.checked = true;
}

function decodePayload(encoded) {
  if (!encoded) return {};
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    document.getElementById("prefill-note").innerHTML = "<div><strong>Link konnte nicht vollständig gelesen werden</strong><small>Bitte die Angaben manuell ergänzen.</small></div>";
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
