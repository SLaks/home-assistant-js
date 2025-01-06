export function getOpenHaDialog() {
  // All stock `ha-dialogs` are opened in shadow roots of siblings of `<home-assistant-main>`.
  const haRoot = document.getElementsByTagName("home-assistant")[0];
  return [...haRoot.shadowRoot!.children]
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
