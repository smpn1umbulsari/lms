// Central Action Delegation Utility
// Replaces inline onclick and window._* handlers

export function initActionDelegation(root, actionMap) {
  if (!root) return () => {};

  const handler = (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const fn = actionMap[action];
    if (typeof fn === "function") {
      fn(target, e);
    }
  };

  root.addEventListener("click", handler);
  return () => root.removeEventListener("click", handler);
}
