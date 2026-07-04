// organs/audio.js — a sound Anthony uploaded. Loops; layers with other audio.
// Autoplay-with-sound is blocked until a user gesture, so it plays on the first
// interaction. The visible marker is a minimal glyph (his to mask/style/place).

export function createAudio(piece) {
  let el, chip, audio, playing = false;

  function mount(parent) {
    el = document.createElement('div');
    el.className = 'audio-piece';
    audio = document.createElement('audio');
    audio.loop = true;
    audio.preload = 'auto';
    audio.src = './' + String(piece.feed.source || '').replace(/^\//, '');
    audio.volume = piece.audioVol != null ? piece.audioVol : 0.8;
    chip = document.createElement('button');
    chip.className = 'audio-chip';
    chip.type = 'button';
    chip.textContent = '♪';
    chip.title = String(piece.feed.source || '').split('/').pop();
    chip.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    el.append(audio, chip);
    parent.appendChild(el);
  }

  function play() { audio.play().then(() => { playing = true; el.classList.add('is-playing'); }).catch(() => {}); }
  function pause() { audio.pause(); playing = false; el.classList.remove('is-playing'); }
  function toggle() { playing ? pause() : play(); }

  function start() {
    if (piece.autoplay === false) return;
    play();
    // if the browser blocked autoplay, start on the first user gesture
    const unlock = () => { if (!playing) play(); document.removeEventListener('pointerdown', unlock); };
    document.addEventListener('pointerdown', unlock, { once: true });
  }
  function stop() { try { audio.pause(); } catch (_) {} }

  return { mount, start, stop };
}
