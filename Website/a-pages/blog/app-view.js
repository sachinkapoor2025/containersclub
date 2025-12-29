// app-view.js

const api = window.BLOG_API_BASE;

// Parse ID from URL
const params = new URLSearchParams(window.location.search);
const id = params.get("id");

async function loadBlog() {
  const res = await fetch(api + "/blog/get?id=" + id);
  const blog = await res.json();

  document.getElementById("blogTitle").innerText = blog.title;

  if (blog.coverUrl) {
    const cover = document.getElementById("blogCover");
    cover.src = blog.coverUrl;
    cover.style.display = "block";
  }

  document.getElementById("blogContent").innerHTML =
    blog.content.replace(/\n/g, "<br/>");
}

loadBlog();
