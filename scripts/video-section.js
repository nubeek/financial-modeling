import { onReady } from "./utils.js";

function setControlState(control, playing) {
  control.dataset.state = playing ? "playing" : "paused";
  control.setAttribute("aria-label", playing ? "Pause video" : "Play video");
}

function initVideoSection() {
  const player = document.querySelector(".video-section__player");
  if (!player) return;

  const video = player.querySelector(".video-section__video");
  const control = player.querySelector(".video-section__control");
  if (!video || !control) return;

  control.addEventListener("click", () => {
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });

  video.addEventListener("play", () => setControlState(control, true));
  video.addEventListener("pause", () => setControlState(control, false));
  video.addEventListener("ended", () => setControlState(control, false));
}

onReady(initVideoSection);
