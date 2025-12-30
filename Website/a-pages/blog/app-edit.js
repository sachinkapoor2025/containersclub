// app-edit.js

const api = window.BLOG_API_BASE;
const uploadBase = window.BLOG_S3_UPLOAD_URL;

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

async function loadBlog() {
  const res = await fetch(api + "/blog/get?id=" + id);
  const blog = await res.json();

  document.getElementById("editTitle").value = blog.title;
  document.getElementById("editContent").value = blog.content;
}

loadBlog();

document.getElementById("editBlogForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("editTitle").value.trim();
  const content = document.getElementById("editContent").value.trim();

  const fileInput = document.getElementById("editCoverImage");
  let coverUrl = null;

  // Upload new image if selected
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const filename = Date.now() + "-" + file.name.replace(/\s+/g, "_");

    const uploadUrl = uploadBase + filename;

    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file
    });

    coverUrl = uploadUrl.split("?")[0];
  }

  // Update API
  const res = await fetch(api + "/blog/update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      title,
      content,
      coverUrl
    })
  });

  const json = await res.json();
  if (json.success) {
    window.location.href = `/blog/view.html?id=${id}`;
  } else {
    alert("Failed to update blog");
  }
});
