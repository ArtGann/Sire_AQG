const counters = document.querySelectorAll("[data-counter]");

const counterObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const node = entry.target;
      const target = Number(node.dataset.counter || 0);
      const duration = 1300;
      const startTime = performance.now();

      function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(target * eased);
        node.textContent = value.toLocaleString("en-US");

        if (progress < 1) requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
      observer.unobserve(node);
    });
  },
  { threshold: 0.45 }
);

counters.forEach((counter) => counterObserver.observe(counter));

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.matches("[data-open-estimate-modal]")) return;

    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const enhancedSelects = new Map();

const closeCustomSelect = (select) => {
  const customSelect = enhancedSelects.get(select);
  if (!customSelect) return;

  customSelect.classList.remove("is-open");
  customSelect.parentElement?.classList.remove("field--select-open");
  customSelect.querySelector(".custom-select__button")?.setAttribute("aria-expanded", "false");

  const list = customSelect.querySelector(".custom-select__list");
  if (list) list.hidden = true;
};

const closeAllCustomSelects = (exceptSelect) => {
  enhancedSelects.forEach((customSelect, select) => {
    if (select !== exceptSelect) closeCustomSelect(select);
  });
};

const getFieldWrapper = (control) => control.closest(".field") || control.closest("label") || control.parentElement;

const getFieldLabel = (control) => {
  const wrapper = getFieldWrapper(control);
  const label = wrapper?.querySelector("label, span")?.textContent?.trim();
  if (label) return label;
  if (control.placeholder) return control.placeholder.replace(/\s*\(.+\)\s*$/, "");
  return "this field";
};

const getEnglishValidationMessage = (control) => {
  const label = getFieldLabel(control);
  const validity = control.validity;

  if (control.matches?.("select[multiple]") && control.required) {
    const selectedCount = Array.from(control.selectedOptions).filter((option) => option.value).length;
    if (selectedCount === 0) return "Please select at least one service.";
  }

  if (validity?.customError) return control.validationMessage || "Please check this field.";
  if (validity?.valueMissing) {
    if (control.matches?.("select")) return "Please select at least one service.";
    return `Please enter ${label}.`;
  }
  if (validity?.typeMismatch && control.type === "email") return "Please enter a valid email address.";
  if (validity?.patternMismatch && control.name === "zip") return "Please enter a valid 5-digit ZIP code.";
  if (validity?.patternMismatch && control.name === "preferred_date") return "Please use MM/DD/YYYY.";
  if (validity?.rangeOverflow) return `${label} must be ${control.max} or less.`;
  if (validity?.rangeUnderflow) return `${label} must be at least ${control.min}.`;
  if (validity?.stepMismatch) return `Please enter a valid ${label}.`;
  return "Please check this field.";
};

const clearFieldError = (control) => {
  const wrapper = getFieldWrapper(control);
  if (!wrapper) return;

  wrapper.classList.remove("has-field-error");
  control.removeAttribute("aria-invalid");

  const customSelect = enhancedSelects.get(control);
  if (customSelect) {
    customSelect.classList.remove("has-error");
    customSelect.querySelector(".custom-select__button")?.removeAttribute("aria-invalid");
    customSelect.querySelector(".custom-select__button")?.removeAttribute("aria-describedby");
  }

  const error = wrapper.querySelector(".field-error");
  if (error) error.remove();
};

const showFieldError = (control, message = getEnglishValidationMessage(control)) => {
  const wrapper = getFieldWrapper(control);
  if (!wrapper) return false;

  let error = wrapper.querySelector(".field-error");
  if (!error) {
    error = document.createElement("p");
    error.className = "field-error";
    error.setAttribute("role", "alert");
    wrapper.append(error);
  }

  const errorId = `${control.id || control.name || "field"}-error`;
  error.id = errorId;
  error.textContent = message;
  wrapper.classList.add("has-field-error");
  control.setAttribute("aria-invalid", "true");
  control.setAttribute("aria-describedby", errorId);

  const customSelect = enhancedSelects.get(control);
  if (customSelect) {
    const button = customSelect.querySelector(".custom-select__button");
    customSelect.classList.add("has-error");
    button?.setAttribute("aria-invalid", "true");
    button?.setAttribute("aria-describedby", errorId);
  }

  return true;
};

const focusInvalidControl = (control) => {
  showFieldError(control);

  if (showCustomSelectError(control)) return;

  control.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => control.focus({ preventScroll: true }), 180);
};

const validateControls = (controls) => {
  controls.forEach(clearFieldError);
  const invalidControl = controls.find((control) => !control.checkValidity());

  if (!invalidControl) return true;
  focusInvalidControl(invalidControl);
  return false;
};

// Cloudflare Pages Function proxy keeps the GoHighLevel webhook out of client-side JS.
const LEAD_ENDPOINT = "/api/lead";

