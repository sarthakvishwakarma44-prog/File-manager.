const $ = (id) => document.getElementById(id);
let resultUrl = null;

function setStatus(message, type = "") {
  const el = $("status");
  el.textContent = message;
  el.className = "status" + (type ? " " + type : "");
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isPdf(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function baseName(name) {
  return name.replace(/\.[^.]+$/, "");
}

function showWork(show) {
  $("work").hidden = !show;
  $("drop-zone").hidden = show;
}

function showResult(bytes, mime, filename) {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));

  const link = $("download-link");
  link.href = resultUrl;
  link.download = filename;
  link.textContent = "Download " + filename;

  $("work").hidden = true;
  $("result").hidden = false;
}

function setupDropZone(onFiles) {
  const zone = $("drop-zone");
  const input = $("file-input");

  input.addEventListener("change", () => {
    const chosen = Array.from(input.files);
    input.value = "";
    if (chosen.length) onFiles(chosen);
  });

  zone.addEventListener("click", (e) => {
    if (e.target.closest("label")) return;
    input.click();
  });

  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  ["dragenter", "dragover"].forEach((type) =>
    zone.addEventListener(type, (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((type) =>
    zone.addEventListener(type, () => zone.classList.remove("dragover"))
  );
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    onFiles(Array.from(e.dataTransfer.files));
  });

  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  const other = $("choose-other") || $("add-more");
  if (other) other.addEventListener("click", () => input.click());

  $("start-over").addEventListener("click", () => location.reload());
}
