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
  const id = `${type}-${side}`;
  return `
    <svg class="garment-svg garment-${type}" viewBox="0 0 250 300" role="img" aria-label="${escapeAttr(category)} ${side === "front" ? "Vorderseite" : "Rückseite"}">
      <defs>
        <linearGradient id="fabric-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef3ef"/></linearGradient>
        <filter id="shadow-${id}" x="-25%" y="-20%" width="150%" height="155%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#183b2a" flood-opacity=".13"/></filter>
      </defs>
      ${garmentDrawing(type, side, id)}
      ${garmentZones(type, side)}
    </svg>
  `;
}

function garmentDrawing(type, side, id) {
  const shortBody = "M79 38 39 58 15 116l35 17 18-31v160h114V102l18 31 35-17-24-58-40-20c-10 19-25 28-46 28S89 57 79 38Z";
  const longBody = "M82 40 52 55 28 80 8 205l31 8 30-107 5 158h102l5-158 30 107 31-8-20-125-24-25-30-15c-10 17-24 25-43 25s-33-8-43-25Z";
  const body = (path) => `<path class="garment-body" filter="url(#shadow-${id})" fill="url(#fabric-${id})" d="${path}"/>`;
  const shortSeams = '<path class="garment-detail" d="M79 38c9 19 25 28 46 28s36-9 46-28M68 102 50 133M182 102l18 31"/>';
  const longSeams = '<path class="garment-detail" d="M82 40c10 17 24 25 43 25s33-8 43-25M69 106 39 213M181 106l30 107"/>';

  if (type === "cap") {
    return side === "front"
      ? `<path class="garment-body" filter="url(#shadow-${id})" fill="url(#fabric-${id})" d="M53 157c6-54 36-83 75-83 39 0 68 29 73 83H53Z"/><path class="garment-detail" d="M128 74v83M53 157h148M80 151c-13 1-32 8-49 22 53 4 102-1 137-16"/>`
      : `<path class="garment-body" filter="url(#shadow-${id})" fill="url(#fabric-${id})" d="M55 158c8-54 39-84 80-84 38 0 65 29 68 84H55Z"/><path class="garment-detail" d="M135 74c18 17 27 46 26 84M55 158h148M162 157c22 1 42 6 58 15-24 7-48 7-72-1"/>`;
  }
  if (type === "beanie") {
    return `<path class="garment-body" filter="url(#shadow-${id})" fill="url(#fabric-${id})" d="M67 187c0-69 20-112 58-112s58 43 58 112H67Z"/><path class="garment-detail" d="M67 164h116v31H67zM86 92c12-11 25-17 39-17s27 6 39 17"/>`;
  }
  if (type === "bag") {
    return `<path class="garment-body" filter="url(#shadow-${id})" fill="url(#fabric-${id})" d="M63 91h124l15 172H48L63 91Z"/><path class="garment-detail" d="M91 98c0-35 12-53 34-53s34 18 34 53M63 116h124${side === "front" ? "M78 225h94" : ""}"/>`;
  }
  if (type === "apron") {
    return `<path class="garment-body" filter="url(#shadow-${id})" fill="url(#fabric-${id})" d="M91 58h68l13 52 22 155H56l22-155 13-52Z"/><path class="garment-detail" d="M91 58c3-25 14-38 34-38s31 13 34 38M78 110 36 86M172 110l42-24${side === "front" ? "M82 203h86v42H82z" : ""}"/>`;
  }
  if (type === "vest") {
    return `${body("M82 40 63 53 72 99v165h106V99l9-46-19-13c-10 17-24 25-43 25s-33-8-43-25Z")}<path class="garment-detail" d="M82 40c10 17 24 25 43 25s33-8 43-25M72 99l18-42M178 99l-18-42${side === "front" ? "M125 66v198" : ""}"/>`;
  }
  if (type === "sweatshirt") return `${body(longBody)}${longSeams}<path class="garment-detail" d="M99 47c7 10 15 15 26 15s19-5 26-15M18 128l25 18M232 128l-25 18"/>`;
  if (type === "hoodie") return `<path class="garment-body garment-hood" fill="url(#fabric-${id})" d="M91 56c-3-29 9-46 34-46s37 17 34 46c-9 12-21 18-34 18s-25-6-34-18Z"/>${body(longBody)}${longSeams}<path class="garment-detail" d="M91 56c9 12 21 18 34 18s25-6 34-18${side === "front" ? "M86 205h78l-10 38H96l-10-38ZM125 65v57" : ""}"/>`;
  if (type === "jacket") return `${body(longBody)}${longSeams}<path class="garment-detail" d="M99 46 125 70l26-24M125 70v194${side === "front" ? "M84 190h28M138 190h28" : ""}"/>`;
  if (type === "shirt") return `${body(shortBody)}${shortSeams}<path class="garment-detail" d="M91 45 112 74l13-13 13 13 21-29M125 61v203${side === "front" ? "M125 97h.1M125 124h.1M125 151h.1M125 178h.1" : ""}"/>`;
  if (type === "polo") return `${body(shortBody)}${shortSeams}<path class="garment-detail" d="M91 44 112 71l13-10 13 10 21-27M112 71h26M125 62v48${side === "front" ? "M125 83h.1M125 96h.1" : ""}"/>`;
  return `${body(shortBody)}${shortSeams}`;
}

function garmentZones(type, side) {
  if (type === "cap" || type === "beanie") {
    return side === "front"
      ? '<rect class="placement-zone" data-position="Cap vorne" x="96" y="112" width="58" height="38" rx="5"/>'
      : '<rect class="placement-zone" data-position="Cap seitlich" x="135" y="112" width="38" height="38" rx="5"/>';
  }
  if (type === "bag" || type === "apron") {
    return '<rect class="placement-zone" data-position="Vorderseite groß" x="86" y="125" width="78" height="104" rx="6"/><rect class="placement-zone" data-position="Sonstiges" x="94" y="195" width="62" height="42" rx="5"/>';
  }
  if (side === "back") {
    return `
      <rect class="placement-zone" data-position="Nacken" x="105" y="72" width="40" height="15" rx="4"/>
      <rect class="placement-zone" data-position="Rücken oben" x="82" y="103" width="86" height="28" rx="5"/>
      <rect class="placement-zone" data-position="Rücken groß" x="91" y="137" width="68" height="94" rx="6"/>
      <rect class="placement-zone" data-position="Rücken unten" x="82" y="235" width="86" height="19" rx="4"/>
    `;
  }
  const longSleeves = ["sweatshirt", "hoodie", "jacket"].includes(type);
  return `
    <rect class="placement-zone" data-position="Brust rechts" x="77" y="103" width="36" height="26" rx="4"/>
    <rect class="placement-zone" data-position="Brust links" x="137" y="103" width="36" height="26" rx="4"/>
    <rect class="placement-zone" data-position="Brust mittig" x="106" y="104" width="38" height="25" rx="4"/>
    <rect class="placement-zone" data-position="Vorderseite groß" x="94" y="139" width="62" height="91" rx="6"/>
    ${longSleeves
      ? '<path class="placement-zone" data-position="Ärmel rechts" d="M27 92 49 99 31 186 13 181Z"/><path class="placement-zone" data-position="Ärmel links" d="m223 92-22 7 18 87 18-5Z"/>'
      : '<path class="placement-zone" data-position="Ärmel rechts" d="M39 72 66 86 53 116 25 102Z"/><path class="placement-zone" data-position="Ärmel links" d="m211 72-27 14 13 30 28-14Z"/>'}
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
