import { marked } from "marked";
import DOMPurify from "dompurify";
const documents = window.YAMI_DOCS;
const $ = (id) => document.getElementById(id);
const byPath = new Map(documents.map((d) => [d.path, d.slug]));
function escapeHtml(value) {
  const e = document.createElement("span");
  e.textContent = value;
  return e.innerHTML;
}
function localLinks(content) {
  return content.replace(/\]\(([^)]+\.md)(#[^)]+)?\)/g, (all, path, anchor) => {
    const slug = byPath.get(path.replace(/^\.\//, ""));
    return slug ? `](#${slug}${anchor ? "~" + anchor.slice(1) : ""})` : all;
  });
}
let observer;
function render() {
  const [slug, anchor] = location.hash.slice(1).split("~");
  const current = documents.find((d) => d.slug === slug) || documents[0];
  $("breadcrumb").textContent = `${current.group} / ${current.title}`;
  document.title = `${current.title} — Yami documentation`;
  $("article").innerHTML = DOMPurify.sanitize(marked.parse(current.content));
  const resolveRelative = (value) => {
    const parts = current.path.split("/").slice(0, -1);
    for (const part of value.split("/")) {
      if (part === "." || !part) continue;
      if (part === ".." && parts.length && parts.at(-1) !== "..") parts.pop();
      else parts.push(part);
    }
    return parts.join("/");
  };
  for (const element of $("article").querySelectorAll("a[href],img[src]")) {
    const attr = element.tagName === "IMG" ? "src" : "href",
      raw = element.getAttribute(attr);
    if (!raw || /^(?:[a-z]+:|\/)/i.test(raw)) continue;
    if (raw.startsWith("#")) {
      element.setAttribute(attr, "#" + current.slug + "~" + raw.slice(1));
      continue;
    }
    const [file, fragment] = raw.split("#"),
      resolved = resolveRelative(file),
      slug = byPath.get(resolved);
    element.setAttribute(
      attr,
      slug
        ? "#" + slug + (fragment ? "~" + fragment : "")
        : resolved + (fragment ? "#" + fragment : ""),
    );
  }
  for (const table of $("article").querySelectorAll("table")) {
    const wrap = document.createElement("div");
    wrap.className = "table-scroll";
    table.before(wrap);
    wrap.append(table);
  }
  const headings = [...$("article").querySelectorAll("h2,h3")];
  const ids = new Set();
  for (const h of headings) {
    let id = h.textContent
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "");
    while (ids.has(id)) id += "-";
    ids.add(id);
    h.id = id;
  }
  $("toc").innerHTML = headings
    .map(
      (h) =>
        `<a class="${h.tagName === "H3" ? "sub" : ""}" href="#${current.slug}~${h.id}">${escapeHtml(h.textContent)}</a>`,
    )
    .join("");
  for (const a of $("article").querySelectorAll("a")) {
    if (/^https?:/.test(a.href)) {
      a.target = "_blank";
      a.rel = "noreferrer noopener";
    }
  }
  $("navigation")
    .querySelectorAll("a")
    .forEach((a) => {
      const active = a.getAttribute("href") === `#${current.slug}`;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  const index = documents.indexOf(current),
    prev = documents[index - 1],
    next = documents[index + 1];
  $("neighbors").innerHTML =
    (prev
      ? `<a href="#${prev.slug}"><small>← PREVIOUS</small>${escapeHtml(prev.title)}</a>`
      : "<span></span>") +
    (next
      ? `<a href="#${next.slug}"><small>NEXT →</small>${escapeHtml(next.title)}</a>`
      : "");
  $("sidebar")?.classList.remove("open");
  document.querySelector(".sidebar").classList.remove("open");
  $("menu-toggle").setAttribute("aria-expanded", "false");
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          $("toc")
            .querySelectorAll("a")
            .forEach(
              (a) =>
                (a.style.color = a
                  .getAttribute("href")
                  .endsWith("~" + entry.target.id)
                  ? "var(--accent)"
                  : ""),
            );
        }
    },
    { rootMargin: "-90px 0px -65% 0px" },
  );
  headings.forEach((h) => observer.observe(h));
  if (anchor) document.getElementById(anchor)?.scrollIntoView();
  else window.scrollTo(0, 0);
}
let group = "";
$("navigation").innerHTML = documents
  .map((d) => {
    const heading =
      d.group !== group
        ? `<div class="nav-group">${escapeHtml(d.group)}</div>`
        : "";
    group = d.group;
    return (
      heading +
      `<a class="nav-item" href="#${d.slug}">${escapeHtml(d.title)}</a>`
    );
  })
  .join("");
function search() {
  const query = $("search").value.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const found = documents.filter((d) =>
    terms.every((term) =>
      (d.title + " " + d.content).toLowerCase().includes(term),
    ),
  );
  $("search-results").innerHTML = found.length
    ? found
        .map(
          (d) =>
            `<a class="search-result" href="#${d.slug}"><b>${escapeHtml(d.title)}</b><small>${escapeHtml(d.group)}</small></a>`,
        )
        .join("")
    : '<div class="empty-search">No matching guides. Try “tools”, “wallpaper”, or “privacy”.</div>';
}
function openSearch() {
  $("search-dialog").showModal();
  search();
  $("search").focus();
}
$("search-trigger").onclick = openSearch;
$("search-close").onclick = () => $("search-dialog").close();
$("search").addEventListener("input", search);
$("search-results").addEventListener("click", (e) => {
  if (e.target.closest("a")) $("search-dialog").close();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("search-dialog").open) {
    e.preventDefault();
    $("search-dialog").close();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!$("search-dialog").open) openSearch();
  }
});
$("menu-toggle").onclick = () => {
  const open = document.querySelector(".sidebar").classList.toggle("open");
  $("menu-toggle").setAttribute("aria-expanded", String(open));
};
window.addEventListener("hashchange", render);
render();
