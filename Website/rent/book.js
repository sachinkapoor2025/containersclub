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
      welcomeEl.textContent = `Welcome ${email || 'User'}!`;
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
      returnTo: "/rent/book.html",
      id: containerId
    })
  );

  const cognitoLoginUrl =
    "https://rent-club-auth.auth.us-east-1.amazoncognito.com/oauth2/authorize" +
    "?client_id=5tde7c3ddupmvr9c90417devc3" +
    "&response_type=token" +
    "&scope=openid+email+profile" +
    "&redirect_uri=https://containersclub.com/rent/new.html" +
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

    // Show deposit and monthly price
    const deposit = item.deposit || 0;
    const price = item.price || 0;
    const pricePeriod = item.pricePeriod || 'month';
    document.getElementById("containerPrice").textContent = `Deposit: $${deposit} | $${price}/${pricePeriod}`;

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

  // Calculate days and total when dates change
  const startDateInput = document.querySelector('input[name="startDate"]');
  const endDateInput = document.querySelector('input[name="endDate"]');
  const daysInput = document.querySelector('input[name="days"]');

  function calculateTotal() {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);

    if (startDate && endDate && startDate <= endDate) {
      // Calculate actual number of days between dates
      const diffTime = Math.abs(endDate - startDate);
      const actualDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end dates
      daysInput.value = actualDays;

      const deposit = window.currentItem?.deposit || 0;
      const monthlyPrice = window.currentItem?.price || 0;
      const daysInMonth = 30; // Standard assumption
      const dailyRate = monthlyPrice / daysInMonth;
      const total = deposit + (dailyRate * actualDays);
      document.getElementById("totalCost").textContent = `$${Math.round(total)}`;
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

      // Show images and video after successful booking
      showMediaSection();

      alert("Booking submitted successfully! Check out the container images and video below.");

    } catch (error) {
      console.error("Booking error:", error);
      alert("Booking failed: " + error.message);
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
