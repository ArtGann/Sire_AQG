(function () {
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  if (!isLocal) return;

  var enabled = false;
  var pins = [];
  var style = document.createElement("style");
  style.textContent = [
    ".review-toggle{position:fixed;right:18px;bottom:18px;z-index:99990;border:0;border-radius:8px;background:#142022;color:#fff;padding:11px 14px;font:800 13px/1 system-ui,Arial,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.22);cursor:pointer}",
    ".review-toggle.is-on{background:#2f8b31}",
    ".review-toast{position:fixed;right:18px;bottom:66px;z-index:99990;max-width:320px;border-radius:8px;background:#fff;color:#142022;padding:12px 14px;font:700 13px/1.35 system-ui,Arial,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.18);border:1px solid #e5e9e5}",
    ".review-pin{position:absolute;z-index:99980;width:26px;height:26px;border-radius:50%;border:2px solid #fff;background:#2f8b31;color:#fff;font:900 12px/22px system-ui,Arial,sans-serif;text-align:center;box-shadow:0 8px 18px rgba(0,0,0,.24);transform:translate(-50%,-50%);pointer-events:auto}",
    ".review-modal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(6,19,22,.36);padding:20px}",
    ".review-card{width:min(420px,100%);border-radius:10px;background:#fff;padding:18px;box-shadow:0 22px 70px rgba(0,0,0,.28);font-family:system-ui,Arial,sans-serif}",
    ".review-card h2{margin:0 0 8px;color:#142022;font-size:20px;line-height:1.15}",
    ".review-card p{margin:0 0 12px;color:#536062;font-size:13px;line-height:1.4}",
    ".review-card textarea{width:100%;min-height:120px;resize:vertical;border:1px solid #d8dfda;border-radius:8px;padding:10px;font:500 14px/1.4 system-ui,Arial,sans-serif;color:#142022}",
    ".review-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}",
    ".review-actions button{border:0;border-radius:8px;padding:10px 13px;font:800 13px/1 system-ui,Arial,sans-serif;cursor:pointer}",
    ".review-save{background:#2f8b31;color:#fff}",
    ".review-cancel{background:#edf1ee;color:#142022}"
  ].join("");
  document.head.appendChild(style);

  var button = document.createElement("button");
  button.type = "button";
  button.className = "review-toggle";
  button.textContent = "Правки";
  document.body.appendChild(button);

  button.addEventListener("click", function () {
    enabled = !enabled;
    button.classList.toggle("is-on", enabled);
    button.textContent = enabled ? "Отметь место" : "Правки";
    toast(enabled ? "Кликни по месту на странице, где нужна правка." : "Режим правок выключен.");
  });

  document.addEventListener("click", function (event) {
    if (!enabled) return;
    if (event.target.closest(".review-toggle,.review-modal,.review-pin")) return;
    event.preventDefault();
    event.stopPropagation();
    openModal(event);
  }, true);

  fetch("/__review-notes")
    .then(function (res) { return res.ok ? res.json() : []; })
    .then(function (notes) { notes.forEach(addPin); })
    .catch(function () {});

  function openModal(event) {
    var target = event.target;
    var modal = document.createElement("div");
    modal.className = "review-modal";
    modal.innerHTML = [
      '<div class="review-card" role="dialog" aria-modal="true" aria-label="Добавить правку">',
      "<h2>Добавить правку</h2>",
      "<p>Опиши, что нужно изменить в отмеченном месте.</p>",
      '<textarea placeholder="Например: сделать кнопку зеленее, увеличить отступ, заменить текст..."></textarea>',
      '<div class="review-actions">',
      '<button class="review-cancel" type="button">Отмена</button>',
      '<button class="review-save" type="button">Сохранить</button>',
      "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(modal);

    var textarea = modal.querySelector("textarea");
    textarea.focus();
    modal.querySelector(".review-cancel").addEventListener("click", function () { modal.remove(); });
    modal.querySelector(".review-save").addEventListener("click", function () {
      var comment = textarea.value.trim();
      if (!comment) {
        textarea.focus();
        return;
      }
      var note = {
        page: location.pathname + location.search,
        x: Math.round(event.pageX),
        y: Math.round(event.pageY),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: Math.round(window.scrollX),
          scrollY: Math.round(window.scrollY)
        },
        selector: describeElement(target),
        elementText: (target.innerText || target.textContent || "").trim().replace(/\s+/g, " ").slice(0, 180),
        comment: comment
      };

      fetch("/__review-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("save failed");
          return res.json();
        })
        .then(function (data) {
          addPin(data.note);
          modal.remove();
          toast("Правка сохранена в review-notes.json");
        })
        .catch(function () {
          var fallback = JSON.parse(localStorage.getItem("aqgReviewNotes") || "[]");
          fallback.push(note);
          localStorage.setItem("aqgReviewNotes", JSON.stringify(fallback));
          addPin(note);
          modal.remove();
          toast("Сервер не принял заметку, сохранила в браузере.");
        });
    });
  }

  function addPin(note) {
    var pin = document.createElement("button");
    pin.type = "button";
    pin.className = "review-pin";
    pin.style.left = note.x + "px";
    pin.style.top = note.y + "px";
    pin.title = note.comment || "Правка";
    pin.textContent = String(pins.length + 1);
    pin.addEventListener("click", function () { toast(note.comment || "Правка"); });
    pins.push(pin);
    document.body.appendChild(pin);
  }

  function toast(message) {
    var old = document.querySelector(".review-toast");
    if (old) old.remove();
    var box = document.createElement("div");
    box.className = "review-toast";
    box.textContent = message;
    document.body.appendChild(box);
    window.setTimeout(function () { box.remove(); }, 3200);
  }

  function describeElement(el) {
    if (!el || el.nodeType !== 1) return "";
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 5) {
      var part = el.tagName.toLowerCase();
      if (el.id) {
        part += "#" + el.id;
        parts.unshift(part);
        break;
      }
      if (el.className && typeof el.className === "string") {
        var classes = el.className.trim().split(/\s+/).slice(0, 2);
        if (classes.length) part += "." + classes.join(".");
      }
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(" > ");
  }
})();
