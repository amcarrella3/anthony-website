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
    el.setAttribute('muted', '');
    el.setAttribute('playsinline', '');
    parent.appendChild(el);
  }
  function start() {
    el.src = './' + String(slot.feed.source || '').replace(/^\//, '');
    const go = () => el.play().catch(() => {});
    go();
  }
  function stop() { try { el.pause(); } catch (_) {} }
  return { mount, start, stop };
}