const setButtonLoading = (button, isLoading) => {
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

const showFormStatus = (form, message, type = "error") => {
  let status = form.querySelector(".form-status");

  if (!status) {
    status = document.createElement("p");
    status.className = "form-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const activeActions = form.querySelector(".estimate-modal__actions");
    const activeSubmit = form.querySelector("button[type='submit']");
    if (activeActions) {
      activeActions.insertAdjacentElement("beforebegin", status);
    } else if (activeSubmit) {
      activeSubmit.insertAdjacentElement("beforebegin", status);
    } else {
      form.append(status);
    }
  }

  status.textContent = message;
  status.dataset.type = type;
};

const clearFormStatus = (form) => {
  form.querySelector(".form-status")?.remove();
};

const getSelectedServices = (form) => {
  const serviceControl = form.elements.namedItem("service");
  if (!serviceControl) return [];

  if (serviceControl instanceof HTMLSelectElement) {
    return Array.from(serviceControl.selectedOptions)
      .map((option) => option.value)
      .filter(Boolean);
  }

  return Array.from(form.querySelectorAll("[name='service']:checked"))
    .map((control) => control.value)
    .filter(Boolean);
};

const buildLeadPayload = (form) => {
  const data = new FormData(form);

  return {
    full_name: String(data.get("name") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    zip_code: String(data.get("zip") || "").trim(),
    service_needed: getSelectedServices(form),
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

const postLeadPayload = async (payload) => {
  const response = await fetch(LEAD_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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

const redirectToThankYouOrShowSuccess = async (form) => {
  const thankYouUrl = form.getAttribute("action") || "thank-you.html";

  try {
    const response = await fetch(thankYouUrl, { method: "HEAD" });
    if (response.ok) {
      window.location.href = thankYouUrl;
      return;
    }
  } catch {
    // The success message below is the fallback for static previews without a thank-you page.
  }

  showFormStatus(form, "Thank you. Your estimate request was sent successfully.", "success");
};

const syncCustomSelect = (select) => {
  const customSelect = enhancedSelects.get(select);
  if (!customSelect) return;

  const isMulti = select.multiple;
  const selectedOptions = Array.from(select.selectedOptions).filter((option) => option.value);
  const selectedOption = select.options[select.selectedIndex] || select.options[0];
  const button = customSelect.querySelector(".custom-select__button");

  if (button) {
    if (isMulti) {
      if (selectedOptions.length === 0) {
        button.textContent = select.dataset.placeholder || "Service Needed";
        button.classList.add("is-placeholder");
      } else if (selectedOptions.length === 1) {
        button.textContent = selectedOptions[0].textContent;
        button.classList.remove("is-placeholder");
      } else {
        button.textContent = `${selectedOptions.length} services selected`;
        button.classList.remove("is-placeholder");
      }
    } else if (selectedOption) {
      button.textContent = selectedOption.textContent;
      button.classList.toggle("is-placeholder", !selectedOption.value);
    }
  }

  customSelect.querySelectorAll(".custom-select__option").forEach((optionButton) => {
    const option = Array.from(select.options).find((item) => item.value === optionButton.dataset.value);
    const isSelected = isMulti ? Boolean(option?.selected) : optionButton.dataset.value === select.value;
    optionButton.classList.toggle("is-selected", isSelected);
    optionButton.setAttribute("aria-selected", String(isSelected));
  });
};

const openCustomSelect = (select) => {
  const customSelect = enhancedSelects.get(select);
  if (!customSelect) return false;

  closeAllCustomSelects(select);
  customSelect.classList.add("is-open");
  customSelect.parentElement?.classList.add("field--select-open");
  customSelect.classList.remove("has-error");

  const button = customSelect.querySelector(".custom-select__button");
  const list = customSelect.querySelector(".custom-select__list");
  if (button) button.setAttribute("aria-expanded", "true");
  if (list) list.hidden = false;

  return true;
};

const showCustomSelectError = (control) => {
  if (!control.matches?.("select[data-custom-select]")) return false;

  const customSelect = enhancedSelects.get(control);
  if (!customSelect) return false;

  showFieldError(control);
  customSelect.classList.add("has-error");
  openCustomSelect(control);
  customSelect.querySelector(".custom-select__button")?.focus();
  return true;
};

document.querySelectorAll("select[data-custom-select]").forEach((select) => {
  const isMulti = select.multiple;
  const maxSelections = Number(select.dataset.max || 5);
  const placeholderOption = Array.from(select.options).find((option) => !option.value);
  if (placeholderOption) select.dataset.placeholder = placeholderOption.textContent || "Service Needed";

  const customSelect = document.createElement("div");
  customSelect.className = isMulti ? "custom-select custom-select--multi" : "custom-select";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select__button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const list = document.createElement("div");
  list.className = "custom-select__list";
  list.setAttribute("role", "listbox");
  if (isMulti) list.setAttribute("aria-multiselectable", "true");
  list.hidden = true;

  if (isMulti) {
    const hint = document.createElement("div");
    hint.className = "custom-select__hint";
    hint.textContent = `Select 1 to ${maxSelections} services`;
    list.append(hint);
  }

  Array.from(select.options).forEach((option) => {
    if (isMulti && !option.value) return;

    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "custom-select__option";
    optionButton.dataset.value = option.value;
    optionButton.setAttribute("role", "option");
    optionButton.textContent = option.textContent;
    optionButton.classList.toggle("is-placeholder", !option.value);
    let optionPointerHandled = false;

    const chooseOption = () => {
      if (isMulti) {
        const selectedCount = Array.from(select.options).filter((item) => item.value && item.selected).length;
        const canSelect = option.selected || selectedCount < maxSelections;

        if (!canSelect) {
          customSelect.classList.add("has-limit");
          window.setTimeout(() => customSelect.classList.remove("has-limit"), 900);
          return;
        }

        option.selected = !option.selected;

        const selectedAfterToggle = Array.from(select.options).filter((item) => item.value && item.selected).length;
        if (selectedAfterToggle >= maxSelections) {
          window.setTimeout(() => {
            closeCustomSelect(select);
            button.focus();
          }, 0);
        }
      } else {
        select.value = option.value;
      }

      select.dispatchEvent(new Event("change", { bubbles: true }));
      customSelect.classList.remove("has-error");

      if (!isMulti) {
        closeCustomSelect(select);
        button.focus();
      }
    };

    optionButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      optionPointerHandled = true;
      chooseOption();
    });

    optionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (optionPointerHandled) {
        optionPointerHandled = false;
        return;
      }

      chooseOption();
    });

    list.append(optionButton);
  });

  if (isMulti) {
    const doneButton = document.createElement("button");
    doneButton.type = "button";
    doneButton.className = "custom-select__done";
    doneButton.textContent = "Done";
    doneButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeCustomSelect(select);
      button.focus();
    });
    doneButton.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    list.append(doneButton);
  }

  const toggleCustomSelect = () => {
    if (customSelect.classList.contains("is-open")) {
      closeCustomSelect(select);
    } else {
      openCustomSelect(select);
    }
  };

  let buttonPointerHandled = false;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    buttonPointerHandled = true;
    toggleCustomSelect();
  });

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (buttonPointerHandled) {
      buttonPointerHandled = false;
      return;
    }

    toggleCustomSelect();
  });

  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      openCustomSelect(select);
      const selectedOption = list.querySelector(".custom-select__option.is-selected");
      (selectedOption || list.querySelector(".custom-select__option"))?.focus();
    }

    if (event.key === "Escape") closeCustomSelect(select);
  });

  list.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  list.addEventListener("keydown", (event) => {
    const options = Array.from(list.querySelectorAll(".custom-select__option"));
    const currentIndex = options.indexOf(document.activeElement);

    if (event.key === "Escape") {
      closeCustomSelect(select);
      button.focus();
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + direction + options.length) % options.length;
      options[nextIndex]?.focus();
    }
  });

  select.classList.add("native-select--enhanced");
  select.insertAdjacentElement("afterend", customSelect);
  customSelect.append(button, list);
  enhancedSelects.set(select, customSelect);
  syncCustomSelect(select);

  select.addEventListener("change", () => {
    syncCustomSelect(select);
    if (select.checkValidity()) clearFieldError(select);
  });
});

