const { PDFDocument } = PDFLib;

const dropZone    = document.getElementById("drop-zone");
const fileInput   = document.getElementById("file-input");
const fileSection = document.getElementById("file-section");
const fileList    = document.getElementById("file-list");
const addMoreBtn  = document.getElementById("add-more");
const clearBtn    = document.getElementById("clear-all");
const mergeBtn    = document.getElementById("merge-btn");
const statusEl    = document.getElementById("status");
const resultEl    = document.getElementById("result");
const downloadLink = document.getElementById("download-link");
const startOverBtn = document.getElementById("start-over");

let files = [];  
let nextId = 1;
let dragIndex = null; 
let resultUrl = null; 

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status" + (type ? " " + type : "");
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isPdf(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

async function addFiles(fileListLike) {
  const incoming = Array.from(fileListLike);
  if (incoming.length === 0) return;

  const pdfs = incoming.filter(isPdf);
  const skipped = incoming.length - pdfs.length;

  setStatus("Reading files...");
  const problems = [];

  for (const file of pdfs) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      files.push({
        id: nextId++,
        name: file.name,
        size: file.size,
        pages: doc.getPageCount(),
        bytes: bytes,
      });
    } catch (err) {
      console.error(err);
      problems.push(file.name);
    }
  }

  render();

  if (problems.length > 0) {
    setStatus(
      "Could not read: " + problems.join(", ") +
      ". The file may be damaged or password-protected.",
      "error"
    );
  } else if (skipped > 0) {
    setStatus(skipped + " file(s) skipped because they are not PDFs.", "error");
  } else if (files.length === 1) {
    setStatus("Add at least one more PDF to merge.");
  } else {
    setStatus("");
  }
}

function render() {
  fileList.textContent = "";

  files.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "file-item";
    li.draggable = true;
    li.dataset.index = index;

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = item.name;
    name.title = item.name;

    const meta = document.createElement("span");
    meta.className = "file-meta";
    const pageText = item.pages === 1 ? "1 page" : item.pages + " pages";
    meta.textContent = pageText + " · " + formatSize(item.size);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn-remove";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove " + item.name);
    remove.addEventListener("click", () => removeFile(item.id));

    li.append(name, meta, remove);

    li.addEventListener("dragstart", (e) => {
      dragIndex = index;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    });

    li.addEventListener("dragend", () => {
      dragIndex = null;
      li.classList.remove("dragging");
      clearDragOver();
    });

    li.addEventListener("dragover", (e) => {
      if (dragIndex === null) return;
      e.preventDefault();
      clearDragOver();
      li.classList.add("drag-over");
    });

    li.addEventListener("drop", (e) => {
      if (dragIndex === null) return;
      e.preventDefault();
      e.stopPropagation();
      const [moved] = files.splice(dragIndex, 1);
      files.splice(index, 0, moved);
      dragIndex = null;
      render();
    });

    fileList.appendChild(li);
  });

  const hasFiles = files.length > 0;
  fileSection.hidden = !hasFiles;
  dropZone.hidden = hasFiles;
  mergeBtn.disabled = files.length < 2;
}

function clearDragOver() {
  fileList.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
}

function removeFile(id) {
  files = files.filter((f) => f.id !== id);
  render();
  setStatus(files.length === 1 ? "Add at least one more PDF to merge." : "");
}

function clearAll() {
  files = [];
  render();
  setStatus("");
}

async function mergePdfs() {
  if (files.length < 2) return;

  mergeBtn.disabled = true;
  setStatus("Merging... please wait.");

  try {
    const merged = await PDFDocument.create();

    for (const item of files) {
      const source = await PDFDocument.load(item.bytes);
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }

    const mergedBytes = await merged.save();
    const blob = new Blob([mergedBytes], { type: "application/pdf" });

    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    downloadLink.href = resultUrl;

    fileSection.hidden = true;
    resultEl.hidden = false;
    setStatus("Done! Your PDFs were merged.", "success");
  } catch (err) {
    console.error(err);
    setStatus("Something went wrong while merging. Try again with different files.", "error");
    mergeBtn.disabled = false;
  }
}

function startOver() {
  if (resultUrl) {
    URL.revokeObjectURL(resultUrl);
    resultUrl = null;
  }
  downloadLink.removeAttribute("href");
  resultEl.hidden = true;
  files = [];
  render();
  setStatus("");
}

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = ""; 
});

addMoreBtn.addEventListener("click", () => fileInput.click());
clearBtn.addEventListener("click", clearAll);
mergeBtn.addEventListener("click", mergePdfs);
startOverBtn.addEventListener("click", startOver);

dropZone.addEventListener("click", (e) => {
  if (e.target.closest("label")) return;
  fileInput.click();
});

dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

["dragenter", "dragover"].forEach((type) => {
  dropZone.addEventListener(type, (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((type) => {
  dropZone.addEventListener(type, () => dropZone.classList.remove("dragover"));
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  addFiles(e.dataTransfer.files);
});

fileSection.addEventListener("dragover", (e) => {
  if (dragIndex === null) e.preventDefault();
});
fileSection.addEventListener("drop", (e) => {
  if (dragIndex === null) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }
});

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

render();
