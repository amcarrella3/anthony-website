// organs/video.js — a video (Anthony's lens), looping quietly, filling its slot.
// Masking + color are handled at the slot level. Muted + inline so it autoplays.

export function createVideo(slot) {
  let el;
  function mount(parent) {
    el = document.createElement('video');
    el.className = 'media media--video';
    el.muted = true;
    el.loop = true;
    el.autoplay = true;
    el.playsInline = true;
    el.preload = 'auto';                 // buffer ahead so the threshold hides the wait
    el.setAttribute('muted', '');
    el.setAttribute('playsinline', '');
    parent.appendChild(el);
  }
  function start() {
    el.src = './' + String(slot.feed.source || '').replace(/^\//, '');
    const go = () => el.play().catch(() => {});
    go();
    // keep trying as data arrives + if the tab was backgrounded during load
    el.addEventListener('loadeddata', go, { once: true });
    el.addEventListener('canplay', go, { once: true });
  }
  function stop() { try { el.pause(); } catch (_) {} }
  return { mount, start, stop };
}
