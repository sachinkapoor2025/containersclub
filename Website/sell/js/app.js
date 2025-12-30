/* ===============================
   SELL APP.JS
   =============================== */

const CONFIG = {
  API_BASE: window.SELL_API_BASE || "/api"
};

// ---- Config sanity ----
(function ensureConfig() {
  if (!window.SELL_COGNITO_DOMAIN || !window.SELL_COGNITO_CLIENT_ID) {
    console.warn("[auth] Missing SELL_COGNITO_DOMAIN / SELL_COGNITO_CLIENT_ID in /config.js");
  }
})();

// ---- DOM ----
const loginBtn  = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const formEl    = document.getElementById("listingForm");

// ---- Auth storage helpers ----
const AUTH_KEY = "cb_auth";

function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
  catch { return null; }
}
function setAuth(obj) { localStorage.setItem(AUTH_KEY, JSON.stringify(obj)); }
function clearAuth()   { localStorage.removeItem(AUTH_KEY); }

// ---- Parse tokens from Cognito hash ----
function parseHashForTokens() {
  if (!location.hash || location.hash.length < 2) return;
  const params = new URLSearchParams(location.hash.substring(1));
  const access  = params.get("access_token");
  const idToken = params.get("id_token");
  const type    = params.get("token_type") || "Bearer";
  const expires = parseInt(params.get("expires_in") || "3600", 10);

  if (access) {
    setAuth({
      access_token: access,
      id_token: idToken,
      token_type: type,
      exp: Date.now() + expires * 1000
    });
    // Clean the hash from URL
    history.replaceState(null, "", location.pathname + location.search);
  }
}

// ---- UI state ----
function isExpired(auth) {
  if (!auth || !auth.exp) return true;
  return Date.now() >= auth.exp - 5000; // small skew
}
function refreshUI() {
  const auth = getAuth();
  const loggedIn = auth && !isExpired(auth);

  if (loginBtn)  loginBtn.style.display  = loggedIn ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = loggedIn ? "inline-block" : "none";

  // Disable upload fields if not logged in
  if (formEl) {
    const uploadInputs = formEl.querySelectorAll('input[type="file"]');
    uploadInputs.forEach(i => i.disabled = !loggedIn);
  }
}

