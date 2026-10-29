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
  /** For a menu: its options' visible text, so an agent can pick again. */
  options?: string[];
  /** The option that matched, for select. */
  chosen?: string;
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
  kind: "click" | "type" | "select",
  act: "find" | "click" | "type" | "select",
  text = "",
) {
  return `(() => {
  const want = ${JSON.stringify(target)};
  const clickable = "a, button, input[type=submit], input[type=button], [role=button], [role=link], summary, label";
  const typable = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, [contenteditable=true]";
  // What to look among follows the kind of action, on the find step too.
  const kind = ${JSON.stringify(kind)};
  const pool = kind === "type" ? typable : kind === "select" ? "select" : clickable;
  const labelFor = (el) => el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]')?.innerText : el.closest("label")?.innerText;
  const labelOf = (el) => (el.getAttribute("aria-label") || (el.tagName === "SELECT" ? labelFor(el) || el.name : "") || el.innerText || el.value || el.placeholder || el.name || el.title || "").trim().replace(/\\s+/g, " ").slice(0, 120);
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
  if (kind === "select") {
    if (el.tagName !== "SELECT") return { found: false };
    const opts = [...el.options];
    info.options = opts.map((o) => o.text.trim()).slice(0, 100);
    const want2 = ${JSON.stringify(text)}.trim().toLowerCase();
    const pick = opts.find((o) => o.text.trim().toLowerCase() === want2 || o.value.toLowerCase() === want2) || opts.find((o) => o.text.trim().toLowerCase().includes(want2));
    if (!pick || pick.disabled) return { ...info, chosen: "" };
    info.chosen = pick.text.trim();
    if (${JSON.stringify(act)} === "select") {
      el.value = pick.value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return info;
  }
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

/**
 * Page code that finds a file field (by selector, or its label or name) and
 * tags it with `token` so Chromium can be told which field to fill.
 */
export function uploadScript(target: Target, token: string) {
  return `(() => {
  const want = ${JSON.stringify(target)};
  const fields = [...document.querySelectorAll('input[type="file"]')];
  const labelOf = (el) => ((el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')?.innerText) || el.closest("label")?.innerText || el.getAttribute("aria-label") || el.name || "").trim().slice(0, 120);
  let el = null;
  if (want.selector) { try { el = document.querySelector(want.selector); } catch { return { found: false }; } }
  else if (want.text) { const n = want.text.trim().toLowerCase(); el = fields.find((f) => labelOf(f).toLowerCase().includes(n)) || null; }
  else if (fields.length === 1) el = fields[0];
  if (!el || el.tagName !== "INPUT" || el.type !== "file") return { found: false, count: fields.length };
  el.setAttribute("data-yami-upload", ${JSON.stringify(token)});
  return { found: true, label: labelOf(el), tag: "input" };
})()`;
}
