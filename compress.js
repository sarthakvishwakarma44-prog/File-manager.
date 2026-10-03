const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const LEVELS = {
  light:  { scale: 1.6, quality: 0.78 },
  medium: { scale: 1.25, quality: 0.62 },
  strong: { scale: 1.0, quality: 0.45 },
};

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
    const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    current = { name: file.name, size: file.size, bytes, pages: doc.numPages };
    doc.destroy();

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

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

$("action-btn").addEventListener("click", async () => {
  if (!current) return;
  const btn = $("action-btn");
  btn.disabled = true;

  const level = LEVELS[document.querySelector('input[name="level"]:checked').value];

  try {
    const source = await pdfjsLib.getDocument({ data: current.bytes.slice() }).promise;
    const out = await PDFDocument.create();

    for (let i = 1; i <= source.numPages; i++) {
      setStatus("Compressing page " + i + " of " + source.numPages + "...");
      const page = await source.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const view = page.getViewport({ scale: level.scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(view.width);
      canvas.height = Math.floor(view.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: view }).promise;
      const blob = await canvasToJpeg(canvas, level.quality);
      const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));

      const newPage = out.addPage([base.width, base.height]);
      newPage.drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height });

      canvas.width = 0; 
      page.cleanup();
    }
    source.destroy();

    const bytes = await out.save();

    if (bytes.length >= current.size) {
      setStatus(
        "This PDF is already small, so compressing would not help. Try a stronger level or keep the original.",
        "error"
      );
      return;
    }

    const saved = Math.round((1 - bytes.length / current.size) * 100);
    showResult(bytes, "application/pdf", baseName(current.name) + "-compressed.pdf");
    setStatus(
      "Reduced from " + formatSize(current.size) + " to " + formatSize(bytes.length) +
        " (" + saved + "% smaller).",
      "success"
    );
  } catch (err) {
    console.error(err);
    setStatus("Something went wrong while compressing. Try another file.", "error");
  } finally {
    btn.disabled = false;
  }
});
