// app-list.js

const api = window.BLOG_API_BASE;

async function loadBlogs() {
  const res = await fetch(api + "/blog/list");
  const blogs = await res.json();

  const container = document.getElementById("blogList");
  container.innerHTML = "";

  blogs.forEach((b) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${b.coverUrl || '/images/default-cover.jpg'}" 
           style="width:100%;border-radius:6px;margin-bottom:8px"/>

      <h3>${b.title}</h3>
      <p class="sub">${(b.content || "").substring(0, 140)}...</p>

      <div style="display:flex;gap:8px;margin-top:10px">
        <a class="primary" href="/blog/view.html?id=${b.id}">View</a>
        <a class="secondary" href="/blog/edit.html?id=${b.id}">Edit</a>
      </div>
    `;

    container.appendChild(card);
  });
}

loadBlogs();
