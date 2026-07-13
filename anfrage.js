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
refreshGarmentPreviewTabs();

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

  const isHeadwear = type === "cap" || type === "beanie";
  document.getElementById("preview-front-title").textContent = isHeadwear ? "Vorderansicht" : "Vorderseite";
  document.getElementById("preview-back-title").textContent = isHeadwear ? "Seitenansicht" : "Rückseite";
  document.getElementById("preview-front-subtitle").textContent = category;
  document.getElementById("preview-back-subtitle").textContent = category;
  front.innerHTML = garmentSvg(type, "front", category);
  back.innerHTML = garmentSvg(type, "back", category);
  syncPlacementZones();
}

function garmentTypeForCategory(category) {
  const mapping = {
    "Poloshirt": "polo",
    "Hoodie / Kapuzenpullover": "hoodie",
    "Sweatshirt": "sweatshirt",
    "Jacke": "jacket",
    "Arbeitsbekleidung": "jacket",
    "Weste": "vest",
    "Hemd / Bluse": "shirt",
    "Kappe / Cap": "cap",
    "Mütze / Beanie": "beanie",
    "Tasche / Rucksack": "bag",
    "Schürze": "apron"
  };
  return mapping[category] || "tshirt";
}

function garmentSvg(type, side, category) {
  return `
    <svg class="garment-svg garment-${type}" viewBox="0 0 320 330" role="img" aria-label="${escapeAttr(category)} ${side === "front" ? "Vorderseite" : "Rückseite"}">
      ${garmentDrawing(type, side)}
      ${garmentZones(type, side)}
    </svg>
  `;
}

function garmentDrawing(type, side) {
  const shortBody = "M110 35 69 53 31 81 12 135 53 157 78 119 78 300H242V119l25 38 41-22-19-54-38-28-41-18c-8 24-25 36-50 36s-42-12-50-36Z";
  const longBody = "M112 38 70 57 40 87 12 246l40 9 32-122v168h152V133l32 122 40-9-28-159-30-30-42-19c-8 21-24 32-48 32s-40-11-48-32Z";
  const body = (path) => `<path class="garment-body" d="${path}"/>`;
  const shortSeams = `
    <path class="garment-detail" d="M110 35c8 24 25 36 50 36s42-12 50-36M78 119 53 157M242 119l25 38"/>
    <path class="garment-stitch" d="M20 133l34 18M266 151l34-18M83 292h154"/>
  `;
  const longSeams = `
    <path class="garment-detail" d="M112 38c8 21 24 32 48 32s40-11 48-32M84 133 52 255M236 133l32 122"/>
    <path class="garment-stitch" d="M20 241l33 8M267 249l33-8M89 291h142"/>
  `;

  if (type === "cap") {
    return side === "front"
      ? `<path class="garment-body" d="M70 188c8-73 47-112 94-112 48 0 84 39 90 112H70Z"/><path class="garment-detail" d="M164 76v112M70 188h184M105 181c-19 1-43 11-65 29 69 5 133-2 179-22"/>`
      : `<path class="garment-body" d="M72 188c10-73 49-112 98-112 46 0 81 39 85 112H72Z"/><path class="garment-detail" d="M170 76c23 23 34 61 32 112M72 188h183M202 187c29 1 53 8 74 21-31 9-61 9-91-2"/>`;
  }
  if (type === "beanie") {
    return `<path class="garment-body" d="M83 224c0-93 28-150 77-150s77 57 77 150H83Z"/><path class="garment-rib" d="M83 194h154v42H83z"/><path class="garment-detail" d="M108 96c15-15 32-22 52-22s37 7 52 22"/>`;
  }
  if (type === "bag") {
    return `<path class="garment-body" d="M82 91h156l19 210H63L82 91Z"/><path class="garment-detail" d="M117 100c0-47 15-70 43-70s43 23 43 70M82 122h156${side === "front" ? "M102 250h116" : ""}"/>`;
  }
  if (type === "apron") {
    return `<path class="garment-body" d="M116 55h88l16 66 29 180H71l29-180 16-66Z"/><path class="garment-detail" d="M116 55c4-34 19-50 44-50s40 16 44 50M100 121 46 90M220 121l54-31${side === "front" ? "M105 224h110v54H105z" : ""}"/>`;
  }
  if (type === "vest") {
    return `${body("M112 38 84 56l12 58v187h128V114l12-58-28-18c-8 21-24 32-48 32s-40-11-48-32Z")}<path class="garment-detail" d="M112 38c8 21 24 32 48 32s40-11 48-32M96 114l24-66M224 114l-24-66${side === "front" ? "M160 70v231" : ""}"/>`;
  }
  if (type === "sweatshirt") return `
    ${body(longBody)}${longSeams}
    <path class="garment-rib" d="M84 282h152v19H84zM13 235l40 9-3 18-40-9zM267 244l40-9 3 18-40 9z"/>
    <path class="garment-detail" d="${side === "front" ? "M130 48c8 9 18 13 30 13s22-4 30-13" : "M128 47c9 7 20 11 32 11s23-4 32-11"}"/>
  `;
  if (type === "hoodie") return `<path class="garment-hood" d="M116 59c-4-38 11-56 44-56s48 18 44 56c-12 15-27 22-44 22s-32-7-44-22Z"/>${body(longBody)}${longSeams}<path class="garment-detail" d="M116 59c12 15 27 22 44 22s32-7 44-22${side === "front" ? "M111 228h98l-13 50h-72l-13-50ZM160 79v63" : ""}"/>`;
  if (type === "jacket") return `${body(longBody)}${longSeams}<path class="garment-detail" d="M128 46 160 76l32-30M160 76v225${side === "front" ? "M107 211h34M179 211h34" : ""}"/>`;
  if (type === "shirt") return `${body(shortBody)}${shortSeams}<path class="garment-detail" d="M116 42 144 77l16-14 16 14 28-35M160 63v237${side === "front" ? "M160 106h.1M160 140h.1M160 174h.1M160 208h.1" : ""}"/>`;
  if (type === "polo") return `
    ${body(shortBody)}${shortSeams}
    ${side === "front" ? `
      <path class="garment-rib" d="M111 37 141 75l19-13-18-24-22-10ZM209 37l-30 38-19-13 18-24 22-10Z"/>
      <path class="garment-detail" d="M145 71h30v48h-30zM153 78h14"/>
      <circle class="garment-button" cx="160" cy="89" r="2.3"/><circle class="garment-button" cx="160" cy="105" r="2.3"/>
    ` : `<path class="garment-rib" d="M113 37c9 17 25 25 47 25s38-8 47-25l-9-4c-8 13-21 19-38 19s-30-6-38-19Z"/>`}
    <path class="garment-rib" d="M24 133l34 18-7 13-35-18zM262 151l34-18 8 13-35 18z"/>
  `;
  return `
    ${body(shortBody)}${shortSeams}
    <path class="garment-detail" d="${side === "front" ? "M126 45c7 12 18 18 34 18s27-6 34-18" : "M124 43c9 9 21 14 36 14s27-5 36-14"}"/>
  `;
}

