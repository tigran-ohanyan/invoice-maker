(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const form = $("#editor"), itemsEl = $("#items"), tpl = $("#item-row");
  const KEY = "invoice-maker:draft";
  const SYMBOL = { USD: "$", EUR: "€", GBP: "£", AMD: "֏", CHF: "CHF ", PLN: "zł " };

  const today = () => new Date().toISOString().slice(0, 10);
  const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const fmtDate = (v) => (v ? new Date(v + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function money(n, cur) {
    const sym = SYMBOL[cur] ?? cur + " ";
    return sym + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // items --------------------------------------------------------------
  function addItem(data = {}) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".desc").value = data.desc ?? "";
    node.querySelector(".qty").value = data.qty ?? 1;
    node.querySelector(".rate").value = data.rate ?? "";
    itemsEl.appendChild(node);
    return node;
  }
  itemsEl.addEventListener("click", (e) => {
    if (e.target.closest(".remove")) { e.target.closest(".item").remove(); if (!itemsEl.children.length) addItem(); update(); }
  });
  $("#add-item").addEventListener("click", () => { addItem().querySelector(".desc").focus(); update(); });

  // state --------------------------------------------------------------
  function read() {
    const data = Object.fromEntries(new FormData(form).entries());
    data.items = [...itemsEl.querySelectorAll(".item")].map((row) => ({
      desc: row.querySelector(".desc").value, qty: Number(row.querySelector(".qty").value) || 0, rate: Number(row.querySelector(".rate").value) || 0,
    }));
    data.theme = $("#template").value;
    return data;
  }
  function write(data) {
    for (const [k, v] of Object.entries(data)) { const f = form.elements[k]; if (f && k !== "items") f.value = v; }
    itemsEl.innerHTML = "";
    (data.items?.length ? data.items : [{}]).forEach(addItem);
    $("#template").value = data.theme || "teal";
    update();
  }

  // render -------------------------------------------------------------
  function update() {
    const d = read();
    const cur = d.currency || "USD";
    const subtotal = d.items.reduce((s, i) => s + i.qty * i.rate, 0);
    const discount = subtotal * ((Number(d.discount) || 0) / 100);
    const tax = (subtotal - discount) * ((Number(d.tax) || 0) / 100);
    const total = subtotal - discount + tax;

    $("#invoice").dataset.theme = d.theme;
    $("#p-logo").textContent = (d.logo || (d.from_name || "IN").slice(0, 2)).toUpperCase();
    $("#p-from-name").textContent = d.from_name || "Your company";
    $("#p-from-contact").textContent = [d.from_address, d.from_email, d.from_tax ? `Tax ID: ${d.from_tax}` : ""].filter(Boolean).join("\n");
    $("#p-number").textContent = d.number ? `#${d.number}` : "#";
    $("#p-to-name").textContent = d.to_name || "Client";
    $("#p-to-contact").textContent = [d.to_address, d.to_email].filter(Boolean).join("\n");
    $("#p-date").textContent = fmtDate(d.date);
    $("#p-due").textContent = fmtDate(d.due);
    $("#p-due-amount").textContent = money(total, cur);

    const rows = d.items.filter((i) => i.desc || i.rate);
    $("#p-items").innerHTML = rows.length
      ? rows.map((i) => `<tr><td>${esc(i.desc) || "&nbsp;"}</td><td class="num">${i.qty}</td><td class="num">${money(i.rate, cur)}</td><td class="num">${money(i.qty * i.rate, cur)}</td></tr>`).join("")
      : `<tr class="empty"><td colspan="4">Add items on the left</td></tr>`;

    $("#p-subtotal").textContent = money(subtotal, cur);
    $("#p-discount-row").hidden = !discount; $("#p-discount-pct").textContent = `(${d.discount}%)`; $("#p-discount").textContent = "−" + money(discount, cur);
    $("#p-tax-row").hidden = !tax; $("#p-tax-pct").textContent = `(${d.tax}%)`; $("#p-tax").textContent = money(tax, cur);
    $("#p-total").textContent = money(total, cur);

    $("#p-notes-title").hidden = !d.notes; $("#p-notes").textContent = d.notes || "";
    $("#p-payment-title").hidden = !d.payment; $("#p-payment").textContent = d.payment || "";
    $("#p-foot").textContent = d.from_name ? `${d.from_name}${d.from_email ? " · " + d.from_email : ""}` : "";
    document.title = d.number ? `Invoice ${d.number}${d.to_name ? " — " + d.to_name : ""}` : "Invoice Maker";

    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
  }
  form.addEventListener("input", update);
  $("#template").addEventListener("change", update);

  // actions ------------------------------------------------------------
  $("#print").addEventListener("click", () => window.print());
  $("#reset").addEventListener("click", () => {
    const prev = read();
    write({ from_name: prev.from_name, from_email: prev.from_email, from_address: prev.from_address, from_tax: prev.from_tax, logo: prev.logo, payment: prev.payment, currency: prev.currency, tax: prev.tax, theme: prev.theme,
      number: nextNumber(prev.number), date: today(), due: plusDays(14), items: [{}] });
  });
  $("#load-sample").addEventListener("click", () => write({
    from_name: "Studio Nine", from_email: "hello@studio.nine", from_address: "12 Market St\n10178 Berlin, Germany", from_tax: "DE123456789", logo: "S9",
    to_name: "Acme GmbH", to_email: "finance@acme.io", to_address: "Hauptstraße 5\n80331 München, Germany",
    number: "2026-014", date: today(), due: plusDays(14), currency: "EUR", tax: 19, discount: 10, theme: "teal",
    items: [
      { desc: "Landing page design and build (responsive, 5 sections)", qty: 1, rate: 1800 },
      { desc: "Contact form with spam protection and email delivery", qty: 1, rate: 350 },
      { desc: "Hosting setup, domain, SSL", qty: 2, rate: 120 },
      { desc: "Support, hourly", qty: 3.5, rate: 60 },
    ],
    notes: "Thank you for your business. Payment within 14 days.",
    payment: "Bank: Berliner Sparkasse\nIBAN: DE00 1005 0000 0000 0000 00\nBIC: BELADEBEXXX\nReference: 2026-014",
  }));
  function nextNumber(prev) {
    const m = /^(.*?)(\d+)$/.exec(prev || "");
    if (!m) return `${new Date().getFullYear()}-001`;
    return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0");
  }

  // init ---------------------------------------------------------------
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* ignore */ }
  write(saved || { date: today(), due: plusDays(14), currency: "USD", tax: 0, discount: 0, items: [{}] });
})();
