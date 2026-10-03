const { PDFDocument } = PDFLib;
let current = null;

setupDropZone(async (list) => {
  const file = list.find(isPdf);
  if (!file) {
    setStatus("Please choose a PDF file.", "error");
    return;
  }
  setStatus("Reading file...");
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    current = { name: file.name, size: file.size, pages: doc.getPageCount(), bytes };

    $("file-name").textContent = file.name;
    $("file-info").textContent =
      current.pages + (current.pages === 1 ? " page" : " pages") + " · " + formatSize(file.size);
    showWork(true);
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Could not read this PDF. It may be damaged or password-protected.", "error");
  }
});

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    $("range-field").hidden = radio.value === "all" && radio.checked;
    if (radio.value === "range" && radio.checked) $("range-field").hidden = false;
  });
});

function parseRanges(text, total) {
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) throw new RangeError("Type the pages you want, for example 1-3, 5.");

  const indices = [];
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new RangeError('"' + part + '" is not a valid page or range.');
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a || b > total) {
      throw new RangeError('Pages must be between 1 and ' + total + ' (check "' + part + '").');
    }
    for (let i = a; i <= b; i++) indices.push(i - 1);
  }
  return indices;
}

$("action-btn").addEventListener("click", async () => {
  if (!current) return;
  const btn = $("action-btn");
  btn.disabled = true;

  try {
    const source = await PDFDocument.load(current.bytes);
    const base = baseName(current.name);
    const mode = document.querySelector('input[name="mode"]:checked').value;

    if (mode === "range") {
      const indices = parseRanges($("range-input").value, current.pages);
      setStatus("Extracting pages...");
      const out = await PDFDocument.create();
      const pages = await out.copyPages(source, indices);
      pages.forEach((p) => out.addPage(p));
      showResult(await out.save(), "application/pdf", base + "-extracted.pdf");
    } else {
      const zip = new JSZip();
      const pad = String(current.pages).length;
      for (let i = 0; i < current.pages; i++) {
        setStatus("Splitting page " + (i + 1) + " of " + current.pages + "...");
        const out = await PDFDocument.create();
        const [page] = await out.copyPages(source, [i]);
        out.addPage(page);
        const name = base + "-page-" + String(i + 1).padStart(pad, "0") + ".pdf";
        zip.file(name, await out.save());
      }
      setStatus("Creating ZIP file...");
      const zipBytes = await zip.generateAsync({ type: "uint8array" });
      showResult(zipBytes, "application/zip", base + "-pages.zip");
    }
    setStatus("Done!", "success");
  } catch (err) {
    if (err instanceof RangeError) {
      setStatus(err.message, "error");
    } else {
      console.error(err);
      setStatus("Something went wrong. Please try another file.", "error");
    }
  } finally {
    btn.disabled = false;
  }
});
