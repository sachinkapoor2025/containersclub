// rent/js/app.js

// ---- Config sanity ----
(function ensureConfig() {
  if (!window.COGNITO_DOMAIN || !window.COGNITO_CLIENT_ID) {
    console.warn("[auth] Missing COGNITO_DOMAIN / COGNITO_CLIENT_ID in /config.js");
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
  const domain   = window.COGNITO_DOMAIN;
  const clientId = window.COGNITO_CLIENT_ID;
  const redirect = window.COGNITO_REDIRECT_URI_RENT || location.href;
  const scope    = "openid profile email";

  if (!domain || !clientId) {
    alert("Login not configured. Please set COGNITO_DOMAIN and COGNITO_CLIENT_ID in /config.js");
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
  // const logoutUrl = `${window.COGNITO_DOMAIN}/logout?client_id=${encodeURIComponent(window.COGNITO_CLIENT_ID)}&logout_uri=${encodeURIComponent(window.COGNITO_REDIRECT_URI_RENT)}`;
  // location.assign(logoutUrl);
}

// ---- API helper (use for your POST/PUT uploads) ----
async function authFetch(url, options = {}) {
  const auth = getAuth();
  const headers = new Headers(options.headers || {});
  if (auth && !isExpired(auth)) {
    headers.set("Authorization", `Bearer ${auth.access_token}`);
  }
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  return fetch(url, { ...options, headers });
}

// Example: attach to your form submit later
// formEl.addEventListener("submit", async (e) => {
//   e.preventDefault();
//   const auth = getAuth();
//   if (!auth || isExpired(auth)) { return login(); }
//   // build FormData or JSON and call authFetch('<your-endpoint>', { method: 'POST', body: ... });
// });

// ---- Wire up ----
if (loginBtn)  loginBtn.addEventListener("click", login);
if (logoutBtn) logoutBtn.addEventListener("click", logout);

// On load: capture tokens (if redirected back) and refresh UI
parseHashForTokens();
refreshUI();
