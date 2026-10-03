const { PDFDocument } = PDFLib;

let images = []; 
let nextId = 1;

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

setupDropZone(addImages);

function addImages(list) {
  const valid = list.filter((f) => f.type.startsWith("image/"));
  const skipped = list.length - valid.length;

  valid.forEach((file) => images.push({ id: nextId++, file, url: URL.createObjectURL(file) }));
  render();

  if (valid.length === 0) setStatus("Please choose image files (JPG, PNG, WebP...).", "error");
  else if (skipped > 0) setStatus(skipped + " file(s) skipped because they are not images.", "error");
  else setStatus("");
}

function makeButton(text, label, onClick, disabled) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-move";
  b.textContent = text;
  b.setAttribute("aria-label", label);
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

function move(index, step) {
  const target = index + step;
  if (target < 0 || target >= images.length) return;
  [images[index], images[target]] = [images[target], images[index]];
  render();
}

function removeImage(id) {
  const item = images.find((i) => i.id === id);
  if (item) URL.revokeObjectURL(item.url);
  images = images.filter((i) => i.id !== id);
  render();
}

function render() {
  const list = $("file-list");
  list.textContent = "";

  images.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "file-item image-item";

    const img = document.createElement("img");
    img.className = "thumb";
    img.src = item.url;
    img.alt = "";

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = item.file.name;
    name.title = item.file.name;

    const meta = document.createElement("span");
    meta.className = "file-meta";
    meta.textContent = "Page " + (index + 1) + " · " + formatSize(item.file.size);

    const actions = document.createElement("span");
    actions.className = "item-actions";
    actions.append(
      makeButton("↑", "Move " + item.file.name + " up", () => move(index, -1), index === 0),
      makeButton("↓", "Move " + item.file.name + " down", () => move(index, 1), index === images.length - 1)
    );
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn-remove";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove " + item.file.name);
    remove.addEventListener("click", () => removeImage(item.id));
    actions.append(remove);

    const text = document.createElement("span");
    text.className = "item-text";
    text.append(name, meta);

    li.append(img, text, actions);
    list.appendChild(li);
  });

  showWork(images.length > 0);
  $("action-btn").disabled = images.length === 0;
}

$("clear-all").addEventListener("click", () => {
  images.forEach((i) => URL.revokeObjectURL(i.url));
  images = [];
  render();
  setStatus("");
});

async function embedImage(pdf, file) {
  if (file.type === "image/jpeg") return pdf.embedJpg(new Uint8Array(await file.arrayBuffer()));
  if (file.type === "image/png") return pdf.embedPng(new Uint8Array(await file.arrayBuffer()));

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  canvas.width = 0;
  return pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
}

$("action-btn").addEventListener("click", async () => {
  if (images.length === 0) return;
  const btn = $("action-btn");
  btn.disabled = true;

  const sizeChoice = $("page-size").value;
  const margin = Number($("margin").value);
  const failed = [];

  try {
    const pdf = await PDFDocument.create();

    for (let i = 0; i < images.length; i++) {
      setStatus("Adding image " + (i + 1) + " of " + images.length + "...");
      try {
        const img = await embedImage(pdf, images[i].file);
        const w = img.width;
        const h = img.height;

        let pw, ph;
        if (sizeChoice === "fit") {
          pw = w + margin * 2;
          ph = h + margin * 2;
        } else {
          [pw, ph] = PAGE_SIZES[sizeChoice];
          if (w > h) [pw, ph] = [ph, pw];
        }

        const scale = Math.min((pw - margin * 2) / w, (ph - margin * 2) / h);
        const dw = w * scale;
        const dh = h * scale;

        const page = pdf.addPage([pw, ph]);
        page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
      } catch (err) {
        console.error(err);
        failed.push(images[i].file.name);
      }
    }

    if (pdf.getPageCount() === 0) {
      setStatus("None of the images could be read.", "error");
      return;
    }

    showResult(await pdf.save(), "application/pdf", "images.pdf");
    if (failed.length) setStatus("Done, but skipped: " + failed.join(", "), "error");
    else setStatus("Done!", "success");
  } catch (err) {
    console.error(err);
    setStatus("Something went wrong. Please try other images.", "error");
  } finally {
    btn.disabled = images.length === 0;
  }
});

render();
