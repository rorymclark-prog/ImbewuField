// On these content pages every fixed corner eventually covers a card or field.
// Keep help in the menu instead; moving the floating button only moves the collision.
export function limaInMenu(pathname: string): boolean {
  return ['/records', '/invoice', '/facilitator/crops', '/samples/gardens'].includes(pathname);
}

export const OPEN_LIMA_EVENT = 'imbewu-open-lima';

export function openLima(): void {
  window.dispatchEvent(new Event(OPEN_LIMA_EVENT));
}
