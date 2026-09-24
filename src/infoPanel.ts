const STORAGE_KEY = 'tensor.infoCollapsed';

/** Wires the info panel's minimize button and returns a toggle for the keyboard shortcut. */
export function setupInfoPanel(panel: HTMLElement, button: HTMLButtonElement): () => void {
  const icon = button.querySelector<HTMLElement>('[aria-hidden]')!;
  const label = button.querySelector<HTMLElement>('.visually-hidden')!;

  function render(collapsed: boolean): void {
    panel.classList.toggle('collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.title = collapsed ? 'Expand (I)' : 'Minimize (I)';
    icon.textContent = collapsed ? '+' : '−';
    label.textContent = collapsed ? 'Expand info panel' : 'Minimize info panel';
  }

  function toggle(): void {
    const collapsed = !panel.classList.contains('collapsed');
    render(collapsed);
    // Storage can be unavailable in private windows, and the panel works fine without it.
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {}
  }

  let stored = false;
  try {
    stored = localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {}
  render(stored);
  button.addEventListener('click', toggle);
  return toggle;
}
