export function getOpenHaDialog() {
  // All stock `ha-dialogs` are opened in shadow roots
  // of children of the shadow root of `<home-assistant>`.
  // browser_mod dialogs are opened in the shadow root
  // of `<browser-mod-popup>` directly.
  const haRoot = document.getElementsByTagName("home-assistant")[0];
  const browserModPopups = document.getElementsByTagName("browser-mod-popup");
  return [...haRoot.shadowRoot!.children]
    .concat(...browserModPopups)
    .map((el) => el.shadowRoot?.querySelector("ha-dialog[open]"))
    .find(Boolean);
}

/** Returns a promise that resolves when all open dialogs (if any) are closed. */
export async function waitUntilNoHaDialogs() {
  while (true) {
    const dialog = getOpenHaDialog();
    if (!dialog) return;
    await new Promise((resolve) => dialog.addEventListener("closed", resolve));
  }
}
