// Rules and page code for agents clicking and typing in the Yami Browser.
// The page code runs in an isolated world, so the page's own scripts cannot
// change it. Anything that submits, pays, posts or deletes asks the user.

export type Target = { selector?: string; text?: string };

export type Found = {
  found: boolean;
  tag?: string;
  label?: string;
  submits?: boolean;
  password?: boolean;
};

const riskyWords =
  /\b(buy|purchase|pay|order|checkout|place order|post|publish|send|submit|delete|remove|confirm|subscribe|transfer|sign up|log ?out)\b/i;

/** Whether an action needs the user's approval first. */
export function riskyAction(found: Found) {
  return !!found.submits || riskyWords.test(found.label || "");
}

/** Page code that finds the target and optionally acts; returns a Found. */
export function pageScript(
  target: Target,
  kind: "click" | "type",
  act: "find" | "click" | "type",
  text = "",
) {
  return `(() => {
  const want = ${JSON.stringify(target)};
  const clickable = "a, button, input[type=submit], input[type=button], [role=button], [role=link], summary, label";
  const typable = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, [contenteditable=true]";
  // What to look among follows the kind of action, on the find step too.
  const pool = ${JSON.stringify(kind)} === "type" ? typable : clickable;
  const labelOf = (el) => (el.getAttribute("aria-label") || el.innerText || el.value || el.placeholder || el.name || el.title || "").trim().replace(/\\s+/g, " ").slice(0, 120);
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  let el = null;
  if (want.selector) { try { el = document.querySelector(want.selector); } catch { return { found: false }; } }
  else if (want.text) {
    const needle = want.text.trim().toLowerCase();
    const all = [...document.querySelectorAll(pool)].filter(visible);
    el = all.find((e) => labelOf(e).toLowerCase() === needle) || all.find((e) => labelOf(e).toLowerCase().includes(needle)) || null;
  }
  if (!el) return { found: false };
  const form = el.closest("form");
  const submits = (el.tagName === "BUTTON" && (el.type || "submit") === "submit" && !!form) || (el.tagName === "INPUT" && el.type === "submit");
  const info = { found: true, tag: el.tagName.toLowerCase(), label: labelOf(el), submits, password: el.type === "password" };
  if (${JSON.stringify(act)} === "click") el.click();
  if (${JSON.stringify(act)} === "type" && !info.password) {
    el.focus();
    if (el.isContentEditable) el.textContent = ${JSON.stringify(text)};
    else {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(text)});
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return info;
})()`;
}
