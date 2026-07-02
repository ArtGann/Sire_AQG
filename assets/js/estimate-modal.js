(function () {
  if (window.__AQGEstimateModalInitialized) return;
  window.__AQGEstimateModalInitialized = true;

  const modal = document.querySelector(".estimate-modal");
  const dialog = modal?.querySelector(".estimate-modal__dialog");
  const form = modal?.querySelector(".estimate-modal__form");

  if (!modal || !dialog || !form) return;

  let lastFocusedTrigger = null;

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
    return {
      full_name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      zip_code: String(data.get("zip") || "").trim(),
      service_needed: getServices(targetForm),
      home_stories: String(data.get("stories") || "").trim(),
      square_feet: String(data.get("square_feet") || "").trim(),
      property_address: String(data.get("address") || "").trim(),
      preferred_date: String(data.get("preferred_date") || "").trim(),
      comments: String(data.get("message") || "").trim(),
      uploaded_photos: "",
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
      throw new Error(result.message || "We couldn't send your estimate request. Please try again.");
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
    const firstField = form.querySelector("input, select, textarea, button");
    if (firstField instanceof HTMLElement) firstField.focus({ preventScroll: true });
  };

  const openModal = (trigger) => {
    lastFocusedTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
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
      dateInput.setCustomValidity(parsedDate ? "" : "Please enter the date as MM/DD/YYYY.");
      return Boolean(parsedDate);
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

    if (!(photoInput instanceof HTMLInputElement) || !dropZone || !previewArea || !uploadError) return;

    let selectedPhotos = [];

    const syncPhotoInput = () => {
      if (typeof DataTransfer === "undefined") return;
      const transfer = new DataTransfer();
      selectedPhotos.forEach((file) => transfer.items.add(file));
      photoInput.files = transfer.files;
    };

    const renderPhotoPreviews = () => {
      previewArea.querySelectorAll("[data-object-url]").forEach((preview) => {
        URL.revokeObjectURL(preview.dataset.objectUrl);
      });
      previewArea.replaceChildren();

      selectedPhotos.forEach((file, index) => {
        const preview = document.createElement("div");
        preview.className = "photo-preview";

        if (/\.(heic|heif)$/i.test(file.name)) {
          const fileName = document.createElement("span");
          fileName.className = "photo-preview__file";
          fileName.textContent = "HEIC";
          preview.append(fileName);
        } else {
          const image = document.createElement("img");
          const objectUrl = URL.createObjectURL(file);
          preview.dataset.objectUrl = objectUrl;
          image.src = objectUrl;
          image.alt = "";
          preview.append(image);
        }

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.setAttribute("aria-label", `Remove ${file.name}`);
        removeButton.textContent = "x";
        removeButton.addEventListener("click", () => {
          selectedPhotos.splice(index, 1);
          syncPhotoInput();
          renderPhotoPreviews();
        });
        preview.append(removeButton);
        previewArea.append(preview);
      });
    };

    const addPhotos = (files) => {
      uploadError.textContent = "";
      const incoming = Array.from(files || []);
      const allowedExtensions = /\.(jpe?g|png|webp|heic|heif)$/i;

      for (const file of incoming) {
        if (!allowedExtensions.test(file.name)) {
          uploadError.textContent = "Please select JPG, PNG, WEBP, or HEIC images.";
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          uploadError.textContent = `${file.name} is larger than 10MB.`;
          continue;
        }

        const duplicate = selectedPhotos.some(
          (selected) =>
            selected.name === file.name &&
            selected.size === file.size &&
            selected.lastModified === file.lastModified
        );
        if (duplicate) continue;

        if (selectedPhotos.length >= 6) {
          uploadError.textContent = "You can upload up to 6 photos.";
          break;
        }

        selectedPhotos.push(file);
      }

      syncPhotoInput();
      renderPhotoPreviews();
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
  };

  const setDateValidity = initDatePicker();
  initPhotoUpload();
  bindEstimateTriggers();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus(form);
    setDateValidity();

    const controls = Array.from(form.querySelectorAll("input, select, textarea"));
    if (!validateFormControls(controls)) return;

    const submitButton = form.querySelector("button[type='submit']");
    const payload = buildPayload(form);

    try {
      setLoading(submitButton, true);
      sessionStorage.setItem("aqgLead", JSON.stringify(payload));
      await postPayload(payload);
      await redirectToThankYou(form);
    } catch (error) {
      showStatus(
        form,
        error?.message || "We couldn't send your estimate request. Please try again or call us.",
        "error"
      );
      setLoading(submitButton, false);
    }
  });

  window.AQGEstimateModal = {
    open: openModal,
    close: closeModal,
    refresh: bindEstimateTriggers
  };
})();
