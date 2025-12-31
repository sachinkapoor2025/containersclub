/* ===============================
   SELL BOOK.JS - Container Purchase Page
   =============================== */

const CONFIG = {
  API_BASE: window.SELL_API_BASE || "https://o7e18622e2.execute-api.us-east-1.amazonaws.com/prod"
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

function getUserEmail(auth) {
  if (!auth || !auth.id_token) return null;
  try {
    const payload = JSON.parse(atob(auth.id_token.split('.')[1]));
    return payload.email;
  } catch {
    return null;
  }
}

function guessNameFromEmail(email) {
  if (!email) return null;

  // Extract part before @ and clean it up
  const username = email.split('@')[0];

  // Replace dots, underscores, hyphens with spaces
  let name = username.replace(/[._-]/g, ' ');

  // Capitalize each word
  name = name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Remove common email prefixes/suffixes
  name = name.replace(/\b(seo|admin|user|test|mail|email|contact|info|support|sales|marketing)\b/gi, '').trim();

  // If name is too short or empty, return null
  if (name.length < 2) return null;

  return name;
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

  // Update welcome message
  const welcomeEl = document.getElementById("welcomeMessage");
  if (welcomeEl) {
    if (loggedIn) {
      const email = getUserEmail(auth);
      const guessedName = guessNameFromEmail(email);
      if (guessedName) {
        welcomeEl.textContent = `Welcome ${guessedName}! Logged in as: ${email}`;
      } else {
        welcomeEl.textContent = `Welcome! Logged in as: ${email}`;
      }
      welcomeEl.style.display = "block";
    } else {
      welcomeEl.style.display = "none";
    }
  }
}

// ---- Auth actions ----
function login() {
  const containerId = new URLSearchParams(window.location.search).get("id");

  const redirectState = encodeURIComponent(
    JSON.stringify({
      returnTo: "/sell/book.html",
      id: containerId
    })
  );

  const cognitoLoginUrl =
    "https://sell-club-auth.auth.us-east-1.amazoncognito.com/oauth2/authorize" +
    "?client_id=3264ar1beegeb84aodivq3poeh" +
    "&response_type=token" +
    "&scope=openid+email+profile" +
    "&redirect_uri=https://containersclub.com/sell/new.html" +
    "&state=" + redirectState;

  window.location.href = cognitoLoginUrl;
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

  if (!listingId.startsWith('sell-')) {
    showError("Invalid container type for this page");
    return;
  }

  try {
    const item = await api(`/sell/listings/${listingId}`);

    // Update UI
    document.getElementById("containerTitle").textContent = item.title;
    document.getElementById("containerSize").textContent = item.size;
    document.getElementById("containerCondition").textContent = item.condition;
    document.getElementById("containerLocation").textContent = item.location;
    document.getElementById("containerAvailableFrom").textContent = item.availableFrom;
    document.getElementById("containerDescription").textContent = item.description;

    // Show price
    document.getElementById("containerPrice").textContent = `$${item.price}`;

    // Show details, form, and media section
    document.getElementById("containerDetails").style.display = "block";
    document.getElementById("bookingForm").style.display = "block";
    document.getElementById("loading").style.display = "none";

    // Store item for form submission
    window.currentItem = item;

    // Show images and video
    showMediaSection();

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

  // Show deal terms when Lock the Deal button is clicked
  const lockBtn = formEl.querySelector('button[value="lock"]');
  if (lockBtn) {
    lockBtn.addEventListener('click', (e) => {
      const dealTerms = document.getElementById('dealTerms');
      if (dealTerms) {
        dealTerms.style.display = 'block';
        // Scroll to terms
        dealTerms.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    const auth = getAuth();
    if (!auth || isExpired(auth)) {
      alert("Please login to complete purchase");
      return;
    }

    // Collect form data
    const formData = new FormData(formEl);
    const action = formData.get('action');

    let purchaseData;

    if (action === 'lock') {
      // Deal locking with 10% deposit
      const containerPrice = window.currentItem.price;
      const depositAmount = Math.round(containerPrice * 0.1); // 10% of price

      purchaseData = {
        listingId: window.currentItem.listingId,
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        deliveryMethod: formData.get('deliveryMethod'),
        addressLine1: formData.get('addressLine1'),
        addressLine2: formData.get('addressLine2'),
        city: formData.get('city'),
        state: formData.get('state'),
        zipCode: formData.get('zipCode'),
        specialRequests: formData.get('specialRequests'),
        lockDeal: true,
        depositAmount: depositAmount,
        totalCost: depositAmount
      };
    } else {
      // Full purchase
      purchaseData = {
        listingId: window.currentItem.listingId,
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        deliveryMethod: formData.get('deliveryMethod'),
        addressLine1: formData.get('addressLine1'),
        addressLine2: formData.get('addressLine2'),
        city: formData.get('city'),
        state: formData.get('state'),
        zipCode: formData.get('zipCode'),
        specialRequests: formData.get('specialRequests'),
        purchase: true,
        totalCost: window.currentItem.price
      };
    }

    try {
      let endpoint, successMessage;

      if (action === 'lock') {
        endpoint = '/sell/lock-deal';
        successMessage = `Deal locked successfully! You have 3 days to complete the remaining payment of $${Math.round(window.currentItem.price * 0.9)}.`;
      } else {
        endpoint = '/sell/purchase';
        successMessage = "Purchase completed successfully!";
      }

      // Submit request
      const result = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(purchaseData)
      });

      alert(successMessage);
      // Redirect or show confirmation
      window.location.href = "/";

    } catch (error) {
      console.error("Request error:", error);
      alert(`${action === 'lock' ? 'Deal locking' : 'Purchase'} failed: ${error.message}`);
    }
  });
}

// ---- Show Media Section ----
function showMediaSection() {
  const item = window.currentItem;
  if (!item) return;

  // Show images carousel
  if (item.images && item.images.length > 0) {
    setupImageCarousel(item.images);
    document.getElementById("imagesContainer").style.display = "block";
  }

  // Show videos carousel (using the same video for now, but can be extended for multiple videos)
  setupVideoCarousel([item.video || "https://website-image-containersclub.s3.us-east-1.amazonaws.com/container.mp4"]);
  document.getElementById("videosContainer").style.display = "block";

  // Show the media section
  document.getElementById("mediaSection").style.display = "block";
}

// ---- Image Carousel (5 images at a time) ----
function setupImageCarousel(images) {
  const track = document.getElementById("imagesTrack");
  const prevBtn = document.getElementById("imagesPrevBtn");
  const nextBtn = document.getElementById("imagesNextBtn");
  const container = document.getElementById("imagesContainer").querySelector(".carousel-container");

  // Create image items
  track.innerHTML = images.map((img, index) =>
    `<div class="carousel-item">
      <img src="${img}" alt="Container image ${index + 1}">
    </div>`
  ).join("");

  let currentIndex = 0;
  const itemsPerView = 5;
  const totalItems = images.length;
  const maxIndex = Math.max(0, totalItems - itemsPerView);

  function updateCarousel() {
    const translateX = -currentIndex * 156; // 150px width + 6px margin
    track.style.transform = `translateX(${translateX}px)`;

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex >= maxIndex;
  }

  // Add hover event listeners to manage zoom-active class
  const carouselItems = track.querySelectorAll('.carousel-item');
  carouselItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      container.classList.add('zoom-active');
    });
    item.addEventListener('mouseleave', () => {
      // Check if mouse is still over any carousel item
      const stillHovering = Array.from(carouselItems).some(item => item.matches(':hover'));
      if (!stillHovering) {
        container.classList.remove('zoom-active');
      }
    });
  });

  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateCarousel();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex < maxIndex) {
      currentIndex++;
      updateCarousel();
    }
  });

  updateCarousel();
}

