// ------- CONFIG -------
// Prefer an explicit API root; leave empty to use relative /api via CloudFront behavior.
const API_ROOT = "https://122nnbze47.execute-api.ap-south-1.amazonaws.com/api"; // <- set to "" to use relative

function api(path) {
  const base = (API_ROOT || "").replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${suffix}` : `/api${suffix}`;
}

// ------- DOM -------
const isoFormat = /^[A-Za-z]{4}\d{7}$/;
const companySelect = document.getElementById("company");
const containerInput = document.getElementById("container");
const form = document.getElementById("trackForm");
const errorEl = document.getElementById("error");
const consentEl = document.getElementById("consent");
const rCard = document.getElementById("result");
const rTitle = document.getElementById("r-title");
const rMeta = document.getElementById("r-meta");
const rStatus = document.getElementById("r-status");
const rEta = document.getElementById("r-eta");
const rBody = document.querySelector("#r-table tbody");

// Optional user fields (present in your new UI)
const nameEl = document.getElementById("userName");
const emailEl = document.getElementById("userEmail");
const roleEl = document.getElementById("userRole");
const compEl = document.getElementById("userCompany");
const countryEl = document.getElementById("userCountry");
const phoneEl = document.getElementById("userPhone");

// Helper: show error
function showError(msg) {
  console.error("[UI ERROR]", msg);
  errorEl.textContent = msg;
}

// Helper: E.164-ish builder (countryEl value already contains +code)
function buildPhoneE164() {
  const cc = (countryEl?.value || "").trim();   // e.g. "+91"
  const local = (phoneEl?.value || "").replace(/[^\d]/g, "");
  if (!cc || !local) return "";
  return `${cc}${local}`;
}

// ------- Load carriers -------
async function loadCarriers() {
  try {
    const res = await fetch(api("/carriers"));
    if (!res.ok) throw new Error(`carriers HTTP ${res.status}`);
    const data = await res.json();
    (data || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = `${c.name} (${c.code})`;
      companySelect.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to load carriers:", e);
    showError("Could not load carrier list. Please refresh.");
  }
}
loadCarriers();

// ------- Auto-detect carrier from container input -------
containerInput.addEventListener("input", async () => {
  const raw = (containerInput.value || "").toUpperCase().trim();
  containerInput.value = raw;

  if (raw.length >= 4) {
    try {
      const res = await fetch(api("/resolve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ container: raw })
      });
      if (!res.ok) throw new Error(`resolve HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.code) {
        companySelect.value = data.code; // fill dropdown if present
      }
    } catch (e) {
      console.warn("Resolve failed:", e);
      // Non-fatal. Backend also guesses if company is blank.
    }
  }
});

// ------- Submit -------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";

  const company = companySelect.value;
  const container = (containerInput.value || "").toUpperCase().trim();

  if (!consentEl.checked) { showError("Please agree to the consent checkbox."); return; }
  if (!isoFormat.test(container)) { showError("Please enter a valid container number (e.g., MSCU1234567)."); return; }

  // user blob (your Lambda writes both Submissions & Users tables)
  const user = {
    name: nameEl?.value?.trim() || "",
    email: emailEl?.value?.trim() || "",
    role: roleEl?.value || "",
    company: compEl?.value?.trim() || "",
    phone: buildPhoneE164()
  };

  // 1) init
  let initData;
  try {
    const initRes = await fetch(api("/track/init"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, container, consent: true, user })
    });
    initData = await initRes.json();
    if (!initRes.ok) {
      showError(initData?.error || "Failed to initialize tracking.");
      return;
    }
  } catch (e) {
    showError("Network error while initializing. Check your connection.");
    console.error(e);
    return;
  }

  // 2) details
  await fetchDetails(initData.company || company || "", container);
});

async function fetchDetails(company, container) {
  rBody.innerHTML = "";
  rTitle.textContent = `Tracking ${container}`;
  rMeta.textContent = company ? `Carrier: ${company}` : "";
  rStatus.textContent = "Loading…";
  rEta.textContent = "";
  rCard.classList.remove("hidden");

  try {
    const res = await fetch(api("/track/details"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, container })
    });
    const data = await res.json();

    if (!res.ok) {
      rStatus.innerHTML = `<span style="color:#ff5c5c">Error:</span> ${data.error || "Failed"}`;
      return;
    }
    rStatus.innerHTML = `<span class="status-chip">${data.status || "Unknown"}</span>`;
    rEta.textContent = data.eta ? ("ETA: " + new Date(data.eta).toLocaleString()) : "";

    (data.milestones || []).forEach(m => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.code || "-"}</td>
        <td>${m.name || "-"}</td>
        <td>${m.time ? new Date(m.time).toLocaleString() : "-"}</td>
        <td>${m.location || "-"}</td>`;
      rBody.appendChild(tr);
    });
  } catch (e) {
    rStatus.innerHTML = `<span style="color:#ff5c5c">Error:</span> Network error fetching details`;
    console.error(e);
  }
}
