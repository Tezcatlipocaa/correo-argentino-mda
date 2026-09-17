const savedTheme = localStorage.getItem("theme");
const initialTheme =
  savedTheme === "light" || savedTheme === "dark" ? savedTheme : "light";

document.documentElement.setAttribute("data-theme", initialTheme);

/**
 * El toggle activa/desactiva via delegación en BaseLayout (survive a los
 * swaps de view transitions); este script sincroniza estado visual y
 * aria-label del input vivo tras cada cambio o navegación.
 */
const updateThemeToggle = (): void => {
  const themeToggle = document.getElementById(
    "theme-toggle",
  ) as HTMLInputElement | null;

  if (!themeToggle) return;

  const isDark =
    document.documentElement.getAttribute("data-theme") === "dark";
  themeToggle.checked = isDark;
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Activar modo claro" : "Activar modo oscuro",
  );
};

const themeObserver = new MutationObserver(() => {
  updateThemeToggle();
});

themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

updateThemeToggle();

document.addEventListener("astro:after-swap", updateThemeToggle);
