// rent/js/app.js

/* ===============================
   RENT APP.JS
   =============================== */

const CONFIG = {
  API_BASE: window.RENT_API_BASE || "/api"
};

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

// ---- File Validation Logic ----
function validateFile(file, allowedExtensions) {
  if (!file) return { valid: false, error: "No file provided" };

  const extension = file.name.toLowerCase().split('.').pop();
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`
    };
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File too large. Maximum size: 10MB"
    };
  }

  return { valid: true };
}

function validateImageFiles(files) {
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const errors = [];

  for (const file of files) {
    const validation = validateFile(file, allowedExtensions);
    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function validateVideoFile(file) {
  if (!file) return { valid: true }; // Video is optional

  const allowedExtensions = ['mp4'];
  return validateFile(file, allowedExtensions);
}

// ---- UI Toggle Logic ----
function toggleListingMode() {
  const modeRadios = document.querySelectorAll('input[name="listingMode"]');
  const normalForm = document.getElementById("listingForm");
  const bulkSection = document.getElementById("bulkListingSection");

  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'normal') {
        normalForm.style.display = 'block';
        bulkSection.style.display = 'none';
      } else {
        normalForm.style.display = 'none';
        bulkSection.style.display = 'block';
      }
    });
  });
}

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

  // File inputs are always enabled (don't depend on login)
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
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  }
  if (auth && !isExpired(auth)) {
    headers.set("Authorization", `Bearer ${auth.access_token}`);
  }
  return fetch(url, { ...options, headers });
}

// ---- Image/Video upload helper ----
async function uploadFilesToS3(files, progressCallback) {
  if (!files || files.length === 0) return [];

  // Step 2: Request pre-signed URLs
  const fileData = files.map(file => ({
    fileName: file.name,
    contentType: file.type
  }));

  const presignedResponse = await api('/rent/presign', {
    method: 'POST',
    body: JSON.stringify({
      listingType: "NORMAL",
      files: fileData
    })
  });

  // Step 3: Upload files directly to S3
  const uploadedUrls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const presignedUrl = presignedResponse.urls[i];

    if (progressCallback) {
      progressCallback(`Uploading ${file.name}...`);
    }

    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });

    if (!uploadResponse.ok) {
      throw new Error(`S3 upload failed for ${file.name}: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    uploadedUrls.push(presignedUrl.split('?')[0]); // Remove query params to get the final URL
  }

  return uploadedUrls;
}

// ---- Form submit ----
if (formEl) {
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const auth = getAuth();
    if (!auth || isExpired(auth)) { return login(); }

    try {
      const submitBtn = formEl.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;

      // Get form data
      const formData = new FormData(formEl);
      const imageFiles = formData.getAll('images').filter(f => f.size > 0);
      const videoFile = formData.get('video');

      // Step 1: User selects files - validate immediately
      const imageValidation = validateImageFiles(imageFiles);
      if (!imageValidation.valid) {
        alert("Image validation errors:\n" + imageValidation.errors.join("\n"));
        return;
      }

      if (videoFile && videoFile.size > 0) {
        const videoValidation = validateVideoFile(videoFile);
        if (!videoValidation.valid) {
          alert("Video validation error: " + videoValidation.error);
          return;
        }
      }

      // Collect all files to upload
      const allFiles = [...imageFiles];
      if (videoFile && videoFile.size > 0) {
        allFiles.push(videoFile);
      }

      if (allFiles.length === 0) {
        alert("Please select at least one image or video file.");
        return;
      }

      // Disable button and show progress
      submitBtn.disabled = true;

      // Step 2 & 3: Request pre-signed URLs and upload files
      const progressCallback = (message) => {
        submitBtn.textContent = message;
      };

      progressCallback('Requesting upload URLs...');
      const fileUrls = await uploadFilesToS3(allFiles, progressCallback);

      // Separate image and video URLs
      const imageUrls = imageFiles.length > 0 ? fileUrls.slice(0, imageFiles.length) : [];
      const videoUrl = videoFile && videoFile.size > 0 ? fileUrls[fileUrls.length - 1] : null;

      // Step 4: Create listing
      progressCallback('Creating listing...');

      const listingData = {
        title: formData.get('title'),
        size: formData.get('size'),
        condition: formData.get('condition'),
        location: formData.get('location'),
        description: formData.get('description'),
        specs: formData.get('specs'),
        images: imageUrls,
        video: videoUrl,
        price: parseFloat(formData.get('price')) || 0,
        pricePeriod: formData.get('pricePeriod'),
        deposit: parseFloat(formData.get('deposit')) || 0,
        minRentalDuration: parseInt(formData.get('minRentalDuration')) || 1,
        availableFrom: formData.get('availableFrom'),
        deliveryAvailable: formData.has('deliveryAvailable'),
        rentalTerms: formData.get('rentalTerms'),
        status: 'active',
        currency: 'USD'
      };

      const result = await authFetch(CONFIG.API_BASE + "/rent/listings", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(listingData)
      });

      // Success
      alert("Listing submitted successfully. It will be live once approved.");
      formEl.reset();

    } catch (err) {
      alert("Error creating listing: " + err.message);
    } finally {
      // Reset button state
      const submitBtn = formEl.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Publish Listing';
      submitBtn.disabled = false;
    }
  });
}

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
  return api("/rent/listings");
}

