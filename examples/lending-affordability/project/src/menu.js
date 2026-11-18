/**
 * The right-click menu every object on the page carries.
 *
 * One menu element, re-filled for whichever object was clicked. It is plain
 * DOM — a `menu` role, `menuitem` buttons — so it can be read, focused and
 * driven without a pointer. Escape, a click anywhere else, a scroll or a resize
 * closes it.
 */

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
};

export const createContextMenu = () => {
  const menu = el('div', { class: 'ctx', role: 'menu', hidden: true, 'aria-label': 'Object menu' });
  document.body.append(menu);

  const close = () => {
    if (menu.hidden) return;
    menu.hidden = true;
    menu.replaceChildren();
    menu.removeAttribute('data-object');
  };

  document.addEventListener('pointerdown', (event) => {
    if (!menu.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);

  /**
   * Open the menu for one object at a point.
   * @param {{ x: number, y: number, objectId: string, title: string, items: { label: string, disabled?: boolean, run: () => void }[] }} options
   */
  const open = ({ x, y, objectId, title, items }) => {
    close();
    menu.replaceChildren();
    menu.dataset.object = objectId;
    menu.append(
      el('p', { class: 'ctx__title', text: title }),
      ...items.map((item) =>
        el('button', {
          type: 'button',
          role: 'menuitem',
          class: 'ctx__item',
          disabled: item.disabled ? true : undefined,
          text: item.label,
          onclick: () => {
            close();
            item.run();
          },
        }),
      ),
    );
    menu.hidden = false;

    // Keep the whole menu on screen.
    const { width, height } = menu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - width - 8);
    const top = Math.min(y, window.innerHeight - height - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
    menu.querySelector('button:not([disabled])')?.focus();
  };

  return { open, close, element: menu };
};

/**
 * A modal that hosts an Astrato object — what "View data" on the menu shows: a
 * `table` instance over the same query as the chart. A native `dialog`, so it
 * traps focus and closes on Escape by itself. `mount(surface)` is called once
 * the surface has its size and returns the release function, which runs when
 * the dialog closes: a hidden object is an unmounted one.
 */
export const showObjectDialog = ({ title, note, mount }) => {
  document.querySelector('dialog.data')?.remove();
  const surface = el('div', { class: 'viz-surface', 'data-tile': 'dialog' });
  const dialog = el('dialog', { class: 'data', 'aria-label': `${title} — data` });
  let release;
  let torn = false;
  // Release the instance and drop the element, whichever way the dialog goes:
  // the close button, Escape (`cancel`), or a programmatic `close()`.
  const teardown = () => {
    if (torn) return;
    torn = true;
    release?.();
    if (dialog.open) dialog.close();
    dialog.remove();
  };
  dialog.append(
    el('header', { class: 'data__head' }, [
      el('h2', { class: 'data__title', text: title }),
      el('button', { type: 'button', class: 'data__close', 'aria-label': 'Close', text: '×', onclick: teardown }),
    ]),
    note ? el('p', { class: 'data__note', text: note }) : null,
    el('div', { class: 'data__body' }, surface),
  );
  dialog.addEventListener('close', teardown);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    teardown();
  });
  document.body.append(dialog);
  dialog.showModal();
  release = mount(surface);
  dialog.teardown = teardown;
  return dialog;
};
