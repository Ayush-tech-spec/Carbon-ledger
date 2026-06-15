/**
 * ui.js
 * Shared UI utilities: tab switching, totals banner, model badge.
 */

const UI = (() => {
  /** Switch active tab */
  function switchTab(name, btn) {
    // Hide all panels
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.remove("active");
      panel.hidden = true;
    });

    // Deactivate all tab buttons
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });

    // Show target panel
    const panel = document.getElementById(`tab-${name}`);
    if (panel) {
      panel.classList.add("active");
      panel.hidden = false;
    }

    // Activate clicked button
    if (btn) {
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
    }

    // Render analysis on demand
    if (name === "analysis") Analysis.render();
  }

  /** Update the three balance cells and folio line */
  function updateTotals() {
    const { debit, credit, net } = Store.getTotals();

    _setText("total-debit", debit.toFixed(1));
    _setText("total-credit", credit.toFixed(1));
    _setText("net-balance", net.toFixed(1));

    const folio = document.getElementById("folio-total");
    if (folio)
      folio.innerHTML = `Carried forward: ${net.toFixed(1)} kg CO<sub>2</sub>`;
  }

  /** Refresh journal table and analysis after bulk operations */
  function refreshAll() {
    // Re-render table via Journal (it manages its own DOM)
    Journal.init();
    updateTotals();
    Analysis.render();

    // Reset AI insight box
    const box = document.getElementById("ai-insight");
    if (box) {
      box.className = "ai-insight-text ai-insight-text--placeholder";
      box.textContent =
        "Post your first entry and the AI will analyse your carbon position.";
    }
  }

  /** Update the model badge and AI label when provider changes */
  function onModelChange() {
    const sel = document.getElementById("model-select");
    const badge = document.getElementById("model-badge");
    const provider = sel ? sel.value : "claude";
    const name = CONFIG.AI_PROVIDERS[provider]?.name || "AI";

    if (badge) {
      badge.textContent = name;
      badge.className = `model-badge model-badge--${provider}`;
    }

    const aiLabel = document.getElementById("ai-provider-label");
    if (aiLabel) aiLabel.textContent = `AI insight (${name})`;

    const actionLabel = document.getElementById("ai-actions-label");
    if (actionLabel) actionLabel.textContent = `AI planner (${name})`;
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return { switchTab, updateTotals, refreshAll, onModelChange };
})();

// Theme Toggle Management Engine
document.addEventListener("DOMContentLoaded", () => {
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const currentTheme = localStorage.getItem("ledger-theme") || "light";

  // Set initial configuration state
  document.documentElement.setAttribute("data-theme", currentTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      let activeTheme = document.documentElement.getAttribute("data-theme");
      let targetTheme = activeTheme === "light" ? "dark" : "light";

      document.documentElement.setAttribute("data-theme", targetTheme);
      localStorage.setItem("ledger-theme", targetTheme);
    });
  }
});
