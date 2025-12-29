// app-new.js

const form = document.getElementById("newBlogForm");
const api = window.BLOG_API_BASE;
const uploadBase = window.BLOG_S3_UPLOAD_URL;

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const fileInput = document.getElementById("coverImage");
  let coverUrl = "";

  // Upload image if provided
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

  // API: Create Blog Post
  const res = await fetch(api + "/blog/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      content,
      coverUrl,
    })
  });

  const json = await res.json();

  if (json?.id) {
    window.location.href = `/blog/view.html?id=${json.id}`;
  } else {
    alert("Error creating blog post");
  }
});
