/* ===============================
   RENT BOOK.JS - Container Rental Booking Page
   =============================== */

const CONFIG = {
  API_BASE: window.RENT_API_BASE || "https://o7e18622e2.execute-api.us-east-1.amazonaws.com/prod"
};

// ---- Auth storage helpers ----
const AUTH_KEY = "cb_auth";

function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
  catch { return null; }
}

function isExpired(auth) {
  if (!auth || !auth.exp) return true;
  return Date.now() >= auth.exp - 5000;
}

// ---- DOM ----
const loginBtn  = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const formEl    = document.getElementById("bookingForm");

// ---- Parse tokens from Cognito hash ----
function parseHashForTokens() {
  if (!location.hash || location.hash.length < 2) return;
  const params = new URLSearchParams(location.hash.substring(1));
  const access  = params.get("access_token");
  const idToken = params.get("id_token");
  const type    = params.get("token_type") || "Bearer";
  const expires = parseInt(params.get("expires_in") || "3600", 10);

  if (access) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      access_token: access,
      id_token: idToken,
      token_type: type,
      exp: Date.now() + expires * 1000
    }));
    history.replaceState(null, "", location.pathname + location.search);
  }
}

// ---- UI state ----
function refreshUI() {
  const auth = getAuth();
  const loggedIn = auth && !isExpired(auth);

  if (loginBtn)  loginBtn.style.display  = loggedIn ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = loggedIn ? "inline-block" : "none";
}

// ---- Auth actions ----
function login() {
  const domain   = window.RENT_COGNITO_DOMAIN || window.COGNITO_DOMAIN;
  const clientId = window.RENT_COGNITO_CLIENT_ID || window.COGNITO_CLIENT_ID;
  const redirect = window.COGNITO_REDIRECT_URI_RENT || location.href;

  if (!domain || !clientId) {
    alert("Login not configured.");
    return;
  }

  const url = `${domain}/oauth2/authorize` +
    `?response_type=token` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&scope=${encodeURIComponent("openid profile email")}` +
    `&state=${encodeURIComponent(location.pathname + location.search)}`;

  location.assign(url);
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  refreshUI();
}

// ---- API helper ----
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

// ---- Load Container Details ----
async function loadContainerDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const listingId = urlParams.get('id');

  if (!listingId) {
    showError("No container ID provided");
    return;
  }

  if (!listingId.startsWith('rent-')) {
    showError("Invalid container type for this page");
    return;
  }

  try {
    const item = await api(`/rent/listings/${listingId}`);

    // Update UI
    document.getElementById("containerTitle").textContent = item.title;
    document.getElementById("containerSize").textContent = item.size;
    document.getElementById("containerCondition").textContent = item.condition;
    document.getElementById("containerLocation").textContent = item.location;
    document.getElementById("containerAvailableFrom").textContent = item.availableFrom;
    document.getElementById("containerDescription").textContent = item.description;

    // Show daily rate
    document.getElementById("containerPrice").textContent = `$${item.dailyRate}/day`;

    // Show details and form
    document.getElementById("containerDetails").style.display = "block";
    document.getElementById("bookingForm").style.display = "block";
    document.getElementById("loading").style.display = "none";

    // Store item for form submission
    window.currentItem = item;

  } catch (error) {
    console.error("Error loading container:", error);
    showError("Failed to load container details");
  }
}

function showError(message) {
  document.getElementById("error").textContent = message;
  document.getElementById("error").style.display = "block";
  document.getElementById("loading").style.display = "none";
}

// ---- Form handling ----
function setupForm() {
  if (!formEl) return;

  // Calculate days and total when dates change
  const startDateInput = document.querySelector('input[name="startDate"]');
  const endDateInput = document.querySelector('input[name="endDate"]');
  const daysInput = document.querySelector('input[name="days"]');

  function calculateTotal() {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);

    if (startDate && endDate && startDate <= endDate) {
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end dates
      daysInput.value = diffDays;

      const rate = window.currentItem?.dailyRate || 0;
      document.getElementById("totalCost").textContent = `$${diffDays * rate}`;
    }
  }

  startDateInput.addEventListener('change', calculateTotal);
  endDateInput.addEventListener('change', calculateTotal);

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    const auth = getAuth();
    if (!auth || isExpired(auth)) {
      alert("Please login to complete booking");
      return;
    }

    // Collect form data
    const formData = new FormData(formEl);
    const bookingData = {
      listingId: window.currentItem.listingId,
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      company: formData.get('company'),
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      days: parseInt(formData.get('days')),
      deliveryMethod: formData.get('deliveryMethod'),
      deliveryAddress: formData.get('deliveryAddress'),
      insurance: formData.get('insurance'),
      maintenance: formData.get('maintenance'),
      specialRequests: formData.get('specialRequests'),
      rental: true,
      dailyRate: window.currentItem.dailyRate,
      totalCost: parseInt(formData.get('days')) * window.currentItem.dailyRate
    };

    try {
      // Submit booking
      const result = await api('/rent/book', {
        method: 'POST',
        body: JSON.stringify(bookingData)
      });

      alert("Booking submitted successfully!");
      // Redirect or show confirmation
      window.location.href = "/";

    } catch (error) {
      console.error("Booking error:", error);
      alert("Booking failed: " + error.message);
    }
  });
}

// ---- Wire up ----
if (loginBtn) loginBtn.addEventListener("click", login);
if (logoutBtn) logoutBtn.addEventListener("click", logout);

// On load: capture tokens, refresh UI, load container
parseHashForTokens();
refreshUI();
loadContainerDetails();
setupForm();
