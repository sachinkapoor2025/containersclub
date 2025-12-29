import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import * as XLSX from "https://esm.sh/xlsx@0.18.5?bundle";

const EXCEL_CANDIDATES = [
  "/info/Global_Container_Types_Expanded_110_With_Capacity_Images.xlsx",
  "/info/containers.xlsx"
];

function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

function readWorkbook(arrayBuffer){
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
}

function App(){
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [open, setOpen] = useState(null);

  useEffect(()=>{
    (async () => {
      let lastErr = "";
      for (const url of EXCEL_CANDIDATES){
        try{
          console.log("[INFO] Trying Excel:", url);
          const res = await fetch(url, { cache: "no-cache" });
          console.log("[INFO] Fetch status:", url, res.status, res.headers.get("content-type"));
          if (!res.ok) { lastErr = `HTTP ${res.status} for ${url}`; continue; }
          const buf = await res.arrayBuffer();
          const data = readWorkbook(buf);
          console.log("[INFO] Parsed rows:", data.length);
          if (Array.isArray(data) && data.length) {
            setRows(data);
            window.__EXCEL_ERROR__ = ""; // clear banner
            return;
          } else {
            lastErr = `Parsed zero rows from ${url}`;
          }
        }catch(e){
          console.error("[ERROR] Excel load error for", url, e);
          lastErr = String(e);
        }
      }
      const msg = `Could not load data. Tried: ${EXCEL_CANDIDATES.join(" , ")}. ${lastErr}`;
      console.error(msg);
      window.__EXCEL_ERROR__ = msg;               // show banner in index.html
      document.documentElement.setAttribute("data-error","1");
      const count = document.getElementById('count');
      if (count) count.textContent = "Showing 0 of 0 containers";
    })();
  },[]);

  const allCols = useMemo(()=> rows.length ? Object.keys(rows[0]) : [], [rows]);

  const facets = useMemo(()=>{
    const out = {};
    if (!rows.length) return out;
    for (const col of allCols){
      const vals = new Set(rows.map(r => String(r[col] ?? '').trim()).filter(Boolean));
      if (vals.size >= 2 && vals.size <= 50){
        out[col] = Array.from(vals).sort((a,b)=>a.localeCompare(b));
      }
    }
    return out;
  }, [rows, allCols]);

  const filtered = useMemo(()=>{
    const query = q.trim().toLowerCase();
    return rows.filter(r => {
      const matchesQuery = !query || allCols.some(c => String(r[c] ?? '').toLowerCase().includes(query));
      if (!matchesQuery) return false;
      for (const [col, selected] of Object.entries(filters)){
        if (!selected || selected.size===0) continue;
        const v = String(r[col] ?? '');
        if (!selected.has(v)) return false;
      }
      return true;
    });
  }, [rows, q, filters, allCols]);

  useEffect(()=>{
    if (!rows.length) return;
    const usp = new URLSearchParams(location.hash.replace(/^#/, ''));
    const id = usp.get('container');
    if (id){
      const item = rows.find(r => slugify(r['Container Name']) === id);
      if (item) setOpen(item);
    }
  }, [rows]);

  function toggle(col, v){
    setFilters(prev => {
      const next = { ...prev };
      const set = new Set(next[col] || []);
      set.has(v) ? set.delete(v) : set.add(v);
      next[col] = set;
      return next;
    });
  }
  function clear(col){
    setFilters(prev => { const n = { ...prev }; delete n[col]; return n; });
  }
  function openItem(item){
    setOpen(item);
    const slug = slugify(item['Container Name']);
    const url = new URL(location.href);
    url.hash = `container=${slug}`;
    history.replaceState({}, '', url.toString());
  }

  return React.createElement(React.Fragment, null,
    React.createElement(Header, { q, setQ }),
    React.createElement(Main,
      { rows: filtered, total: rows.length, facets, filters, toggle, clear, allCols, openItem },
    ),
    React.createElement(Drawer, { item: open, onClose: ()=>setOpen(null), allCols })
  );
}

function Header({ q, setQ }){
  useEffect(()=>{
    const qi = document.getElementById('q');
    qi.value = q;
    qi.oninput = (e)=> setQ(e.target.value);
  }, [q, setQ]);
  return null;
}

function Main({ rows, total, facets, filters, toggle, clear, allCols, openItem }){
  useEffect(()=>{
    const count = document.getElementById('count');
    const facetsEl = document.getElementById('facets');
    const tbody = document.querySelector('#tbl tbody');

    count.textContent = `Showing ${rows.length} of ${total} containers`;

    facetsEl.innerHTML = '';
    Object.entries(facets).forEach(([col, values])=>{
      const box = document.createElement('div');
      box.className = 'facet';
      const h = document.createElement('h4');
      h.textContent = col;
      const clearBtn = document.createElement('button');
      clearBtn.textContent = 'Clear';
      clearBtn.className = 'btn';
      clearBtn.style.cssText = 'background:#fff;color:#2563eb;border:1px solid var(--bd);margin-left:8px;padding:4px 8px;border-radius:8px;';
      clearBtn.onclick = ()=> clear(col);
      const head = document.createElement('div');
      head.style.display='flex'; head.style.justifyContent='space-between'; head.style.alignItems='center';
      head.appendChild(h); head.appendChild(clearBtn);
      const chips = document.createElement('div');
      chips.style.display='flex'; chips.style.flexWrap='wrap'; chips.style.gap='8px';
      values.forEach(v => {
        const b = document.createElement('button');
        const active = filters[col]?.has(v);
        b.className = 'chip' + (active ? ' active': '');
        b.textContent = v;
        b.onclick = ()=> toggle(col, v);
        chips.appendChild(b);
      });
      box.appendChild(head);
      box.appendChild(chips);
      facetsEl.appendChild(box);
    });

    tbody.innerHTML='';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      const td0 = document.createElement('td');
      const a = document.createElement('a');
      a.href = 'javascript:void(0)';
      a.className = 'inline';
      a.textContent = r['Container Name'] || '(unnamed)';
      a.onclick = ()=> openItem(r);
      td0.appendChild(a);
      tr.appendChild(td0);

      const add = (k)=>{ const td=document.createElement('td'); td.textContent= String(r[k]??''); tr.appendChild(td); };
      add('Type');
      add('Container Family');
      add('Dimension (External L×W×H)');
      add('Typical Capacity (Cubic Meters)');
      add('Max Gross Weight (kg)');
      add('Purpose/Use');
      tbody.appendChild(tr);
    });

  }, [rows, total, facets, filters, toggle, clear, allCols, openItem]);

  return null;
}

