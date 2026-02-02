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

function getUserEmail(auth) {
  if (!auth || !auth.id_token) return null;
  try {
    const payload = JSON.parse(atob(auth.id_token.split('.')[1]));
    return payload.email;
  } catch {
    return null;
  }
}

function refreshUI() {
  const auth = getAuth();
  const loggedIn = auth && !isExpired(auth);

  if (loginBtn)  loginBtn.style.display  = loggedIn ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = loggedIn ? "inline-block" : "none";

  // Update auth message
  const authMsgEl = document.getElementById("authMessage");
  if (authMsgEl) {
    if (loggedIn) {
      const email = getUserEmail(auth);
      authMsgEl.textContent = `Welcome ${email || 'User'}! You can now create and manage your listings.`;
    } else {
      authMsgEl.textContent = "Login is required to upload media and create listings.";
    }
  }

  // Show welcome message on index page
  const welcomeEl = document.getElementById("welcomeMessage");
  if (welcomeEl) {
    if (loggedIn) {
      const email = getUserEmail(auth);
      welcomeEl.textContent = `Welcome ${email || 'User'}!`;
      welcomeEl.style.display = "block";
    } else {
      welcomeEl.style.display = "none";
    }
  }

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

// ---- Upload file to S3 ----
async function uploadFile(file, type) {
  const presignRes = await api("/sell/presign-upload", {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream'
    })
  });
  const uploadUrl = presignRes.uploadUrl;
  const publicUrl = presignRes.publicUrl;

  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    }
  });

  return publicUrl;
}

// ---- Form submit ----
if (formEl) {
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const auth = getAuth();
    if (!auth || isExpired(auth)) { return login(); }

    try {
      // Upload images
      const imageFiles = formEl.querySelector('input[name="images"]').files;
      const imageUrls = [];
      for (let file of imageFiles) {
        const url = await uploadFile(file, 'image');
        imageUrls.push(url);
      }

      // Upload video if present
      let videoUrl = null;
      const videoFile = formEl.querySelector('input[name="video"]').files[0];
      if (videoFile) {
        videoUrl = await uploadFile(videoFile, 'video');
      }

      // Prepare JSON payload
      const payload = {
        title: formEl.querySelector('input[name="title"]').value,
        size: formEl.querySelector('select[name="size"]').value,
        condition: formEl.querySelector('select[name="condition"]').value,
        location: formEl.querySelector('input[name="location"]').value,
        description: formEl.querySelector('textarea[name="description"]').value,
        specs: formEl.querySelector('input[name="specs"]').value,
        price: formEl.querySelector('input[name="price"]').value,
        availabilityFrom: formEl.querySelector('input[name="availabilityFrom"]').value,
        images: imageUrls,
        video: videoUrl
      };

      const result = await authFetch(CONFIG.API_BASE + "/sell/listings", {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!result.ok) {
        const errorData = await result.json();
        throw new Error(errorData.error || 'Failed to create listing');
      }

      const data = await result.json();
      alert("Listing created successfully!");
      // Optionally reset form or redirect
      formEl.reset();
    } catch (err) {
      alert("Error creating listing: " + err.message);
    }
  });
}

function toggleDescription(link) {
  const p = link.parentElement;
  const short = p.querySelector('.short-desc');
  const full = p.querySelector('.full-desc');
  if (full.style.display === 'none') {
    full.style.display = 'inline';
    short.style.display = 'none';
    link.textContent = 'See Less';
  } else {
    full.style.display = 'none';
    short.style.display = 'inline';
    link.textContent = 'See More';
  }
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
  const imgHtml = images.map((img, idx) => `<img src="${img}" style="width:320px;height:240px;object-fit:cover;border-radius:10px;display:${idx === 0 ? 'block' : 'none'};">`).join('');

  return `
  <article class="card" style="display:flex;gap:20px;padding:20px;align-items:flex-start;">
    <div class="img-container" data-listing="${it.listingId}">
      ${imgHtml}
    </div>

    <div style="flex:1;">
      <h3 onclick="showDetails('${it.listingId}')" style="cursor:pointer;">${it.title}</h3>
      <p><strong>ID:</strong> ${it.listingId} • <strong>Status:</strong> ${it.status || 'N/A'}</p>
      <p><strong>Location:</strong> ${it.location} • <span style="color:#0ea5e9;font-weight:bold;font-size:18px;">$${it.price || 'N/A'}</span></p>
      <p><strong>Condition:</strong> ${it.condition} • <strong>Available:</strong> ${it.availableFrom || 'N/A'}</p>
      <p><strong>Delivery:</strong> ${it.deliveryAvailable ? 'Yes' : 'No'} • <strong>Owner:</strong> ${it.ownerId || 'N/A'}</p>
      <p><strong>Created:</strong> ${it.createdAt ? new Date(it.createdAt).toLocaleDateString() : 'N/A'}</p>
      <p class="description">
        <span class="short-desc">${it.description.slice(0,120)}${it.description.length > 120 ? '...' : ''}</span>
        <span class="full-desc" style="display:none;">${it.description}</span>
        ${it.description.length > 120 ? '<a href="#" onclick="toggleDescription(this); return false;" class="see-more">See More</a>' : ''}
      </p>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      <button onclick="showVideo()" style="padding:12px 24px;font-size:16px;">Video</button>
      <button class="primary" onclick="window.location.href='/sell/book.html?id=${it.listingId}&action=buy'" style="padding:12px 24px;font-size:16px;">Buy</button>
      <button class="secondary" onclick="window.location.href='/sell/book.html?id=${it.listingId}&action=lock'" style="padding:12px 24px;font-size:16px;background:#f59e0b;color:white;border:1px solid #f59e0b;">Lock Deal</button>
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

function showVideo() {
  let modal = document.getElementById("videoModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "videoModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content" style="max-width:800px;">
        <span class="close" onclick="videoModal.style.display='none'; document.querySelector('#videoModal video').pause();">&times;</span>
        <h2>Container Video</h2>
        <video controls autoplay style="width:100%;max-height:500px;">
          <source src="https://website-image-containersclub.s3.us-east-1.amazonaws.com/container.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.style.display = "block";
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

/* ---------------- FILTERS ---------------- */

async function populateFilters() {
  const data = await listListings();
  const locations = [...new Set(data.items.map(it => it.location).filter(Boolean))].sort();
  const locationSelect = document.getElementById("location");
  if (locationSelect) {
    locationSelect.innerHTML = '<option value="">Any location</option>' +
      locations.map(loc => `<option>${loc}</option>`).join("");
  }
}

function filterListings() {
  const q = document.getElementById("q").value.toLowerCase();
  const size = document.getElementById("size").value;
  const condition = document.getElementById("condition").value;
  const location = document.getElementById("location").value;

  const filtered = window.listings.filter(it => {
    if (q && !it.title.toLowerCase().includes(q) && !it.description.toLowerCase().includes(q) && !it.location.toLowerCase().includes(q)) return false;
    if (size && it.size !== size) return false;
    if (condition && it.condition !== condition) return false;
    if (location && it.location !== location) return false;
    return true;
  });

  renderGrid({ items: filtered });
}

/* ---------------- INIT ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
  await renderGrid();
  await populateFilters();

  // Filter event listeners
  document.getElementById("q").addEventListener("input", filterListings);
  document.getElementById("size").addEventListener("change", filterListings);
  document.getElementById("condition").addEventListener("change", filterListings);
  document.getElementById("location").addEventListener("change", filterListings);
  document.getElementById("searchBtn").addEventListener("click", filterListings);
});
