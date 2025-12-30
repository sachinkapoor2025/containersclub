/* ===============================
   SELL APP.JS (FIXED, FULL)
   =============================== */

const CONFIG = {
  API_BASE: window.SELL_API_BASE || '/api'
};

/* ---------------- AUTH HELPERS ---------------- */

const AUTH_KEY = "cb_auth";

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function isExpired(auth) {
  if (!auth || !auth.exp) return true;
  return Date.now() >= auth.exp - 5000;
}

function authToken() {
  const auth = getAuth();
  return auth && !isExpired(auth) ? auth.access_token : null;
}

/* ---------------- API ---------------- */

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  const token = authToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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
  return api('/sell/listings');
}

/* ---------------- RENDER ---------------- */

function cardHtml(it) {
  const img = it.images?.[0] || '/media/placeholder.jpg';

  return `
  <article class="card" style="display:flex;gap:20px;padding:20px;">
    <img src="${img}" style="width:200px;height:140px;object-fit:cover;border-radius:10px;">

    <div style="flex:1;">
      <div class="badge">${it.size}</div>
      <h3>${it.title}</h3>
      <p><strong>${it.location}</strong> • <span style="color:#0ea5e9">$${it.price}</span></p>
      <p>${it.description.slice(0,120)}...</p>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      <button onclick="showDetails('${it.listingId}')">Details</button>
      <button class="primary" onclick="showBooking('${it.listingId}')">Book</button>
    </div>
  </article>`;
}

async function renderGrid() {
  const grid = document.getElementById('listingGrid');
  const data = await listListings();
  window.listings = data.items;
  grid.innerHTML = data.items.map(cardHtml).join('');
}

/* ---------------- DETAILS ---------------- */

async function getListingById(id) {
  return api(`/sell/listings/${id}`);
}

async function showDetails(id) {
  const item = await getListingById(id);

  let modal = document.getElementById('detailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  const images = item.images?.map(i =>
    `<img src="${i}" style="width:30%;margin:5px;border-radius:8px;">`
  ).join('');

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
    <p><b>Delivery:</b> ${item.deliveryAvailable ? 'Yes' : 'No'}</p>
    <p><b>Description:</b> ${item.description}</p>

    <h3>Images</h3>
    <div style="display:flex;flex-wrap:wrap">${images}</div>
  </div>`;

  modal.style.display = 'block';
}

/* ---------------- BOOKING ---------------- */

async function showBooking(id) {
  const item = await getListingById(id);

  let modal = document.getElementById('bookingModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bookingModal';
    modal.className = 'modal';
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

  modal.style.display = 'block';

  document.getElementById('days').oninput = e => {
    document.getElementById('total').textContent =
      '$' + (item.price * e.target.value);
  };
}

function confirmBooking(id, price) {
  alert('Booking confirmed for ' + id);
  bookingModal.style.display = 'none';
}

/* ---------------- INIT ---------------- */

document.addEventListener('DOMContentLoaded', renderGrid);
