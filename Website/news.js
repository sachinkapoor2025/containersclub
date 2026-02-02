(async function () {
  const list = document.getElementById('news-list');
  const metricStories = document.getElementById('metricStories');
  const metricSources = document.getElementById('metricSources');
  const metricUpdated = document.getElementById('metricUpdated');

  if (!list) return; // safety

  list.innerHTML = "<p>Loading news…</p>";

  const url = "https://qk9ob7wj3h.execute-api.ap-south-1.amazonaws.com/Stage/news";

  function toDate(v) {
    if (!v) return new Date();
    return new Date(v);
  }

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent || div.innerText || "";
  }

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Failed to fetch news (${res.status})`);

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      list.innerHTML = "<p>No news yet. Check back tomorrow.</p>";
      return;
    }

    metricStories.textContent = data.length.toString();
    const sources = new Set(data.map(i => i.source).filter(Boolean));
    metricSources.textContent = sources.size.toString();

    const latest = data.reduce((acc, item) => {
      const d = toDate(item.published_at);
      return d > acc ? d : acc;
    }, new Date(0));
    metricUpdated.textContent = latest.toLocaleString();

    list.innerHTML = data.map(item => {
      const when = toDate(item.published_at).toLocaleString();
      const link = item.url ?? item.link ?? "#";
      const tags = (item.tags || [])
        .map(t => `<span class="tag">${t}</span>`)
        .join(" ");
      const summary = stripHtml(item.summary).slice(0, 220) + "…";

      return `
        <article class="card">
          <h3><a href="${link}" target="_blank" rel="noopener">${item.title ?? ""}</a></h3>
          <p class="muted">${when}</p>
          <p>${summary}</p>
          <div class="tags">${tags}</div>
          <p class="source muted">Source: ${item.source ?? "Unknown"}</p>
        </article>
      `;
    }).join("");

  } catch (err) {
    console.error(err);
    list.innerHTML = `<p class="error">Error loading news: ${err.message}</p>`;
  }
})();
