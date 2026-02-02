(async function () {
  // ------------ STATIC STATES + CITIES -------------
  const IN_STATE_CITIES = {
    "Alabama": [
      "Mobile",
      "Birmingham",
      "Huntsville",
      "Montgomery",
      "Tuscaloosa",
      "Daphne",
      "Fairhope",
      "Gulf Shores",
      "Mobile Bay"
    ],
    "Alaska": [
      "Anchorage",
      "Juneau",
      "Sitka",
      "Ketchikan",
      "Kodiak",
      "Valdez",
      "Nome",
      "Bethel"
    ],
    "Arizona": [
      "Phoenix",
      "Tucson",
      "Mesa",
      "Flagstaff",
      "Yuma",
      "Scottsdale",
      "Chandler"
    ],
    "Arkansas": [
      "Little Rock",
      "Fayetteville",
      "Fort Smith",
      "Jonesboro",
      "Helena"
    ],
    "California": [
      "Los Angeles",
      "Long Beach",
      "San Diego",
      "San Francisco",
      "Oakland",
      "Richmond",
      "Port Hueneme",
      "San Pedro",
      "Santa Barbara",
      "Monterey",
      "Sacramento",
      "Stockton",
      "Fresno",
      "Anaheim"
    ],
    "Colorado": [
      "Denver",
      "Colorado Springs",
      "Fort Collins",
      "Aurora"
    ],
    "Connecticut": [
      "New Haven",
      "Bridgeport",
      "Hartford",
      "Stamford",
      "Norwalk",
      "New London",
      "Groton"
    ],
    "Delaware": [
      "Wilmington",
      "Newark",
      "Dover",
      "Lewes",
      "New Castle"
    ],
    "Florida": [
      "Jacksonville",
      "Miami",
      "Port Everglades",
      "Tampa",
      "St. Petersburg",
      "Fort Lauderdale",
      "Pensacola",
      "Tallahassee",
      "Panama City",
      "Key West",
      "Fort Myers",
      "Cape Canaveral",
      "Port Canaveral"
    ],
    "Georgia": [
      "Savannah",
      "Brunswick",
      "Atlanta",
      "Augusta",
      "Columbus",
      "Macon"
    ],
    "Hawaii": [
      "Honolulu",
      "Hilo",
      "Kahului",
      "Kalaeloa",
      "Kailua-Kona",
      "Lihue"
    ],
    "Idaho": [
      "Boise",
      "Coeur d'Alene",
      "Lewiston"
    ],
    "Illinois": [
      "Chicago",
      "Peoria",
      "Springfield",
      "Rockford",
      "Quincy"
    ],
    "Indiana": [
      "Indianapolis",
      "Gary",
      "South Bend",
      "Evansville",
      "Michigan City"
    ],
    "Iowa": [
      "Des Moines",
      "Davenport",
      "Cedar Rapids",
      "Council Bluffs"
    ],
    "Kansas": [
      "Wichita",
      "Topeka",
      "Kansas City",
      "Dodge City"
    ],
    "Kentucky": [
      "Louisville",
      "Lexington",
      "Owensboro",
      "Paducah"
    ],
    "Louisiana": [
      "New Orleans",
      "Baton Rouge",
      "Lafayette",
      "Lake Charles",
      "Bossier City",
      "Shreveport",
      "Pointe a la Hache",
      "Grand Isle",
      "Port Fourchon",
      "Plaquemines Parish"
    ],
    "Maine": [
      "Portland",
      "Bangor",
      "Kennebunkport",
      "Rockland",
      "Bath",
      "Augusta"
    ],
    "Maryland": [
      "Baltimore",
      "Annapolis",
      "Salisbury",
      "Havre de Grace",
      "Cambridge",
      "Bowie"
    ],
    "Massachusetts": [
      "Boston",
      "Fall River",
      "New Bedford",
      "Quincy",
      "Weymouth",
      "Salem",
      "Gloucester",
      "Plymouth"
    ],
    "Michigan": [
      "Detroit",
      "Port Huron",
      "Ludington",
      "Muskegon",
      "Escanaba",
      "Marquette",
      "Sault Ste. Marie"
    ],
    "Minnesota": [
      "Duluth",
      "Minneapolis",
      "St. Paul",
      "Rochester"
    ],
    "Mississippi": [
      "Gulfport",
      "Biloxi",
      "Pascagoula",
      "Jackson",
      "Vicksburg"
    ],
    "Missouri": [
      "St. Louis",
      "Kansas City",
      "Springfield",
      "Sikeston"
    ],
    "Montana": [
      "Billings",
      "Missoula",
      "Great Falls"
    ],
    "Nebraska": [
      "Omaha",
      "Lincoln",
      "Kearney"
    ],
    "Nevada": [
      "Las Vegas",
      "Reno",
      "Henderson"
    ],
    "New Hampshire": [
      "Portsmouth",
      "Manchester",
      "Concord",
      "Nashua"
    ],
    "New Jersey": [
      "Newark",
      "Jersey City",
      "Bayonne",
      "Elizabeth",
      "Hoboken",
      "Camden",
      "Atlantic City",
      "Salem"
    ],
    "New Mexico": [
      "Albuquerque",
      "Santa Fe",
      "Las Cruces"
    ],
    "New York": [
      "New York",
      "Buffalo",
      "Rochester",
      "Syracuse",
      "Albany",
      "Schenectady",
      "Oswego",
      "Suffolk",
      "Niagara Falls",
      "Rochester Harbor"
    ],
    "North Carolina": [
      "Wilmington",
      "Morehead City",
      "New Bern",
      "Beaufort",
      "Jacksonville",
      "Charlotte",
      "Raleigh",
      "Greenville"
    ],
    "North Dakota": [
      "Fargo",
      "Bismarck",
      "Grand Forks"
    ],
    "Ohio": [
      "Cleveland",
      "Toledo",
      "Sandusky",
      "Ashtabula",
      "Portsmouth",
      "Columbus",
      "Cincinnati"
    ],
    "Oklahoma": [
      "Tulsa",
      "Oklahoma City",
      "Lawton"
    ],
    "Oregon": [
      "Portland",
      "Astoria",
      "Coos Bay",
      "Newport",
      "Eugene",
      "Salem"
    ],
    "Pennsylvania": [
      "Philadelphia",
      "Pittsburgh",
      "Erie",
      "Allentown",
      "Harrisburg",
      "Chester",
      "Bristol",
      "Marcus Hook"
    ],
    "Rhode Island": [
      "Providence",
      "Newport",
      "Wickford",
      "South Kingstown"
    ],
    "South Carolina": [
      "Charleston",
      "Georgetown",
      "Myrtle Beach",
      "Beaufort",
      "Hilton Head",
      "Mount Pleasant",
      "North Charleston"
    ],
    "South Dakota": [
      "Sioux Falls",
      "Rapid City",
      "Pierre"
    ],
    "Tennessee": [
      "Memphis",
      "Nashville",
      "Knoxville",
      "Chattanooga",
      "Johnson City"
    ],
    "Texas": [
      "Houston",
      "Galveston",
      "Corpus Christi",
      "Port Arthur",
      "Beaumont",
      "Brownsville",
      "Texas City",
      "San Antonio",
      "Dallas",
      "Fort Worth",
      "Port of Brownsville"
    ],
    "Utah": [
      "Salt Lake City",
      "Ogden",
      "Provo"
    ],
    "Vermont": [
      "Burlington",
      "Montpelier",
      "Rutland"
    ],
    "Virginia": [
      "Norfolk",
      "Virginia Beach",
      "Newport News",
      "Portsmouth",
      "Hampton",
      "Suffolk",
      "Richmond",
      "Hampton Roads",
      "Cape Charles"
    ],
    "Washington": [
      "Seattle",
      "Tacoma",
      "Everett",
      "Olympia",
      "Bellingham",
      "Anacortes",
      "Port Townsend"
    ],
    "West Virginia": [
      "Charleston",
      "Huntington",
      "Morgantown"
    ],
    "Wisconsin": [
      "Milwaukee",
      "Green Bay",
      "Duluth (served via MN)",
      "Superior"
    ],
    "Wyoming": [
      "Cheyenne",
      "Casper",
      "Laramie"
    ],
    // District / Territories
    "District of Columbia": ["Washington"],
    "Puerto Rico": ["San Juan", "Ponce", "Mayaguez", "Arecibo", "Fajardo", "Guayama", "Ceiba"],
    "Guam": ["Hagatna", "Agana Heights", "Tamuning"],
    "U.S. Virgin Islands": ["Charlotte Amalie", "Christiansted", "Frederiksted"],
    "American Samoa": ["Pago Pago"],
    "Northern Mariana Islands": ["Saipan", "Tinian", "Rota"]
  };

  // ---------------------------------- CONFIG / ELEMENTS ----------------------------------
  function waitForConfig(timeoutMs = 1200) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function check() {
        if (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) return resolve(window.APP_CONFIG);
        if (Date.now() - t0 > timeoutMs) return reject(new Error("APP_CONFIG not available"));
        setTimeout(check, 25);
      })();
    });
  }

  const container      = document.getElementById('portsContainer');
  const paginationEl   = document.getElementById('portsPagination');
  const btn            = document.getElementById('searchBtn');
  const resetBtn       = document.getElementById('resetBtn');

  const stateSel       = document.getElementById('stateSel');
  const citySel        = document.getElementById('citySel');
  const portSel        = document.getElementById('portSel');
  const pinSel         = document.getElementById('pinSel');
  const typeSel        = document.getElementById('typeSel');
  const nameQ          = document.getElementById('nameQ');

  const drawer         = document.getElementById('drawer');
  const backdrop       = document.getElementById('backdrop');
  const drawerBody     = document.getElementById('drawerBody');
  const drawerTitle    = document.getElementById('drawerTitle');
  const drawerClose    = document.getElementById('drawerClose');

  let base, endpoint;

  const PAGE_SIZE = 50;
  let ALL_PORTS = [];
  let CURRENT_FILTERED = [];
  let currentPage = 1;

  // ---------------------------------- HELPERS ----------------------------------
  async function api(path, params) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const res = await fetch(`${base}${path}${qs}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`API ${path} failed (${res.status})`);
    return res.json();
  }

  function fillSelect(sel, values, placeholder) {
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>` + (values || [])
      .map(v => `<option value="${v}">${v}</option>`).join("");
    sel.disabled = !(values && values.length);
  }

  function openDrawer(html, title = "Port details") {
    drawerTitle.textContent = title;
    drawerBody.innerHTML = html;
    drawer.classList.add('open');
    backdrop.classList.add('show');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('show');
  }
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  // ---------------------------------- DROPDOWN LOGIC ----------------------------------
  function loadStates() {
    const states = Object.keys(IN_STATE_CITIES).sort((a, b) => a.localeCompare(b));
    fillSelect(stateSel, states, "State");

    if (citySel) {
      citySel.innerHTML = '<option value="">City</option>';
      citySel.disabled = true;
    }
    if (portSel) {
      portSel.innerHTML = '<option value="">Port</option>';
      portSel.disabled = true;
    }
    if (pinSel) {
      pinSel.innerHTML  = '<option value="">Pincode</option>';
      pinSel.disabled = true;
    }

    const portTypes = ["major", "minor"];
    fillSelect(typeSel, portTypes, "Port type");
  }

  function onStateChange() {
    const state = stateSel.value;
    const cities = IN_STATE_CITIES[state] || [];
    fillSelect(citySel, cities, "City");

    if (portSel) {
      portSel.innerHTML = '<option value="">Port</option>';
      portSel.disabled = true;
    }
    if (pinSel) {
      pinSel.innerHTML  = '<option value="">Pincode</option>';
      pinSel.disabled = true;
    }

    currentPage = 1;
    runSearch();
  }

  function onCityChange() {
    const state = stateSel.value;
    const city  = citySel.value;

    if (!state || !city) {
      if (portSel) {
        portSel.innerHTML = '<option value="">Port</option>';
        portSel.disabled = true;
      }
      if (pinSel) {
        pinSel.innerHTML  = '<option value="">Pincode</option>';
        pinSel.disabled = true;
      }
      currentPage = 1;
      runSearch();
      return;
    }

    const subset = ALL_PORTS.filter(p =>
      (p.state || "").toLowerCase() === state.toLowerCase() &&
      (p.city || "").toLowerCase() === city.toLowerCase()
    );

    const names = [...new Set(subset.map(p => p.name).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    if (names.length) {
      fillSelect(portSel, names, "Port");
    } else if (portSel) {
      portSel.innerHTML = '<option value="">No port available</option>';
      portSel.disabled = true;
    }

    const pins = [...new Set(subset.map(p => p.pincode).filter(Boolean))];
    if (pins.length) {
      fillSelect(pinSel, pins.sort(), "Pincode");
    } else if (pinSel) {
      pinSel.innerHTML = '<option value="">Pincode</option>';
      pinSel.disabled = true;
    }

    currentPage = 1;
    runSearch();
  }

  // ---------------------------------- FILTERING + RENDER ----------------------------------
  function applyFilters() {
    let items = [...ALL_PORTS];

    const state   = stateSel.value.trim();
    const city    = citySel.value.trim();
    const port    = portSel ? portSel.value.trim() : "";
    const pin     = pinSel ? pinSel.value.trim() : "";
    const type    = typeSel ? typeSel.value.trim() : "";
    const nameTxt = nameQ.value.trim();

    if (state) {
      items = items.filter(p => (p.state || "").toLowerCase() === state.toLowerCase());
    }
    if (city) {
      items = items.filter(p => (p.city || "").toLowerCase() === city.toLowerCase());
    }

    const effectiveName = nameTxt || port;
    if (effectiveName) {
      items = items.filter(p => (p.name || "").toLowerCase() === effectiveName.toLowerCase());
    }

    if (pin) {
      items = items.filter(p => (p.pincode || "").toString() === pin);
    }

    if (type) {
      items = items.filter(p => (p.port_type || "").toLowerCase() === type.toLowerCase());
    }

    return items;
  }

  function renderPagination(totalItems) {
    if (!paginationEl) return;

    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    if (totalPages <= 1) {
      paginationEl.innerHTML = "";
      return;
    }

    let html = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <button class="secondary" data-page="prev"${currentPage === 1 ? ' disabled' : ''}>Prev</button>
      <span class="muted">Page ${currentPage} of ${totalPages}</span>
      <button class="secondary" data-page="next"${currentPage === totalPages ? ' disabled' : ''}>Next</button>
    </div>`;

    paginationEl.innerHTML = html;

    paginationEl.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-page');
        if (action === 'prev' && currentPage > 1) currentPage--;
        if (action === 'next' && currentPage < totalPages) currentPage++;
        renderList();
      });
    });
  }

  function renderList() {
    if (!Array.isArray(CURRENT_FILTERED) || CURRENT_FILTERED.length === 0) {
      container.innerHTML = "<p>No ports found.</p>";
      renderPagination(0);
      return;
    }

    renderPagination(CURRENT_FILTERED.length);

    const start = (currentPage - 1) * PAGE_SIZE;
    const end   = start + PAGE_SIZE;
    const items = CURRENT_FILTERED.slice(start, end);

    container.innerHTML = items.map(p => {
      const img = p.image_url && p.image_url.trim()
        ? p.image_url
        : "/assets/placeholder-port.jpg";

      const title = p.name || "Unnamed Port";
      const where = [p.city, p.state, p.country].filter(Boolean).join(", ");
      const pin = p.pincode ? ` - ${p.pincode}` : "";

      return `
        <article class="port-card" data-id="${p.id || ""}">
          <img class="port-img" src="${img}" alt="${title}" />
          <h3>${title}</h3>
          <p class="muted">${where}${pin}</p>
        </article>
      `;
    }).join("");

    // 🔍 Click → fetch full details from /ports/:id
    [...container.querySelectorAll('.port-card')].forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.getAttribute('data-id');
        if (!id) return;

        try {
          const detail = await api(`${endpoint}/${encodeURIComponent(id)}`);

          const img = detail.image_url && detail.image_url.trim()
            ? detail.image_url
            : "/assets/placeholder-port.jpg";

          const portName = detail.name || "Unnamed Port";
          const state    = detail.state || "";
          const city     = detail.city || "";
          const pin      = detail.pincode || "";
          const country  = detail.country || "";

          const description = detail.description || "";
          const portType    = (detail.port_type || "").toLowerCase();
          const portTypeLabel = portType
            ? portType.charAt(0).toUpperCase() + portType.slice(1)
            : "";

          // facilities – support array or Dynamo-style {L:[{S:""}]}
          let facilities = [];
          if (Array.isArray(detail.facilities)) {
            facilities = detail.facilities;
          } else if (detail.facilities && Array.isArray(detail.facilities.L)) {
            facilities = detail.facilities.L.map(x => x.S).filter(Boolean);
          }

          const facilitiesHtml = facilities.length
            ? `<ul>${facilities.map(f => `<li>${f}</li>`).join("")}</ul>`
            : "";

          const mapLine = [city, state, country].filter(Boolean).join(", ");
          const mapText = mapLine || "";

          const html = `
            <article class="port-card" style="box-shadow:none;border:0;margin:0">
              <img class="port-img" src="${img}" alt="${portName}" />
              <h2 style="margin:8px 0 8px">${portName}</h2>

              <p style="margin:4px 0;"><strong>Port Name:</strong> ${portName}</p>
              ${state ? `<p style="margin:4px 0;"><strong>State:</strong> ${state}</p>` : ""}
              ${city ? `<p style="margin:4px 0;"><strong>City:</strong> ${city}</p>` : ""}
              ${pin ? `<p style="margin:4px 0;"><strong>Pincode:</strong> ${pin}</p>` : ""}
              ${country ? `<p style="margin:4px 0;"><strong>Country:</strong> ${country}</p>` : ""}

              ${description
                ? `<p style="margin:12px 0 4px;"><strong>Detail:</strong> ${description}</p>`
                : ""}

              ${portTypeLabel
                ? `<p style="margin:4px 0;"><strong>Port Type:</strong> ${portTypeLabel}</p>`
                : ""}

              ${facilities.length
                ? `<p style="margin:12px 0 4px;"><strong>Facilities:</strong></p>${facilitiesHtml}`
                : ""}

              ${mapText
                ? `<p class="muted" style="margin-top:12px;">${mapText}${pin ? " - " + pin : ""}</p>`
                : ""}
            </article>
          `;

          openDrawer(html, portName);
        } catch (err) {
          console.error(err);
          openDrawer(`<p class="error">${err.message}</p>`, "Port details");
        }
      });
    });
  }

  function runSearch() {
    CURRENT_FILTERED = applyFilters();
    currentPage = 1;
    renderList();
  }

  function resetAll() {
    loadStates();
    if (nameQ) nameQ.value = "";
    if (typeSel) typeSel.value = "";
    if (citySel) citySel.value = "";
    if (portSel) portSel.value = "";
    if (pinSel) pinSel.value  = "";
    currentPage = 1;
    CURRENT_FILTERED = [...ALL_PORTS];
    renderList();
    closeDrawer();
  }

  // ---------------------------------- INITIAL LOAD ----------------------------------
  async function loadAllPorts() {
    container.innerHTML = "<p>Loading ports…</p>";
    try {
      const items = await api(endpoint);
      if (!Array.isArray(items)) {
        throw new Error("Ports API did not return an array");
      }
      ALL_PORTS = items;
      CURRENT_FILTERED = [...ALL_PORTS];
      currentPage = 1;
      renderList();
    } catch (err) {
      console.error(err);
      container.innerHTML = `<p class="error">${err.message}</p>`;
    }
  }

  // ---------------------------------- EVENTS ----------------------------------
  if (stateSel) stateSel.addEventListener('change', onStateChange);
  if (citySel)  citySel.addEventListener('change', onCityChange);

  if (portSel)  portSel.addEventListener('change', () => { currentPage = 1; runSearch(); });
  if (pinSel)   pinSel.addEventListener('change', () => { currentPage = 1; runSearch(); });
  if (typeSel)  typeSel.addEventListener('change', () => { currentPage = 1; runSearch(); });
  if (nameQ)    nameQ.addEventListener('input', () => { currentPage = 1; runSearch(); });

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentPage = 1;
      runSearch();
    });
  }

  if (resetBtn) resetBtn.addEventListener('click', resetAll);

  // ---------------------------------- BOOT ----------------------------------
  try {
    const cfg = await waitForConfig();
    base = (cfg.apiBaseUrl || "").replace(/\/$/, "");
    endpoint = cfg.portsEndpoint || "/ports";

    loadStates();
    await loadAllPorts();
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
    console.error(err);
  }
})();