function Drawer({ item, onClose, allCols }){
  useEffect(()=>{ window.closeDrawer = onClose; }, [onClose]);

  useEffect(()=>{
    const dr = document.getElementById('drawer');
    const title = document.getElementById('drawer-title');
    const body = document.getElementById('drawer-body');
    if (!item){ dr.classList.remove('open'); document.body.classList.remove('drawer-open'); document.body.style.overflow=''; return; }
    dr.classList.add('open'); document.body.classList.add('drawer-open'); document.body.style.overflow='hidden'; dr.scrollTop = 0; window.scrollTo(0,0);
    title.textContent = item['Container Name'] || 'Details';
    body.innerHTML = '';

    const mediaWrap = document.createElement('div');
    mediaWrap.className='grid';
    const imgCard = document.createElement('div'); imgCard.className='kv';
    const vCard = document.createElement('div'); vCard.className='kv';

    const k1 = document.createElement('div'); k1.className='k'; k1.textContent='Images';
    const thumbs = document.createElement('div'); thumbs.className='thumbs';
    ['Image URL','Image URL 1','Image URL 2','Image URL 3'].forEach(k => {
      if (item[k]){
        const im = document.createElement('img');
        im.src = item[k]; im.alt = item['Container Name']; im.className='thumb';
        thumbs.appendChild(im);
      }
    });
    if (!thumbs.children.length){
      const miss = document.createElement('div'); miss.className='v'; miss.textContent='No images provided.';
      imgCard.appendChild(k1); imgCard.appendChild(miss);
    }else{
      imgCard.appendChild(k1); imgCard.appendChild(thumbs);
    }

    const k2 = document.createElement('div'); k2.className='k'; k2.textContent='Video';
    if (item['Video URL']){
      const vid = document.createElement('video'); vid.src = item['Video URL']; vid.controls = true;
      vCard.appendChild(k2); vCard.appendChild(vid);
    }else{
      const miss = document.createElement('div'); miss.className='v'; miss.textContent='No video URL provided.';
      vCard.appendChild(k2); vCard.appendChild(miss);
    }

    mediaWrap.appendChild(imgCard);
    mediaWrap.appendChild(vCard);
    body.appendChild(mediaWrap);

    const grid = document.createElement('div'); grid.className='grid';
    allCols.forEach(col => {
      const hiddenCols = new Set(['Video URL','Image URL','Image URL 1','Image URL 2','Image URL 3','Video','Images']);
      if (hiddenCols.has(String(col))) return;
      const kv = document.createElement('div'); kv.className='kv';
      const k = document.createElement('div'); k.className='k'; k.textContent = col;
      const v = document.createElement('div'); v.className='v'; v.textContent = String(item[col] ?? '').trim() || '—';
      kv.appendChild(k); kv.appendChild(v);
      grid.appendChild(kv);
    });
    body.appendChild(grid);
  }, [item, allCols]);

  return null;
}

createRoot(document.getElementById('root')).render(React.createElement(App));