// ---- Video Carousel (1 video at a time) ----
function setupVideoCarousel(videos) {
  const track = document.getElementById("videosTrack");
  const prevBtn = document.getElementById("videosPrevBtn");
  const nextBtn = document.getElementById("videosNextBtn");
  const container = document.getElementById("videosContainer").querySelector(".carousel-container");

  // Create video items
  track.innerHTML = videos.map((video, index) =>
    `<div class="carousel-item">
      <video controls>
        <source src="${video}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
    </div>`
  ).join("");

  let currentIndex = 0;
  const totalItems = videos.length;

  function updateCarousel() {
    const translateX = -currentIndex * 210; // 200px width + 10px margin
    track.style.transform = `translateX(${translateX}px)`;

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex >= totalItems - 1;
  }

  // Add hover event listeners to manage zoom-active class for videos
  const carouselItems = track.querySelectorAll('.carousel-item');
  carouselItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      container.classList.add('zoom-active');
    });
    item.addEventListener('mouseleave', () => {
      // Check if mouse is still over any carousel item or if a video is playing
      const stillHovering = Array.from(carouselItems).some(item => item.matches(':hover'));
      const videoPlaying = Array.from(carouselItems).some(item => item.querySelector('video.playing'));
      if (!stillHovering && !videoPlaying) {
        container.classList.remove('zoom-active');
      }
    });
  });

  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      // Pause current video and remove playing class
      const currentVideo = track.children[currentIndex].querySelector('video');
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.classList.remove('playing');
      }

      currentIndex--;
      updateCarousel();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex < totalItems - 1) {
      // Pause current video and remove playing class
      const currentVideo = track.children[currentIndex].querySelector('video');
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.classList.remove('playing');
      }

      currentIndex++;
      updateCarousel();
    }
  });

  // Add video event listeners for zoom effect
  const videoElements = track.querySelectorAll('video');
  videoElements.forEach(video => {
    video.addEventListener('play', () => {
      video.classList.add('playing');
      container.classList.add('zoom-active');
    });

    video.addEventListener('pause', () => {
      video.classList.remove('playing');
      // Check if any other video is still playing
      const stillPlaying = Array.from(videoElements).some(v => v.classList.contains('playing'));
      if (!stillPlaying) {
        // Check if mouse is still hovering
        const stillHovering = Array.from(carouselItems).some(item => item.matches(':hover'));
        if (!stillHovering) {
          container.classList.remove('zoom-active');
        }
      }
    });

    video.addEventListener('ended', () => {
      video.classList.remove('playing');
      // Check if any other video is still playing
      const stillPlaying = Array.from(videoElements).some(v => v.classList.contains('playing'));
      if (!stillPlaying) {
        // Check if mouse is still hovering
        const stillHovering = Array.from(carouselItems).some(item => item.matches(':hover'));
        if (!stillHovering) {
          container.classList.remove('zoom-active');
        }
      }
    });
  });

  updateCarousel();
}

// ---- Wire up ----
if (loginBtn) loginBtn.addEventListener("click", login);
if (logoutBtn) logoutBtn.addEventListener("click", logout);

// On load: capture tokens, refresh UI, load container
parseHashForTokens();
refreshUI();
loadContainerDetails();
setupForm();