function garmentZones(type, side) {
  if (type === "cap" || type === "beanie") {
    return side === "front"
      ? '<rect class="placement-zone" data-position="Vorderseite groß" x="122" y="124" width="76" height="52" rx="2"/>'
      : '';
  }
  if (type === "bag" || type === "apron") {
    return side === "front" ? '<rect class="placement-zone" data-position="Vorderseite groß" x="112" y="145" width="96" height="118" rx="2"/>' : '';
  }
  if (side === "back") {
    return `
      <rect class="placement-zone" data-position="Nacken" x="137" y="76" width="46" height="16" rx="2"/>
      <rect class="placement-zone" data-position="Rücken oben" x="103" y="105" width="114" height="32" rx="2"/>
      <rect class="placement-zone" data-position="Rücken groß" x="117" y="148" width="86" height="108" rx="2"/>
      <rect class="placement-zone" data-position="Rücken unten" x="105" y="269" width="110" height="20" rx="2"/>
    `;
  }
  const longSleeves = ["sweatshirt", "hoodie", "jacket"].includes(type);
  return `
    <rect class="placement-zone" data-position="Brust rechts" x="94" y="101" width="42" height="32" rx="2"/>
    <rect class="placement-zone" data-position="Brust links" x="184" y="101" width="42" height="32" rx="2"/>
    <rect class="placement-zone" data-position="Brust mittig" x="139" y="101" width="42" height="32" rx="2"/>
    <rect class="placement-zone" data-position="Vorderseite groß" x="120" y="151" width="80" height="108" rx="2"/>
    ${longSleeves
      ? '<path class="placement-zone" data-position="Ärmel rechts" d="M42 105 65 112 43 208 22 203Z"/><path class="placement-zone" data-position="Ärmel links" d="m278 105-23 7 22 96 21-5Z"/>'
      : '<path class="placement-zone" data-position="Ärmel rechts" d="M38 88 66 103 53 136 24 121Z"/><path class="placement-zone" data-position="Ärmel links" d="m282 88-28 15 13 33 29-15Z"/>'}
  `;
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
