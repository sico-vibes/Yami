export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function textToHtml(text: string) {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("\n");
}

/** Headings, paragraphs, emphasis, links, and fenced code. Not a full Markdown parser. */
export function markdownToHtml(markdown: string) {
  const escaped = escapeHtml(markdown.replace(/\r\n/g, "\n"));
  const withCode = escaped.replace(/```([\s\S]*?)```/g, (_all, code) => `<pre><code>${code.trim()}</code></pre>`);
  const blocks = withCode.split(/\n{2,}/).map((block) => {
    if (block.startsWith("<pre>")) return block;
    const heading = /^(#{1,6}) (.+)$/.exec(block);
    if (heading) return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
    const items = block.split("\n").filter((line) => line.startsWith("- "));
    if (items.length === block.split("\n").length)
      return `<ul>${items.map((item) => `<li>${inline(item.slice(2))}</li>`).join("")}</ul>`;
    return `<p>${inline(block).replace(/\n/g, "<br>")}</p>`;
  });
  return blocks.join("\n");
}

function inline(value: string) {
  return value
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function markdownToText(markdown: string) {
  return htmlToText(markdownToHtml(markdown));
}