/* ---------------- RENDER ---------------- */

function cardHtml(it) {
  const images = it.images && it.images.length > 0 ? it.images : ["/rent/media/placeholder.jpg"];
  const imgHtml = images.map((img, idx) => `<img src="${img}" style="width:320px;height:240px;object-fit:cover;border-radius:10px;display:${idx === 0 ? 'block' : 'none'};">`).join('');

  return `
  <article class="card" style="display:flex;gap:20px;padding:20px;align-items:flex-start;">
    <div class="img-container" data-listing="${it.listingId}">
      ${imgHtml}
    </div>

    <div style="flex:1;">
      <h3 onclick="showDetails('${it.listingId}')" style="cursor:pointer;">${it.title}</h3>
      <p><strong>ID:</strong> ${it.listingId} • <strong>Status:</strong> ${it.status || 'N/A'}</p>
      <p><strong>Location:</strong> ${it.location} • <span style="color:#0ea5e9;font-weight:bold;font-size:18px;">Deposit: $${it.deposit || 'N/A'} | $${it.price || 'N/A'}/${it.pricePeriod || 'month'}</span></p>
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
      <button class="primary" onclick="window.location.href='/rent/book.html?id=${it.listingId}'" style="padding:12px 24px;font-size:16px;">Book</button>
    </div>
  </article>`;
}

