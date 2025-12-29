(function () {
    const GA_ID = 'G-E34W2ET1VT';
  
    function ensureGA() {
      if (window.gtag) return;
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(s);
  
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){ dataLayer.push(arguments); };
      gtag('js', new Date());
      gtag('config', GA_ID);
    }
  
    async function injectIncludes() {
      const nodes = document.querySelectorAll('[data-include]');
      await Promise.all(Array.from(nodes).map(async el => {
        const url = el.getAttribute('data-include');
        if (!url) return;
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
          const html = await res.text();
          el.innerHTML = html;
  
          // Execute any scripts inside the injected HTML (e.g., header hamburger script)
          el.querySelectorAll('script').forEach(old => {
            const scr = document.createElement('script');
            if (old.src) { scr.src = old.src; scr.async = old.async; }
            else { scr.textContent = old.textContent; }
            document.body.appendChild(scr);
            old.remove();
          });
        } catch (e) {
          console.error('Include failed:', url, e);
        }
      }));
    }
  
    document.addEventListener('DOMContentLoaded', () => {
      ensureGA();
      injectIncludes();
    });
  })();
  