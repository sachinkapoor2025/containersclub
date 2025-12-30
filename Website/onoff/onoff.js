// --- Country → states map (as you have) ---
const STATES = {
    IN: ["Andhra Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu & Kashmir","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"],
    US: ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","USna","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"],
    GB: ["England","Northern Ireland","Scotland","Wales"],
    AE: ["Abu Dhabi","Dubai","Sharjah","Ajman","Umm Al Quwain","Ras Al Khaimah","Fujairah"]
  };
  
  // --- Small helper to wait for config.js just in case it loads a hair later ---
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
  
  // --- DOM grabs ---
  const modeRadios       = document.querySelectorAll('input[name="mode"]');
  const countryCodeSel   = document.getElementById('countryCode');
  const stateSel         = document.getElementById('stateSelect');
  const checkBtn         = document.getElementById('checkPrices');
  const form             = document.getElementById('booking-form');
  const results          = document.getElementById('priceResults');
  const pricesContainer  = document.getElementById('pricesContainer');
  const portLabel        = document.getElementById('portLabel');
  
  // --- Render states for selected country ---
  function renderStates() {
    const cc = (countryCodeSel?.value || window.APP_CONFIG?.defaultCountryCode || "IN").toUpperCase();
    const list = STATES[cc] || [];
    if (stateSel) {
      stateSel.innerHTML = list.map(s => `<option value="${s}">${s}</option>`).join('');
    }
  }
  countryCodeSel?.addEventListener('change', renderStates);
  renderStates();
  
  // --- Toggle the label text (“Destination Port” vs “Origin Port”) robustly ---
  function setPortLabelText(txt) {
    if (!portLabel) return;
    // If first node is a text node, change it; else prepend one.
    const first = portLabel.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) {
      first.nodeValue = txt + " ";
    } else {
      portLabel.insertBefore(document.createTextNode(txt + " "), portLabel.firstChild);
    }
  }
  function updateModeLabel() {
    const m = document.querySelector('input[name="mode"]:checked')?.value || 'onload';
    setPortLabelText(m === 'onload' ? 'Destination Port' : 'Origin Port');
  }
  modeRadios.forEach(r => r.addEventListener('change', updateModeLabel));
  updateModeLabel();
  
  // --- Normalize helpers ---
  const toNum = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const toLc = v => (v || '').toString().trim().toLowerCase();
  const normalizeWhitespace = v => (v || '').toString().trim().replace(/\s+/g, ' ');
  
  // --- Main: Check prices ---
  checkBtn?.addEventListener('click', async () => {
    if (!form.reportValidity()) return;
    results.classList.remove('hidden');
    pricesContainer.innerHTML = '<p>Fetching prices…</p>';
  
    try {
      const cfg = await waitForConfig();
      const base = (cfg.apiBaseUrl || '').replace(/\/$/, '');
      const pricePath = cfg.priceEndpoint || '/prices';
      const bookPath  = cfg.bookingEndpoint || '/book';
  
      const payload = Object.fromEntries(new FormData(form).entries());
      // coercions
      payload.mode      = document.querySelector('input[name="mode"]:checked')?.value || 'onload';
      payload.country   = payload.countryCode || cfg.defaultCountryCode || 'IN';
      payload.state     = normalizeWhitespace(payload.state);
      payload.city      = normalizeWhitespace(payload.city);
      payload.port      = normalizeWhitespace(payload.port);
      payload.weightKg  = toNum(payload.weightKg);
      payload.lenCm     = toNum(payload.lenCm);
      payload.widCm     = toNum(payload.widCm);
      payload.htCm      = toNum(payload.htCm);
  
      // Build the route key expected by DynamoDB records
      // onload: "<state>-><port>" | offload: "<port>-><state>"
      const left  = toLc(payload.state);
      const right = toLc(payload.port);
      const route = payload.mode === 'onload' ? `${left}->${right}` : `${right}->${left}`;
  
      // Request body your Lambda expects (adjust if your backend needs different field names)
      const reqBody = {
        mode: payload.mode,
        route,
        country: payload.country,
        state: payload.state,
        city: payload.city,
        address: payload.address,
        weightKg: payload.weightKg,
        dimensions_cm: { l: payload.lenCm, w: payload.widCm, h: payload.htCm },
        mobile: payload.mobile,
        customerName: payload.customerName || '',
        companyName: payload.companyName || ''
      };
  
      const res = await fetch(`${base}${pricePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(reqBody)
      });
  
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Failed to fetch prices (${res.status}) ${txt ? '- ' + txt : ''}`);
      }
  
      const body = await res.json();
      const options = Array.isArray(body) ? body : (body?.options || []);
  
      if (!Array.isArray(options) || options.length === 0) {
        pricesContainer.innerHTML = "<p>No matching options. Try adjusting details.</p>";
        return;
      }
  
      // Render options
      pricesContainer.innerHTML = options.map((o, idx) => `
        <div class="price-card">
          <h3>${o.carrier || 'Carrier'} — ${o.vehicle_type || 'Truck'} — ${o.transit_days ?? '?'} day(s)</h3>
          <p><strong>Price:</strong> ${(o.currency || 'INR')} ${o.price ?? '-'}</p>
          <p class="muted">${o.notes || ''}</p>
          <button data-i="${idx}" class="bookBtn">Book this</button>
        </div>
      `).join('');
  
      // Booking handler
      document.querySelectorAll('.bookBtn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const idx = Number(e.currentTarget.getAttribute('data-i'));
          const selection = options[idx];
          try {
            const br = await fetch(`${base}${bookPath}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ form: reqBody, selection })
            });
            if (!br.ok) throw new Error(`Booking failed (${br.status})`);
            const data = await br.json().catch(() => ({}));
            alert('Booking created: ' + (data.booking_id || 'OK'));
          } catch (err) {
            console.error(err);
            alert('Booking failed. Please try again.');
          }
        });
      });
  
    } catch (err) {
      console.error(err);
      const hint = /cors|forbidden|403/i.test(err.message) ?
        `<br/><small class="muted">Tip: if this is a static site on CloudFront → API Gateway, make sure API has CORS enabled for <code>POST</code>, and CloudFront behavior for <code>/config.js</code> & assets returns the right Content-Type.</small>` : '';
      pricesContainer.innerHTML = `<p class="error">${err.message}</p>${hint}`;
    }
  });
  