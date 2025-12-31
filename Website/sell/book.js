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
  const domain   = window.SELL_COGNITO_DOMAIN;
  const clientId = window.SELL_COGNITO_CLIENT_ID;
  const redirect = window.COGNITO_REDIRECT_URI_SELL || location.href;

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

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    const auth = getAuth();
    if (!auth || isExpired(auth)) {
      alert("Please login to complete purchase");
      return;
    }

    // Collect form data
    const formData = new FormData(formEl);
    const purchaseData = {
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

    try {
      // Submit purchase
      const result = await api('/sell/purchase', {
        method: 'POST',
        body: JSON.stringify(purchaseData)
      });

      alert("Purchase submitted successfully!");
      // Redirect or show confirmation
      window.location.href = "/";

    } catch (error) {
      console.error("Purchase error:", error);
      alert("Purchase failed: " + error.message);
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
