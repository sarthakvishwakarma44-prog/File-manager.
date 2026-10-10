const topBtn = document.createElement("button");
topBtn.id = "back-to-top";
topBtn.type = "button";
topBtn.textContent = "↑";
topBtn.setAttribute("aria-label", "Back to top");
document.body.appendChild(topBtn);

window.addEventListener("scroll", () => {
  topBtn.classList.toggle("show", window.scrollY > 400);
});

topBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
