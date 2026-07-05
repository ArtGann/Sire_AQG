(function () {
  const header = document.querySelector(".site-header");
  const navigation = header?.querySelector("#primary-navigation");
  const menuToggle = header?.querySelector(".header-menu-toggle");
  const dropdownItems = Array.from(header?.querySelectorAll(".header-nav__item--dropdown") || []);
  const mobileQuery = window.matchMedia("(max-width: 980px)");

  if (!header || !navigation || !menuToggle) return;

  const setDropdown = (item, isOpen) => {
    const trigger = item.querySelector(".header-nav__trigger");
    item.classList.toggle("is-open", isOpen);
    trigger?.setAttribute("aria-expanded", String(isOpen));
  };

  const closeDropdowns = (exceptItem) => {
    dropdownItems.forEach((item) => {
      if (item !== exceptItem) setDropdown(item, false);
    });
  };

  const setMenu = (isOpen, restoreFocus = false) => {
    header.classList.toggle("is-menu-open", isOpen);
    document.body.classList.toggle("header-menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");

    if (!isOpen) {
      closeDropdowns();
      if (restoreFocus) menuToggle.focus({ preventScroll: true });
    }
  };

  menuToggle.addEventListener("click", () => {
    setMenu(!header.classList.contains("is-menu-open"));
  });

  dropdownItems.forEach((item) => {
    const trigger = item.querySelector(".header-nav__trigger");
    let closeTimer = 0;

    trigger?.addEventListener("click", () => {
      const nextState = !item.classList.contains("is-open");
      closeDropdowns(item);
      setDropdown(item, nextState);
    });

    item.addEventListener("mouseenter", () => {
      if (mobileQuery.matches) return;
      window.clearTimeout(closeTimer);
      closeDropdowns(item);
      setDropdown(item, true);
    });

    item.addEventListener("mouseleave", () => {
      if (mobileQuery.matches) return;
      closeTimer = window.setTimeout(() => setDropdown(item, false), 170);
    });

    item.addEventListener("focusin", () => {
      if (mobileQuery.matches) return;
      window.clearTimeout(closeTimer);
      closeDropdowns(item);
      setDropdown(item, true);
    });

    item.addEventListener("focusout", () => {
      if (mobileQuery.matches) return;
      closeTimer = window.setTimeout(() => {
        if (!item.contains(document.activeElement)) setDropdown(item, false);
      }, 0);
    });
  });

  navigation.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || !mobileQuery.matches) return;
    setMenu(false);
  });

  document.addEventListener("click", (event) => {
    if (header.contains(event.target)) return;
    closeDropdowns();
    if (mobileQuery.matches) setMenu(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    const openDropdown = dropdownItems.find((item) => item.classList.contains("is-open"));
    if (openDropdown) {
      const trigger = openDropdown.querySelector(".header-nav__trigger");
      setDropdown(openDropdown, false);
      trigger?.focus({ preventScroll: true });
      return;
    }

    if (header.classList.contains("is-menu-open")) setMenu(false, true);
  });

  mobileQuery.addEventListener("change", () => setMenu(false));
})();