document.addEventListener("click", (event) => {
  enhancedSelects.forEach((customSelect, select) => {
    if (customSelect.contains(event.target)) return;
    closeCustomSelect(select);
  });
});

document.querySelectorAll("form").forEach((form) => {
  form.noValidate = true;

  form.addEventListener(
    "invalid",
    (event) => {
      event.preventDefault();
      focusInvalidControl(event.target);
    },
    true
  );

  form.querySelectorAll("input, select, textarea").forEach((control) => {
    const clearWhenValid = () => {
      if (control.checkValidity()) clearFieldError(control);
    };

    control.addEventListener("input", clearWhenValid);
    control.addEventListener("change", clearWhenValid);
  });

  form.addEventListener("submit", () => {
    const data = new FormData(form);
    const lead = {};

    data.forEach((value, key) => {
      const nextValue =
        value instanceof File
          ? { name: value.name, size: value.size, type: value.type }
          : value;

      if (value instanceof File && !value.name) return;

      if (key in lead) {
        lead[key] = Array.isArray(lead[key]) ? [...lead[key], nextValue] : [lead[key], nextValue];
      } else {
        lead[key] = nextValue;
      }
    });

    sessionStorage.setItem("aqgLead", JSON.stringify(lead));
  });
});

document.querySelectorAll(".compare-card").forEach((card) => {
  card.addEventListener("click", () => {
    const nextState = (Number(card.dataset.state || 0) + 1) % 3;
    card.dataset.state = String(nextState);
  });
});