// ---- Auth actions ----
function login() {
  const domain   = window.SELL_COGNITO_DOMAIN;
  const clientId = window.SELL_COGNITO_CLIENT_ID;
  const redirect = window.COGNITO_REDIRECT_URI_SELL || location.href;
  const scope    = "openid profile email";

  if (!domain || !clientId) {
    alert("Login not configured. Please set SELL_COGNITO_DOMAIN and SELL_COGNITO_CLIENT_ID in /config.js");
    return;
  }

  const url = `${domain}/oauth2/authorize` +
    `?response_type=token` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(location.pathname)}`;

  location.assign(url);
}

function logout() {
  clearAuth();
  refreshUI();
  // Optional: End the Cognito session (only if you set a logout URI in the app client)
  // const logoutUrl = `${window.SELL_COGNITO_DOMAIN}/logout?client_id=${encodeURIComponent(window.SELL_COGNITO_CLIENT_ID)}&logout_uri=${encodeURIComponent(window.COGNITO_REDIRECT_URI_SELL)}`;
  // location.assign(logoutUrl);
}

// ---- API helper (use for your POST/PUT uploads) ----
async function authFetch(url, options = {}) {
  const auth = getAuth();
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  }
  if (auth && !isExpired(auth)) {
    headers.set("Authorization", `Bearer ${auth.access_token}`);
  }
  return fetch(url, { ...options, headers });
}

// ---- Form submit ----
if (formEl) {
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const auth = getAuth();
    if (!auth || isExpired(auth)) { return login(); }
    // Build FormData
    const formData = new FormData(formEl);
    try {
      const result = await authFetch(CONFIG.API_BASE + "/sell/listings", { method: 'POST', body: formData });
      alert("Listing created successfully!");
      // Optionally reset form or redirect
      formEl.reset();
    } catch (err) {
      alert("Error creating listing: " + err.message);
    }
  });
}

// ---- Wire up ----
if (loginBtn)  loginBtn.addEventListener("click", login);
if (logoutBtn) logoutBtn.addEventListener("click", logout);

// On load: capture tokens (if redirected back) and refresh UI
parseHashForTokens();
refreshUI();

/* ---------------- API ---------------- */

async function api(path, options = {}) {
  const auth = getAuth();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (auth && !isExpired(auth)) {
    headers.set("Authorization", `Bearer ${auth.access_token}`);
  }

  const res = await fetch(CONFIG.API_BASE + path, {
    ...options,
    headers
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

/* ---------------- LIST ---------------- */

async function listListings() {
  return api("/sell/listings");
}

/* ---------------- RENDER ---------------- */

function cardHtml(it) {
  const images = it.images && it.images.length > 0 ? it.images : ["/media/placeholder.jpg"];
  const imgHtml = images.map((img, idx) => `<img src="${img}" style="width:200px;height:140px;object-fit:cover;border-radius:10px;display:${idx === 0 ? 'block' : 'none'};">`).join('');

  return `
  <article class="card" style="display:flex;gap:20px;padding:20px;">
    <div class="img-container" data-listing="${it.listingId}">
      ${imgHtml}
    </div>

    <div style="flex:1;">
      <div class="badge">${it.size}</div>
      <h3 onclick="showDetails('${it.listingId}')" style="cursor:pointer;">${it.title}</h3>
      <p><strong>${it.location}</strong> • <span style="color:#0ea5e9">$${it.price}</span></p>
      <p>${it.description.slice(0,120)}...</p>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      <button onclick="showDetails('${it.listingId}')">Details</button>
      <button class="primary" onclick="window.location.href='/sell/book.html?id=${it.listingId}'">Book</button>
    </div>
  </article>`;
}

async function renderGrid() {
  const grid = document.getElementById("listingGrid");
  if (!grid) return; // Only render if grid exists (e.g., on index.html)
  const data = await listListings();
  window.listings = data.items;
  grid.innerHTML = data.items.map(cardHtml).join("");
  setupSlideshows();
}

function setupSlideshows() {
  const containers = document.querySelectorAll('.img-container');
  containers.forEach(container => {
    const imgs = container.querySelectorAll('img');
    if (imgs.length <= 1) {
      imgs[0].style.display = 'block';
      return;
    }
    let current = 0;
    setInterval(() => {
      imgs[current].style.display = 'none';
      current = (current + 1) % imgs.length;
      imgs[current].style.display = 'block';
    }, 5000);
  });
}

/* ---------------- DETAILS ---------------- */

async function getListingById(id) {
  return api(`/sell/listings/${id}`);
}

async function showDetails(id) {
  const item = await getListingById(id);

  let modal = document.getElementById("detailsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "detailsModal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }

  const images = item.images?.map(i =>
    `<img src="${i}" style="width:30%;margin:5px;border-radius:8px;">`
  ).join("");

  modal.innerHTML = `
  <div class="modal-content">
    <span class="close" onclick="detailsModal.style.display='none'">&times;</span>
    <h2>${item.title}</h2>

    <p><b>ID:</b> ${item.listingId}</p>
    <p><b>Size:</b> ${item.size}</p>
    <p><b>Condition:</b> ${item.condition}</p>
    <p><b>Location:</b> ${item.location}</p>
    <p><b>Price:</b> $${item.price} ${item.currency}</p>
    <p><b>Available From:</b> ${item.availableFrom}</p>
    <p><b>Delivery:</b> ${item.deliveryAvailable ? "Yes" : "No"}</p>
    <p><b>Description:</b> ${item.description}</p>

    <h3>Images</h3>
    <div style="display:flex;flex-wrap:wrap">${images}</div>
  </div>`;

  modal.style.display = "block";
}

/* ---------------- BOOKING ---------------- */

async function showBooking(id) {
  const item = await getListingById(id);

  let modal = document.getElementById("bookingModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "bookingModal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
  <div class="modal-content">
    <span class="close" onclick="bookingModal.style.display='none'">&times;</span>
    <h2>Book ${item.title}</h2>

    <label>Days</label>
    <input id="days" type="number" min="1" value="1">
    <p id="total">$${item.price}</p>

    <button onclick="confirmBooking('${id}', ${item.price})">Confirm</button>
  </div>`;

  modal.style.display = "block";

  document.getElementById("days").oninput = e => {
    document.getElementById("total").textContent =
      "$" + item.price * e.target.value;
  };
}

function confirmBooking(id, price) {
  alert("Booking confirmed for " + id);
  bookingModal.style.display = "none";
}

/* ---------------- INIT ---------------- */

document.addEventListener("DOMContentLoaded", renderGrid);
