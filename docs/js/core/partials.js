export async function mountPartials(root = document) {
  const slots = Array.from(root.querySelectorAll("[data-partial]"));
  await Promise.all(
    slots.map(async (slot) => {
      const url = slot.getAttribute("data-partial");
      if (!url) return;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Gagal memuat partial ${url}: HTTP ${res.status}`);
      }
      const html = await res.text();
      slot.outerHTML = html;
    }),
  );
}
