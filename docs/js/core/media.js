// Media embeds (YouTube, Google Drive PDF, Direct Links)
import { escAttr } from "./dom.js";

export function mediaEmbed(link) {
  if (!link) return "";
  const yt = link.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/);
  if (yt) {
    return `<iframe class="embed-video" src="https://www.youtube-nocookie.com/embed/${yt[1]}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="Video"></iframe>`;
  }
  const dr = link.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  if (dr) {
    return `<iframe class="embed-pdf" src="https://drive.google.com/file/d/${dr[1]}/preview" loading="lazy" title="PDF"></iframe>`;
  }
  if (/\.pdf($|\?)/i.test(link)) {
    return `<object class="embed-pdf" data="${escAttr(link)}" type="application/pdf"><a href="${escAttr(link)}" target="_blank" rel="noopener">Buka PDF</a></object>`;
  }
  return `<a class="embed-link" href="${escAttr(link)}" target="_blank" rel="noopener noreferrer">🔗 ${escAttr(link)}</a>`;
}

export function urlsOf(item) {
  if (!item) return [];
  if (Array.isArray(item.links) && item.links.length) {
    return item.links.filter(Boolean);
  }
  return item.link ? [item.link] : [];
}

export function embedsHTML(item) {
  return urlsOf(item)
    .map((u) => `<div class="embed-wrap">${mediaEmbed(u)}</div>`)
    .join("");
}
