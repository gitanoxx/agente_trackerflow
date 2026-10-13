const messages = document.querySelector("#messages");
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message");
const status = document.querySelector("#status");
const summaryBox = document.querySelector("#summary-box");
let conversationId = localStorage.getItem("trackerflow-conversation");

function bubble(role, text) {
  const element = document.createElement("div");
  element.className = `bubble ${role}`;
  element.textContent = text;
  messages.append(element);
  messages.scrollTop = messages.scrollHeight;
}

async function request(path, options = {}) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error inesperado");
  return data;
}

async function createConversation() {
  const conversation = await request("/api/conversations", { method: "POST" });
  conversationId = conversation.id;
  localStorage.setItem("trackerflow-conversation", conversationId);
  messages.replaceChildren();
  summaryBox.hidden = true;
  bubble("assistant", "¡Hola! Soy el asistente virtual de Trackerflow. Ayudamos con landing pages, sitios web a medida y automatización de procesos. ¿Qué te gustaría desarrollar o mejorar?");
}

async function init() {
  try {
    const health = await request("/api/health");
    status.textContent = health.geminiConfigured ? `Gemini listo · ${health.model}` : "Falta configurar Gemini";
    status.className = `status ${health.geminiConfigured ? "ok" : "error"}`;
    if (conversationId) {
      try {
        const conversation = await request(`/api/conversations/${conversationId}`);
        if (conversation.messages.length) conversation.messages.forEach((m) => bubble(m.role, m.text));
        else bubble("assistant", "¡Hola! Soy el asistente virtual de Trackerflow. ¿Qué te gustaría desarrollar o mejorar?");
        return;
      } catch {}
    }
    await createConversation();
  } catch (error) {
    status.textContent = error.message;
    status.className = "status error";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  bubble("user", text);
  input.value = "";
  form.querySelector("button").disabled = true;
  try {
    const result = await request(`/api/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ message: text }) });
    bubble("assistant", result.reply);
  } catch (error) {
    bubble("assistant", `No pude responder: ${error.message}`);
  } finally {
    form.querySelector("button").disabled = false;
    input.focus();
  }
});

document.querySelector("#new-chat").addEventListener("click", createConversation);
document.querySelector("#summary").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    const result = await request(`/api/conversations/${conversationId}/summary`, { method: "POST" });
    summaryBox.textContent = result.summary;
    summaryBox.hidden = false;
  } catch (error) {
    summaryBox.textContent = error.message;
    summaryBox.hidden = false;
  } finally { event.currentTarget.disabled = false; }
});

init();
