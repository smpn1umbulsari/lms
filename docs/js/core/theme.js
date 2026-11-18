// Theme Management (Light Minimalist Blue default + Dark Mode)
export function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.classList.toggle("dark", t === "dark");
  const icon = document.getElementById("theme-icon");
  if (icon) icon.textContent = t === "dark" ? "light_mode" : "dark_mode";
  try {
    localStorage.setItem("lms_theme", t);
  } catch (e) {}
}

export function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(cur === "dark" ? "light" : "dark");
}

export function initTheme() {
  document.querySelectorAll("#btn-theme-toggle, .mobile-only-theme, [data-action='toggle-theme']").forEach((btn) => {
    btn.addEventListener("click", toggleTheme);
  });
  try {
    const savedTheme = localStorage.getItem("lms_theme");
    if (savedTheme) applyTheme(savedTheme);
  } catch (e) {}
}