async function renderGrid(listings = null) {
  const grid = document.getElementById("listingGrid");
  if (!grid) return;
  const data = listings || await listListings();
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

/* ---------------- DETAILS ---------------- */

async function getListingById(id) {
  return api(`/rent/listings/${id}`);
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
    <p><b>Price:</b> $${item.price}/${item.pricePeriod} ${item.currency}</p>
    <p><b>Deposit:</b> $${item.deposit}</p>
    <p><b>Min Rental Duration:</b> ${item.minRentalDuration} days</p>
    <p><b>Available From:</b> ${item.availableFrom}</p>
    <p><b>Delivery:</b> ${item.deliveryAvailable ? 'Yes' : 'No'}</p>
    <p><b>Status:</b> ${item.status}</p>
    <p><b>Description:</b> ${item.description}</p>
    ${item.rentalTerms ? `<p><b>Rental Terms:</b> ${item.rentalTerms}</p>` : ''}

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

    <label>Duration (${item.pricePeriod}s)</label>
    <input id="duration" type="number" min="${item.minRentalDuration || 1}" value="${item.minRentalDuration || 1}">
    <p id="total">$${item.price * (item.minRentalDuration || 1)}</p>

    <button onclick="confirmBooking('${id}', ${item.price})">Confirm</button>
  </div>`;

  modal.style.display = "block";

  document.getElementById("duration").oninput = e => {
    const duration = parseInt(e.target.value) || 1;
    const periods = item.pricePeriod === 'day' ? duration : item.pricePeriod === 'week' ? Math.ceil(duration / 7) : Math.ceil(duration / 30);
    document.getElementById("total").textContent = "$" + (item.price * periods);
  };
}

function confirmBooking(id, price) {
  const duration = parseInt(document.getElementById("duration").value) || 1;
  alert(`Booking confirmed for ${id} - Duration: ${duration} periods, Total: $${price * duration}`);
  bookingModal.style.display = "none";
}

/* ---------------- BULK LISTING ---------------- */

let currentBatchId = null;

async function handleBulkSubmit() {
  const auth = getAuth();
  if (!auth || isExpired(auth)) {
    alert("Please login first");
    return;
  }

  const excelFile = document.getElementById("bulkExcelFile").files[0];
  if (!excelFile) {
    alert("Please select an Excel file");
    return;
  }

  // Validate Excel file
  const validation = validateFile(excelFile, ['xlsx', 'xls']);
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  try {
    // Show loading
    const submitBtn = document.getElementById("submitBulkBtn");
    submitBtn.textContent = "Processing...";
    submitBtn.disabled = true;

    // Create bulk listing entry
    const bulkData = {
      type: "bulk",
      status: "processing"
    };

    const result = await api('/rent/bulk-listings', {
      method: 'POST',
      body: JSON.stringify(bulkData)
    });

    currentBatchId = result.batchId;

    // Update UI
    showBulkStatus("Excel uploaded successfully", "Your bulk listing is being processed. You will be notified once media upload is ready.");
    submitBtn.style.display = "none";

    // Show upload media button after delay (simulate processing)
    setTimeout(() => {
      document.getElementById("uploadBulkMediaBtn").style.display = "block";
      showBulkStatus("Ready for Media Upload", "Please upload images and videos for your bulk listings.");
    }, 3000);

  } catch (error) {
    console.error("Bulk listing error:", error);
    alert("Error creating bulk listing: " + error.message);
  } finally {
    const submitBtn = document.getElementById("submitBulkBtn");
    submitBtn.disabled = false;
  }
}

async function handleBulkMediaUpload() {
  const auth = getAuth();
  if (!auth || isExpired(auth)) {
    alert("Please login first");
    return;
  }

  if (!currentBatchId) {
    alert("No batch ID found. Please restart the bulk listing process.");
    return;
  }

  // Create file input for bulk media
  const mediaInput = document.createElement("input");
  mediaInput.type = "file";
  mediaInput.multiple = true;
  mediaInput.accept = "image/*,video/*";

  mediaInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      // Show loading
      const uploadBtn = document.getElementById("uploadBulkMediaBtn");
      uploadBtn.textContent = "Uploading...";
      uploadBtn.disabled = true;

      // Validate files
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      const videoFiles = files.filter(f => f.type.startsWith('video/'));

      const imageValidation = validateImageFiles(imageFiles);
      if (!imageValidation.valid) {
        alert("Image validation errors:\n" + imageValidation.errors.join("\n"));
        return;
      }

      // Validate videos (allow multiple)
      for (const video of videoFiles) {
        const validation = validateVideoFile(video);
        if (!validation.valid) {
          alert(`Video validation error: ${validation.error}`);
          return;
        }
      }

      // Upload all files to bulk path
      const allFiles = [...imageFiles, ...videoFiles];
      const fileUrls = await uploadBulkFilesToS3(allFiles, currentBatchId);

      // Separate URLs
      const imageUrls = imageFiles.length > 0 ? fileUrls.slice(0, imageFiles.length) : [];
      const videoUrls = videoFiles.length > 0 ? fileUrls.slice(imageFiles.length) : [];

      // Update bulk listing with media URLs
      await api(`/rent/bulk-listings/${currentBatchId}`, {
        method: 'PUT',
        body: JSON.stringify({
          images: imageUrls,
          videos: videoUrls,
          status: "pending_approval"
        })
      });

      showBulkStatus("Bulk listing pending approval", "Your bulk listing has been submitted and is pending approval. You will be notified once it's reviewed.");
      uploadBtn.style.display = "none";

    } catch (error) {
      console.error("Bulk media upload error:", error);
      alert("Error uploading media: " + error.message);
    } finally {
      const uploadBtn = document.getElementById("uploadBulkMediaBtn");
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload Media Files";
    }
  };

  mediaInput.click();
}

async function uploadBulkFilesToS3(files, batchId) {
  if (!files || files.length === 0) return [];

  const uploadedUrls = [];
  const uploadPromises = [];

  console.log(`Starting bulk upload of ${files.length} files for batch ${batchId}...`);

  for (const file of files) {
    const uploadPromise = (async () => {
      try {
        console.log(`Getting presigned URL for bulk file ${file.name}...`);

        // Get presigned URL for bulk upload
        const presignedResponse = await api('/rent/presign-upload', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            path: `rent/B-${batchId}/${file.type.startsWith('image/') ? 'images' : 'videos'}`
          })
        });

        console.log(`Got presigned URL for ${file.name}, uploading to S3...`);

        // Upload to S3 using presigned URL
        const uploadResponse = await fetch(presignedResponse.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type
          }
        });

        if (!uploadResponse.ok) {
          throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        console.log(`Successfully uploaded ${file.name} to bulk S3`);
        return presignedResponse.fileUrl;

      } catch (error) {
        console.error(`Bulk file upload failed for ${file.name}:`, error);
        throw new Error(`Failed to upload ${file.name}: ${error.message}`);
      }
    })();

    uploadPromises.push(uploadPromise);
  }

  try {
    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);
    console.log('All bulk files uploaded successfully:', results);
    return results;
  } catch (error) {
    console.error('One or more bulk file uploads failed:', error);
    throw error;
  }
}

function showBulkStatus(title, message) {
  const statusDiv = document.getElementById("bulkStatus");
  const titleEl = document.getElementById("bulkStatusTitle");
  const messageEl = document.getElementById("bulkStatusMessage");

  titleEl.textContent = title;
  messageEl.textContent = message;
  statusDiv.style.display = "block";
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
});

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

// Initialize UI toggles
toggleListingMode();

// Bulk listing event listeners
const submitBulkBtn = document.getElementById("submitBulkBtn");
const uploadBulkMediaBtn = document.getElementById("uploadBulkMediaBtn");

if (submitBulkBtn) submitBulkBtn.addEventListener("click", handleBulkSubmit);
if (uploadBulkMediaBtn) uploadBulkMediaBtn.addEventListener("click", handleBulkMediaUpload);

// On load: capture tokens (if redirected back) and refresh UI
parseHashForTokens();
refreshUI();
