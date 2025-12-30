(function () {

  /* ================= CONFIG ================= */
  const API_URL = "https://qthiq2pxzj.execute-api.us-east-1.amazonaws.com/Prod/chat";
  const DEFAULT_LANG = "en";
  const TYPING_DELAY_MS = 2000;
  const MAX_HISTORY = 50;

  /* ================= SITE DETECTION ================= */
  const hostname = window.location.hostname;
  let site = "containerbazar";
  let country = "IN";

  if (hostname.includes("containersclub")) {
    site = "containersclub";
    country = "US";
  }

  const HISTORY_KEY = `cb_chat_history_${site}`;

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

      <select id="cb-lang" title="Select language">
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="zh">中文</option>
        <option value="tl">Tagalog</option>
        <option value="vi">Tiếng Việt</option>
        <option value="fr">Français</option>
        <option value="ar">العربية</option>
        <option value="ko">한국어</option>
        <option value="ru">Русский</option>
        <option value="de">Deutsch</option>
        <option value="ht">Kreyòl</option>
        <option value="hi">हिन्दी</option>
        <option value="pt">Português</option>
        <option value="it">Italiano</option>
        <option value="pl">Polski</option>
        <option value="ja">日本語</option>
        <option value="ur">اردو</option>
        <option value="fa">فارسی</option>
        <option value="gu">ગુજરાતી</option>
        <option value="bn">বাংলা</option>
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
    restoreHistory();
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
  langSelect.onchange = () => localStorage.setItem("cb_lang", langSelect.value);

  /* ================= HISTORY HELPERS ================= */
  function saveMessage(role, text) {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    history.push({ role, text });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  }

  function restoreHistory() {
    messages.innerHTML = "";
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    history.forEach(m => addMessage(m.role, m.text, false));
  }

  /* ================= UI HELPERS ================= */
  function addMessage(cls, text, persist = true) {
    const div = document.createElement("div");
    div.className = cls;

    div.innerHTML = text.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;

    if (persist) {
      saveMessage(cls, text);
    }
  }

  let typingBubble = null;

  function showTyping() {
    typingBubble = document.createElement("div");
    typingBubble.className = "cb-bot cb-typing";
    typingBubble.innerText = "Typing…";
    messages.appendChild(typingBubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    if (typingBubble) {
      typingBubble.remove();
      typingBubble = null;
    }
  }

  function setInputDisabled(disabled) {
    input.disabled = disabled;
    sendBtn.disabled = disabled;
  }

  /* ================= SEND MESSAGE ================= */
  function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;

    addMessage("cb-user", msg);
    input.value = "";
    setInputDisabled(true);

    const language = localStorage.getItem("cb_lang") || DEFAULT_LANG;
    showTyping();

    setTimeout(async () => {
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_message: msg,
            site,
            country,
            language
          })
        });

        const data = await res.json();
        hideTyping();
        setInputDisabled(false);

        addMessage("cb-bot", data.reply || "Sorry, I could not understand that.");

      } catch (e) {
        console.error("Chatbot error:", e);
        hideTyping();
        setInputDisabled(false);
        addMessage("cb-bot", "Sorry, something went wrong.");
      }
    }, TYPING_DELAY_MS);
  }

  /* ================= EVENTS ================= */
  sendBtn.onclick = sendMessage;

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

})();
