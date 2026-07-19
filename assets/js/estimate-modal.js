(function () {
  if (window.__AQGEstimateModalInitialized) return;
  window.__AQGEstimateModalInitialized = true;

  const modal = document.querySelector(".estimate-modal");
  const dialog = modal?.querySelector(".estimate-modal__dialog");
  const form = modal?.querySelector(".estimate-modal__form");

  if (!modal || !dialog || !form) return;

  let lastFocusedTrigger = null;
  let resetTurnstileChallenge = () => {};

  const trackAnalytics = (eventName, properties = {}) => {
    const analytics = window.AQGAnalytics;
    if (!analytics) return;

    try {
      const context = { page_path: window.location.pathname, ...properties };
      if (typeof analytics.track === "function") analytics.track(eventName, context);
      else if (typeof analytics === "function") analytics(eventName, context);
    } catch {
      // Analytics must never interrupt the estimate flow.
    }
  };

  const safeSessionStorage = (operation, key, value = "") => {
    try {
      if (operation === "set") sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  };

  const fallbackClearFormStatus = (targetForm) => {
    targetForm.querySelector(".form-status")?.remove();
  };

  const fallbackShowFormStatus = (targetForm, message, type = "error") => {
    let status = targetForm.querySelector(".form-status");
    if (!status) {
      status = document.createElement("p");
      status.className = "form-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      targetForm.querySelector(".estimate-modal__actions")?.prepend(status);
    }
    status.textContent = message;
    status.dataset.type = type;
  };

  const fallbackSetButtonLoading = (button, isLoading) => {
    if (!button) return;
    if (isLoading) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Sending...";
      return;
    }

    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  };

  const fallbackValidateControls = (controls) => {
    const invalidControl = controls.find((control) => !control.checkValidity());
    if (!invalidControl) return true;
    invalidControl.reportValidity();
    invalidControl.focus();
    return false;
  };

  const getServices = (targetForm) => {
    const serviceControl = targetForm.elements.namedItem("service");
    if (!serviceControl) return [];

    if (serviceControl instanceof HTMLSelectElement) {
      return Array.from(serviceControl.selectedOptions)
        .map((option) => option.value)
        .filter(Boolean);
    }

    return Array.from(targetForm.querySelectorAll("[name='service']:checked"))
      .map((control) => control.value)
      .filter(Boolean);
  };

  const fallbackBuildLeadPayload = (targetForm) => {
    const data = new FormData(targetForm);
    const value = (name) => String(data.get(name) || "").trim();
    return {
      full_name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      zip_code: String(data.get("zip") || "").trim(),
      service_needed: getServices(targetForm),
      calculator_requested: value("calculator_requested") === "true",
      home_stories: value("stories"),
      square_feet: value("square_feet"),
      gutter_size: value("gutter_size"),
      include_gutters: data.get("include_gutters") === "true",
      include_guards: data.get("include_guards") === "true",
      include_fascia: data.get("include_fascia") === "true",
      include_soffit: data.get("include_soffit") === "true",
      include_downspouts: data.get("include_downspouts") === "true",
      include_connectors: data.get("include_connectors") === "true",
      guard_type: value("guard_type"),
      miter_count: value("miter_count"),
      downspout_count: value("downspout_count"),
      property_address: value("address"), preferred_date: value("preferred_date"), comments: value("message"),
      idempotency_key: value("idempotency_key"), turnstile_token: value("turnstile_token"), lead_session_token: value("lead_session_token"), website: value("website"), uploaded_photos: [],
      sms_consent: data.get("sms_consent") === "true",
      landing_page_url: window.location.href,
      page_form_source: "Website Estimate Form"
    };
  };

  const fallbackPostLeadPayload = async (payload) => {
    const response = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let result = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok) {
      const error = new Error(result.message || "We couldn't send your estimate request. Please try again.");
      error.code = result.code || "lead_request_failed";
      throw error;
    }

    return result;
  };

  const fallbackRedirectToThankYou = async (targetForm) => {
    const thankYouUrl = targetForm.getAttribute("action") || "/thank-you.html";
    try {
      const response = await fetch(thankYouUrl, { method: "HEAD" });
      if (response.ok) {
        window.location.href = thankYouUrl;
        return;
      }
    } catch {
      // Static previews without a thank-you page fall through to the success message.
    }
    showStatus(targetForm, "Thank you. Your estimate request was sent successfully.", "success");
  };

  const clearStatus =
    typeof clearFormStatus === "function" ? clearFormStatus : fallbackClearFormStatus;
  const showStatus =
    typeof showFormStatus === "function" ? showFormStatus : fallbackShowFormStatus;
  const setLoading =
    typeof setButtonLoading === "function" ? setButtonLoading : fallbackSetButtonLoading;
  const validateFormControls =
    typeof validateControls === "function" ? validateControls : fallbackValidateControls;
  const buildPayload =
    typeof buildLeadPayload === "function" ? buildLeadPayload : fallbackBuildLeadPayload;
  const postPayload =
    typeof postLeadPayload === "function" ? postLeadPayload : fallbackPostLeadPayload;
  const redirectToThankYou =
    typeof redirectToThankYouOrShowSuccess === "function"
      ? redirectToThankYouOrShowSuccess
      : fallbackRedirectToThankYou;

  const normalizeCtaText = (value) =>
    value
      .replace(/\u0420\u00b0|\u0440\u00b0/g, "a")
      .replace(/[\u0410\u0430]/g, "a")
      .replace(/[>\u203a\u00bb\u2192]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const estimateCtaPattern =
    /^(get\s+(?:a\s+)?free\s+estimate|request\s+(?:an\s+)?estimate|request\s+free\s+estimate|free\s+estimate|get\s+quote|request\s+quote|start\s+free\s+estimate)$/;

  const isEstimateTrigger = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.closest(".estimate-modal")) return false;

    const href = element.getAttribute("href") || "";
    if (/^(tel:|mailto:)/i.test(href)) return false;

    if (element.hasAttribute("data-open-estimate-modal")) return true;
    return estimateCtaPattern.test(normalizeCtaText(element.textContent || ""));
  };

  const getFocusables = () =>
    Array.from(
      dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element instanceof HTMLElement && element.offsetParent !== null);

  const focusFirstField = () => {
    const firstField = form.querySelector(
      ".custom-select__button, input:not([type='hidden']):not([disabled]), textarea:not([disabled]), button:not([disabled])"
    );
    if (firstField instanceof HTMLElement) firstField.focus({ preventScroll: true });
  };

  const openModal = (trigger) => {
    lastFocusedTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    trackAnalytics("estimate_form_open", {
      cta_text: trigger instanceof HTMLElement ? normalizeCtaText(trigger.textContent || "") : "direct"
    });
    window.setTimeout(focusFirstField, 40);
  };

  const closeModal = () => {
    if (!modal.classList.contains("is-open")) return;

    if (typeof closeAllCustomSelects === "function") closeAllCustomSelects();
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    if (lastFocusedTrigger instanceof HTMLElement && lastFocusedTrigger.isConnected) {
      lastFocusedTrigger.focus({ preventScroll: true });
    }
  };

  const bindEstimateTriggers = () => {
    document.querySelectorAll("a, button, [data-open-estimate-modal]").forEach((element) => {
      if (!isEstimateTrigger(element) || element.dataset.estimateModalBound === "true") return;
      element.dataset.estimateModalBound = "true";
      element.addEventListener("click", (event) => {
        event.preventDefault();
        openModal(element);
      });
    });
  };

  modal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches(".estimate-modal__overlay") || target.closest(".estimate-modal__close")) {
      event.preventDefault();
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!modal.classList.contains("is-open")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key !== "Tab") return;

    const focusables = getFocusables();
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const initDatePicker = () => {
    const dateInput = form.querySelector("[data-date-picker]");
    const datePicker = form.querySelector(".date-picker");
    if (!(dateInput instanceof HTMLInputElement) || !datePicker) return () => true;

    let calendarViewDate = new Date();
    let selectedEstimateDate = null;
    const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const formatUSDate = (date) => {
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${month}/${day}/${date.getFullYear()}`;
    };

    const parseUSDate = (value) => {
      const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) return null;

      const month = Number(match[1]);
      const day = Number(match[2]);
      const year = Number(match[3]);
      const parsedDate = new Date(year, month - 1, day);

      if (
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
      ) {
        return null;
      }

      return parsedDate;
    };

    const setDateValidity = () => {
      if (!dateInput.value.trim()) {
        dateInput.setCustomValidity("");
        return true;
      }

      const parsedDate = parseUSDate(dateInput.value);
      const valid = parsedDate && window.AQGEstimateCore?.validDate(dateInput.value);
      dateInput.setCustomValidity(valid ? "" : "Please choose a future Monday through Saturday appointment date.");
      return Boolean(valid);
    };

    const isSameDay = (firstDate, secondDate) =>
      firstDate &&
      secondDate &&
      firstDate.getFullYear() === secondDate.getFullYear() &&
      firstDate.getMonth() === secondDate.getMonth() &&
      firstDate.getDate() === secondDate.getDate();

    const closeDatePicker = () => {
      datePicker.hidden = true;
      dateInput.setAttribute("aria-expanded", "false");
    };

    const renderDatePicker = () => {
      const viewYear = calendarViewDate.getFullYear();
      const viewMonth = calendarViewDate.getMonth();
      const firstDate = new Date(viewYear, viewMonth, 1);
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const today = new Date();

      const header = document.createElement("div");
      header.className = "date-picker__header";

      const prevButton = document.createElement("button");
      prevButton.type = "button";
      prevButton.className = "date-picker__nav";
      prevButton.dataset.dateNav = "prev";
      prevButton.setAttribute("aria-label", "Previous month");
      prevButton.textContent = "<";

      const caption = document.createElement("strong");
      caption.textContent = monthFormatter.format(calendarViewDate);

      const nextButton = document.createElement("button");
      nextButton.type = "button";
      nextButton.className = "date-picker__nav";
      nextButton.dataset.dateNav = "next";
      nextButton.setAttribute("aria-label", "Next month");
      nextButton.textContent = ">";

      header.append(prevButton, caption, nextButton);

      const weekdaysRow = document.createElement("div");
      weekdaysRow.className = "date-picker__weekdays";
      weekdays.forEach((weekday) => {
        const label = document.createElement("span");
        label.textContent = weekday;
        weekdaysRow.append(label);
      });

      const daysGrid = document.createElement("div");
      daysGrid.className = "date-picker__days";

      for (let index = 0; index < firstDate.getDay(); index += 1) {
        const emptyCell = document.createElement("span");
        emptyCell.className = "date-picker__empty";
        daysGrid.append(emptyCell);
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(viewYear, viewMonth, day);
        const dayButton = document.createElement("button");
        dayButton.type = "button";
        dayButton.dataset.dateValue = formatUSDate(date);
        dayButton.textContent = String(day);

        const available = window.AQGEstimateCore?.validDate(formatUSDate(date));
        dayButton.disabled = !available;
        if (isSameDay(date, today)) dayButton.classList.add("is-today");
        if (isSameDay(date, selectedEstimateDate)) dayButton.classList.add("is-selected");

        daysGrid.append(dayButton);
      }

      datePicker.replaceChildren(header, weekdaysRow, daysGrid);
    };

    const openDatePicker = () => {
      const typedDate = parseUSDate(dateInput.value);
      selectedEstimateDate = typedDate || selectedEstimateDate;

      if (selectedEstimateDate) {
        calendarViewDate = new Date(selectedEstimateDate.getFullYear(), selectedEstimateDate.getMonth(), 1);
      } else {
        const today = new Date();
        calendarViewDate = new Date(today.getFullYear(), today.getMonth(), 1);
      }

      renderDatePicker();
      datePicker.hidden = false;
      dateInput.setAttribute("aria-expanded", "true");
    };

    dateInput.addEventListener("focus", openDatePicker);
    dateInput.addEventListener("click", openDatePicker);
    dateInput.addEventListener("input", () => {
      const typedDate = parseUSDate(dateInput.value);
      if (typedDate) selectedEstimateDate = typedDate;
      setDateValidity();
    });
    dateInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        openDatePicker();
      }
      if (event.key === "Escape") closeDatePicker();
    });

    datePicker.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.dataset.dateNav === "prev") {
        calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
        renderDatePicker();
        return;
      }

      if (target.dataset.dateNav === "next") {
        calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
        renderDatePicker();
        return;
      }

      if (target.dataset.dateValue) {
        selectedEstimateDate = parseUSDate(target.dataset.dateValue);
        dateInput.value = target.dataset.dateValue;
        dateInput.setCustomValidity("");
        dateInput.dispatchEvent(new Event("input", { bubbles: true }));
        closeDatePicker();
      }
    });

    document.addEventListener("click", (event) => {
      if (event.target === dateInput || datePicker.contains(event.target)) return;
      closeDatePicker();
    });

    return setDateValidity;
  };

  const initPhotoUpload = () => {
    const photoInput = form.querySelector("#estimate-photos");
    const dropZone = form.querySelector(".drop-zone");
    const previewArea = form.querySelector(".photo-previews");
    const uploadError = form.querySelector(".photo-upload__error");
    if (!(photoInput instanceof HTMLInputElement) || !dropZone || !previewArea || !uploadError) return null;

    const maxPhotos = Number(window.AQGEstimateCore?.MAX_PHOTOS || 10);
    const maxPhotoBytes = Number(window.AQGEstimateCore?.MAX_PHOTO_BYTES || 10 * 1024 * 1024);
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const allowedExtensions = /\.(jpe?g|png|webp)$/i;
    let selectedPhotos = [];

    const fingerprint = (file) => [file.name, file.type, file.size, file.lastModified].join(":");
    const nextSlot = () => {
      const used = new Set(selectedPhotos.map((entry) => entry.slot));
      for (let slot = 0; slot < maxPhotos; slot += 1) if (!used.has(slot)) return slot;
      return -1;
    };

    const syncPhotoInput = () => {
      if (typeof DataTransfer === "undefined") return;
      try {
        const transfer = new DataTransfer();
        selectedPhotos.forEach((entry) => transfer.items.add(entry.file));
        photoInput.files = transfer.files;
      } catch {
        // The internal selection remains authoritative in older browsers.
      }
    };

    const renderPhotoPreviews = () => {
      previewArea.querySelectorAll("[data-object-url]").forEach((preview) => {
        URL.revokeObjectURL(preview.dataset.objectUrl);
      });
      previewArea.replaceChildren();

      selectedPhotos.forEach((entry) => {
        const preview = document.createElement("div");
        preview.className = "photo-preview";
        try {
          const image = document.createElement("img");
          const objectUrl = URL.createObjectURL(entry.file);
          preview.dataset.objectUrl = objectUrl;
          image.src = objectUrl;
          image.alt = `Preview of ${entry.file.name}`;
          preview.append(image);
        } catch {
          const fileLabel = document.createElement("span");
          fileLabel.className = "photo-preview__file";
          fileLabel.textContent = entry.file.name;
          preview.append(fileLabel);
        }

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.setAttribute("aria-label", `Remove ${entry.file.name}`);
        removeButton.textContent = "×";
        removeButton.addEventListener("click", () => {
          selectedPhotos = selectedPhotos.filter((item) => item !== entry);
          syncPhotoInput();
          renderPhotoPreviews();
          form.dispatchEvent(new Event("change", { bubbles: true }));
        });
        preview.append(removeButton);
        previewArea.append(preview);
      });
    };

    const addPhotos = (files) => {
      uploadError.textContent = "";
      for (const file of Array.from(files || [])) {
        if (!allowedTypes.has(file.type) || !allowedExtensions.test(file.name)) {
          uploadError.textContent = "Please select JPG, PNG, or WEBP images only.";
          continue;
        }
        if (file.size > maxPhotoBytes) {
          uploadError.textContent = `${file.name} is larger than 10MB.`;
          continue;
        }
        if (selectedPhotos.some((entry) => entry.fingerprint === fingerprint(file))) continue;
        const slot = nextSlot();
        if (slot < 0) {
          uploadError.textContent = `You can upload up to ${maxPhotos} photos.`;
          break;
        }
        selectedPhotos.push({ file, fingerprint: fingerprint(file), slot, url: "" });
      }
      syncPhotoInput();
      renderPhotoPreviews();
      form.dispatchEvent(new Event("change", { bubbles: true }));
    };

    photoInput.addEventListener("change", () => addPhotos(photoInput.files));
    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove("is-dragover");
      });
    });
    dropZone.addEventListener("drop", (event) => addPhotos(event.dataTransfer?.files));

    const uploadAll = async ({ idempotency_key: id, lead_session_token: token } = {}) => {
      const validationError = window.AQGEstimateCore?.validatePhotoMeta(selectedPhotos.map((entry) => entry.file)) || "";
      if (validationError) throw new Error(validationError);
      const urls = [];
      for (let index = 0; index < selectedPhotos.length; index += 1) {
        const entry = selectedPhotos[index];
        if (!entry.url) {
          uploadError.textContent = `Uploading photo ${index + 1} of ${selectedPhotos.length}…`;
          const body = new FormData();
          body.append("photo", entry.file);
          body.append("photo_slot", String(entry.slot));
          body.append("idempotency_key", id || "");
          body.append("lead_session_token", token || "");
          const response = await fetch("/api/upload-photo", { method: "POST", body });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.url) {
            const error = new Error(result.message || `Couldn't upload ${entry.file.name}. Please try again.`);
            error.code = result.code || "photo_upload_failed";
            throw error;
          }
          const returnedUrl = new URL(result.url, window.location.href);
          const localPreview = ["127.0.0.1", "localhost", "::1"].includes(returnedUrl.hostname);
          if (returnedUrl.protocol !== "https:" && !localPreview) {
            const error = new Error("Photo storage returned an insecure URL.");
            error.code = "insecure_photo_url";
            throw error;
          }
          entry.url = returnedUrl.toString();
        }
        urls.push(entry.url);
      }
      uploadError.textContent = "";
      return urls;
    };

    const clearUploadedUrls = () => selectedPhotos.forEach((entry) => { entry.url = ""; });
    const reset = () => {
      selectedPhotos = [];
      syncPhotoInput();
      renderPhotoPreviews();
      uploadError.textContent = "";
    };
    return {
      hasPhotos: () => selectedPhotos.length > 0,
      count: () => selectedPhotos.length,
      uploadAll,
      clearUploadedUrls,
      reset,
    };
  };

  const initFormSections = () => {
    const calculator = form.querySelector("[data-estimate-calculator]");
    const toggle = form.querySelector("[data-toggle-estimate-calculator]");
    const calculatorFlag = form.elements.namedItem("calculator_requested");
    const stories = form.elements.namedItem("stories");
    const squareFeet = form.elements.namedItem("square_feet");
    const gutterSizeControls = Array.from(form.querySelectorAll("[name='gutter_size']"));
    const calculatorServices = Array.from(form.querySelectorAll("[name^='include_']"));

    if (!calculator || !toggle || !(calculatorFlag instanceof HTMLInputElement)) return null;

    const syncCalculator = (opened, focus = false) => {
      calculator.hidden = !opened;
      toggle.setAttribute("aria-expanded", String(opened));
      toggle.textContent = opened ? "Hide Preliminary Estimate Calculator" : "Calculate My Preliminary Estimate";
      calculatorFlag.value = opened ? "true" : "false";
      calculator.querySelectorAll("input, select, textarea").forEach((control) => { control.disabled = !opened; });
      [stories, squareFeet, ...gutterSizeControls].forEach((control) => {
        if (control instanceof HTMLInputElement) control.required = opened;
      });
      const firstService = calculatorServices[0];
      if (firstService instanceof HTMLInputElement) firstService.setCustomValidity(opened && !calculatorServices.some((control) => control.checked) ? "Select at least one service for the calculator." : "");
      if (opened && focus) calculator.querySelector("h3")?.focus();
      form.dispatchEvent(new CustomEvent("aqg:calculator-toggle", { detail: { opened } }));
      form.dispatchEvent(new Event("change", { bubbles: true }));
    };

    toggle.addEventListener("click", () => {
      const opening = calculator.hidden;
      syncCalculator(opening, true);
      if (opening) trackAnalytics("estimate_calculator_open");
    });
    calculator.addEventListener("change", () => {
      const firstService = calculatorServices[0];
      if (firstService instanceof HTMLInputElement) firstService.setCustomValidity(!calculator.hidden && !calculatorServices.some((control) => control.checked) ? "Select at least one service for the calculator." : "");
    });
    syncCalculator(false);
    return { calculator, syncCalculator };
  };

  const initTurnstile = async () => {
    const mount = form.querySelector("#estimate-turnstile");
    const tokenField = form.elements.namedItem("turnstile_token");
    if (!mount || !(tokenField instanceof HTMLInputElement)) return;
    try {
      const config = await fetch("/api/form-config").then((response) => response.ok ? response.json() : null);
      if (!config?.turnstileSiteKey) return;
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
      const widgetId = window.turnstile?.render(mount, {
        sitekey: config.turnstileSiteKey,
        action: config.turnstileAction || "estimate_request",
        callback: (token) => { tokenField.value = token; },
        "expired-callback": () => { tokenField.value = ""; }
      });
      resetTurnstileChallenge = () => {
        tokenField.value = "";
        if (widgetId !== undefined && widgetId !== null) window.turnstile?.reset(widgetId);
      };
    } catch {
      mount.textContent = "Security verification is unavailable. Please try again shortly.";
    }
  };

  const sections = initFormSections();
  window.AQGInitEstimatePricingPreview?.(form);
  const requiredNames = ["name", "phone", "email", "zip", "service", "address"];
  requiredNames.forEach((name) => {
    const control = form.elements.namedItem(name);
    const label = control?.closest(".field")?.querySelector("label");
    if (control instanceof HTMLElement) control.setAttribute("aria-required", "true");
    if (label && !label.querySelector(".required-marker")) label.insertAdjacentHTML("beforeend", ' <span class="required-marker" aria-hidden="true">*</span><span class="sr-only"> required</span>');
  });
  const setDateValidity = initDatePicker();
  const photoUpload = initPhotoUpload();
  initTurnstile();
  bindEstimateTriggers();

  const leadSessionField = form.elements.namedItem("lead_session_token");
  let activeLeadSession = null;

  const setLeadSessionField = (value) => {
    if (leadSessionField instanceof HTMLInputElement) leadSessionField.value = value;
  };

  const startLeadSession = async (payload) => {
    if (activeLeadSession?.id === payload.idempotency_key && activeLeadSession.token) return activeLeadSession;
    const response = await fetch("/api/lead-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotency_key: payload.idempotency_key,
        turnstile_token: payload.turnstile_token,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.lead_session_token) {
      const error = new Error(result.message || "We couldn't start a secure photo upload. Please try again.");
      error.code = result.code || "lead_session_failed";
      throw error;
    }
    activeLeadSession = { id: payload.idempotency_key, token: result.lead_session_token };
    setLeadSessionField(activeLeadSession.token);
    return activeLeadSession;
  };

  const discardLeadSession = ({ regenerateId = false } = {}) => {
    activeLeadSession = null;
    setLeadSessionField("");
    photoUpload?.clearUploadedUrls();
    if (regenerateId) {
      const idempotencyField = form.elements.namedItem("idempotency_key");
      if (idempotencyField instanceof HTMLInputElement) idempotencyField.value = crypto.randomUUID();
    }
    resetTurnstileChallenge();
  };

  const serviceByPath = new Map([
    ["/services/seamless-gutter-installation/", "Seamless Gutter Installation"],
    ["/services/gutter-guards/", "Gutter Guards"],
    ["/services/gutter-replacement/", "Gutter Replacement"],
    ["/services/soffit-fascia/", "Soffit & Fascia"],
    ["/services/downspout-installation/", "Downspout Installation"],
    ["/services/gutter-miters-downspout-connectors/", "Gutter Miters & Connectors"]
  ]);

  const preselectServiceFromPath = () => {
    const select = form.elements.namedItem("service");
    if (!(select instanceof HTMLSelectElement)) return;
    if (Array.from(select.selectedOptions).some((option) => option.value)) return;

    const normalizedPath = `${window.location.pathname.replace(/\/+$/, "")}/`;
    const service = serviceByPath.get(normalizedPath);
    if (!service) return;

    const option = Array.from(select.options).find((item) => item.value === service);
    if (!option) return;
    option.selected = true;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  preselectServiceFromPath();

  let calculatorCardsSeeded = false;
  const syncServiceFields = () => {
    const selected = new Set(Array.from(form.querySelectorAll("select[name='service'] option:checked")).map((option) => option.value));
    const cards = Array.from(form.querySelectorAll("[name^='include_']"));
    if (!cards.length) return;
    const set = (name, checked) => { const control = form.elements.namedItem(name); if (control instanceof HTMLInputElement) control.checked = checked; };
    if (!calculatorCardsSeeded) {
      set("include_gutters", selected.has("Seamless Gutter Installation") || selected.has("Gutter Replacement"));
      set("include_guards", selected.has("Gutter Guards"));
      set("include_fascia", selected.has("Soffit & Fascia"));
      set("include_soffit", selected.has("Soffit & Fascia"));
      set("include_downspouts", selected.has("Downspout Installation"));
      set("include_connectors", selected.has("Gutter Miters & Connectors"));
      calculatorCardsSeeded = true;
    }
    const calculatorOpen = !sections?.calculator.hidden;
    const guards = form.elements.include_guards instanceof HTMLInputElement && form.elements.include_guards.checked;
    const needsDownspoutCount = (form.elements.include_downspouts instanceof HTMLInputElement && form.elements.include_downspouts.checked) || (form.elements.include_connectors instanceof HTMLInputElement && form.elements.include_connectors.checked);
    const guardField = form.querySelector(".estimate-guard-type");
    const downspoutField = form.querySelector(".estimate-downspout-count");
    guardField?.toggleAttribute("hidden", !guards);
    downspoutField?.toggleAttribute("hidden", !needsDownspoutCount);
    guardField?.querySelectorAll("input").forEach((control) => { control.disabled = !calculatorOpen || !guards; control.required = calculatorOpen && guards; });
    downspoutField?.querySelectorAll("input").forEach((control) => { control.disabled = !calculatorOpen || !needsDownspoutCount; control.required = calculatorOpen && needsDownspoutCount; });
    const firstCard = cards[0];
    if (firstCard instanceof HTMLInputElement) firstCard.setCustomValidity(calculatorOpen && !cards.some((control) => control.checked) ? "Select at least one service for the calculator." : "");
  };
  form.elements.service?.addEventListener("change", syncServiceFields);
  form.querySelectorAll("[name^='include_']").forEach((card) => card.addEventListener("change", syncServiceFields));
  form.addEventListener("aqg:calculator-toggle", syncServiceFields);
  syncServiceFields();

  // The submit button stays disabled until required contact and project fields are valid.
  const submitButton = form.querySelector("button[type='submit']");
  const requiredHint = form.querySelector(".estimate-modal__hint");

  const isFormReady = () => {
    // Read ValidityState directly: form.checkValidity() would dispatch
    // "invalid" events, which main.js turns into visible field errors and a
    // focus jump on every keystroke.
    const controls = Array.from(form.querySelectorAll("input, select, textarea"));
    const allValid = controls.every((control) => !control.willValidate || control.validity.valid);
    return allValid;
  };

  const updateSubmitState = () => {
    if (!(submitButton instanceof HTMLButtonElement)) return;
    if (submitButton.getAttribute("aria-busy") === "true") return;
    const ready = isFormReady();
    submitButton.disabled = !ready;
    if (requiredHint) requiredHint.hidden = ready;
  };

  form.addEventListener("input", updateSubmitState);
  form.addEventListener("change", updateSubmitState);

  let formStarted = false;
  const trackFormStart = (event) => {
    if (formStarted || !event.isTrusted) return;
    const control = event.target;
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) return;
    if (control.type === "hidden") return;
    formStarted = true;
    trackAnalytics("estimate_form_start");
  };
  form.addEventListener("input", trackFormStart);
  form.addEventListener("change", trackFormStart);
  updateSubmitState();

  // Links on the generated SEO pages point to /#estimate, so opening the
  // homepage with that hash must open the estimate form.
  if (window.location.hash === "#estimate") openModal(null);
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#estimate") openModal(null);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    // main.js keeps a legacy form snapshot for static previews. The live lead
    // flow does not need that PII in browser storage.
    safeSessionStorage("remove", "aqgLead");
    clearStatus(form);
    setDateValidity();

    const controls = Array.from(form.querySelectorAll("input, select, textarea"));
    if (!validateFormControls(controls)) {
      const invalidControl = controls.find((control) => !control.checkValidity());
      trackAnalytics("estimate_error", {
        error_type: "validation",
        field_name: String(invalidControl?.name || "unknown").slice(0, 80)
      });
      return;
    }

    const payload = buildPayload(form);
    payload.idempotency_key = payload.idempotency_key || crypto.randomUUID();
    const idempotencyField = form.elements.namedItem("idempotency_key");
    if (idempotencyField instanceof HTMLInputElement) idempotencyField.value = payload.idempotency_key;

    try {
      setLoading(submitButton, true);
      trackAnalytics("estimate_submit", {
        service_count: Array.isArray(payload.service_needed) ? payload.service_needed.length : 0,
        calculator_requested: payload.calculator_requested === true,
        photo_count: photoUpload?.count() || 0,
      });

      if (photoUpload?.hasPhotos() || activeLeadSession) {
        const session = await startLeadSession(payload);
        payload.lead_session_token = session.token;
        payload.uploaded_photos = await photoUpload.uploadAll({
          idempotency_key: payload.idempotency_key,
          lead_session_token: session.token,
        });
      } else {
        payload.lead_session_token = "";
        payload.uploaded_photos = [];
      }

      const serverResult = await postPayload(payload);
      const conversionEnvelope = {
        confirmed: true,
        eventId: serverResult.event_id || payload.idempotency_key,
        currency: serverResult.currency || "USD",
        estimateStatus: serverResult.estimate_status || "not_requested",
        customerDisplayEstimate: Number(serverResult.customer_display_estimate || 0),
        estimateRequiresManualReview: serverResult.estimate_requires_manual_review === true,
        serviceNeeded: Array.isArray(payload.service_needed) ? payload.service_needed.slice(0, 6) : []
      };
      const conversionStored = safeSessionStorage("set", "aqg_submission_result", JSON.stringify(conversionEnvelope));
      if (!conversionStored) {
        trackAnalytics("generate_lead", {
          event_id: conversionEnvelope.eventId,
          estimated_project_value: conversionEnvelope.customerDisplayEstimate,
          estimated_project_currency: conversionEnvelope.currency,
          estimate_status: conversionEnvelope.estimateStatus,
          service_needed: conversionEnvelope.serviceNeeded,
          delivery_fallback: "storage_unavailable"
        });
      }
      trackAnalytics("estimate_success", {
        estimate_status: serverResult.estimate_status || "not_requested"
      });
      photoUpload?.reset();
      activeLeadSession = null;
      setLeadSessionField("");
      await redirectToThankYou(form);
    } catch (error) {
      const invalidSessionCodes = new Set([
        "lead_session_expired",
        "invalid_lead_session",
        "lead_session_closed",
        "invalid_photo_session",
        "photo_slot_used",
        "lead_session_exists",
      ]);
      if (invalidSessionCodes.has(error?.code)) discardLeadSession({ regenerateId: true });
      else if (!activeLeadSession) resetTurnstileChallenge();
      trackAnalytics("estimate_error", {
        message: String(error?.message || "unknown_error").slice(0, 160)
      });
      showStatus(
        form,
        error?.message || "We couldn't send your estimate request. Please try again or call us.",
        "error"
      );
      setLoading(submitButton, false);
      updateSubmitState();
    }
  });

  window.AQGEstimateModal = {
    open: openModal,
    close: closeModal,
    refresh: bindEstimateTriggers
  };
})();
