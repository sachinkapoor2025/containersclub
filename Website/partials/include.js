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

      // Prioritize header loading for better perceived performance
      const headerNode = document.querySelector('[data-include*="header"]');
      if (headerNode) {
        // Load header first
        const headerUrl = headerNode.getAttribute('data-include');
        try {
          const res = await fetch(headerUrl, {
            cache: 'default', // Allow browser caching for better performance
            priority: 'high' // Request high priority for header
          });
          if (res.ok) {
            const html = await res.text();
            headerNode.innerHTML = html;
            executeScripts(headerNode);
          }
        } catch (e) {
          console.error('Header include failed:', headerUrl, e);
        }
      }

      // Load remaining includes (footer, etc.) in parallel
      const remainingNodes = Array.from(nodes).filter(el =>
        !el.getAttribute('data-include')?.includes('header')
      );

      await Promise.all(remainingNodes.map(async el => {
        const url = el.getAttribute('data-include');
        if (!url) return;
        try {
          const res = await fetch(url, {
            cache: 'default' // Allow browser caching
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
          const html = await res.text();
          el.innerHTML = html;
          executeScripts(el);
        } catch (e) {
          console.error('Include failed:', url, e);
        }
      }));
    }

    function executeScripts(container) {
      // Execute any scripts inside the injected HTML more efficiently
      const scripts = container.querySelectorAll('script');
      scripts.forEach(old => {
        const scr = document.createElement('script');
        if (old.src) {
          scr.src = old.src;
          scr.async = old.async !== false; // Default to async for better performance
        } else {
          scr.textContent = old.textContent;
        }
        // Insert scripts at the end of body for better loading
        document.body.appendChild(scr);
        old.remove();
      });
    }
  
    document.addEventListener('DOMContentLoaded', () => {
      ensureGA();
      injectIncludes();
    });
  })();
