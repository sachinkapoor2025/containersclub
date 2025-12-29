(function () {

  /* ================= CONFIG ================= */
  const API_URL = "https://qthiq2pxzj.execute-api.us-east-1.amazonaws.com/Prod/chat";
  const DEFAULT_LANG = "en";

  /* ================= SITE DETECTION ================= */
  const hostname = window.location.hostname;
  let site = "containerbazar";
  let country = "IN";

  if (hostname.includes("containersclub")) {
    site = "containersclub";
    country = "US";
  }

  /* ================= CHAT LAUNCHER ================= */
  const launcher = document.createElement("div");
  launcher.id = "cb-chat-launcher";
  launcher.innerHTML = `
    <img src="/assets/container-icon.png" alt="Container">
    <span>Chat</span>
  `;

  /* ================= CHAT WINDOW ================= */
  const chatWindow = document.createElement("div");
  chatWindow.id = "cb-chat-window";
  chatWindow.innerHTML = `
    <div id="cb-chat-header">
      <span>Container Assistant</span>

      <!-- Language Selector -->
      <select id="cb-lang" title="Select language">
        <option value="en">English</option>
        <option value="es">Español (Spanish)</option>
        <option value="zh">中文 (Chinese)</option>
        <option value="tl">Tagalog</option>
        <option value="vi">Tiếng Việt (Vietnamese)</option>
        <option value="fr">Français (French)</option>
        <option value="ar">العربية (Arabic)</option>
        <option value="ko">한국어 (Korean)</option>
        <option value="ru">Русский (Russian)</option>
        <option value="de">Deutsch (German)</option>
        <option value="ht">Kreyòl Ayisyen (Haitian Creole)</option>
        <option value="hi">हिन्दी (Hindi)</option>
        <option value="pt">Português (Portuguese)</option>
        <option value="it">Italiano (Italian)</option>
        <option value="pl">Polski (Polish)</option>
        <option value="ja">日本語 (Japanese)</option>
        <option value="ur">اردو (Urdu)</option>
        <option value="fa">فارسی (Persian)</option>
        <option value="gu">ગુજરાતી (Gujarati)</option>
        <option value="bn">বাংলা (Bengali)</option>
      </select>

      <span id="cb-close" style="cursor:pointer;">✖</span>
    </div>

    <div id="cb-chat-messages"></div>

    <div id="cb-chat-input">
      <input id="cb-input" placeholder="Ask about containers…" />
      <button id="cb-send">Send</button>
    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(chatWindow);

  /* ================= TOGGLE ================= */
  launcher.onclick = () => {
    chatWindow.style.display = "flex";
  };

  document.getElementById("cb-close").onclick = () => {
    chatWindow.style.display = "none";
  };

  /* ================= ELEMENTS ================= */
  const messages = document.getElementById("cb-chat-messages");
  const input = document.getElementById("cb-input");
  const sendBtn = document.getElementById("cb-send");
  const langSelect = document.getElementById("cb-lang");

  /* ================= LANGUAGE PERSISTENCE ================= */
  langSelect.value = localStorage.getItem("cb_lang") || DEFAULT_LANG;

  langSelect.onchange = () => {
    localStorage.setItem("cb_lang", langSelect.value);
  };

  /* ================= UI HELPERS ================= */
  function addMessage(cls, text) {
    const div = document.createElement("div");
    div.className = cls;
    div.innerText = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  /* ================= SEND MESSAGE ================= */
  async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;

    addMessage("cb-user", msg);
    input.value = "";

    const language = localStorage.getItem("cb_lang") || DEFAULT_LANG;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_message: msg,
          site: site,
          country: country,
          language: language
        })
      });

      const data = await res.json();

      if (data.reply) {
        addMessage("cb-bot", data.reply);
      } else {
        addMessage("cb-bot", "Sorry, I could not understand that.");
      }

      if (data.actions && data.actions.redirect) {
        setTimeout(() => {
          window.location.href = data.actions.redirect;
        }, 2000);
      }

    } catch (e) {
      console.error("Chatbot error:", e);
      addMessage("cb-bot", "Sorry, something went wrong.");
    }
  }

  /* ================= EVENTS ================= */
  sendBtn.onclick = sendMessage;

  // ENTER = send, SHIFT + ENTER = newline
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

})();
