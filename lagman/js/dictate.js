// dictate.js — free, built-in voice capture via the Web Speech API. No plugin,
// no key, no server of ours: the browser transcribes. Safari/Chrome only; where
// unsupported the textarea still works (and the phone keyboard's mic key
// dictates into it natively).

export function dictationSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// createDictation({ onText(final, interim), onState(listening, error?) })
export function createDictation({ onText, onState }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';

  let active = false;
  let finalText = '';

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + ' ';
      else interim += r[0].transcript;
    }
    onText(finalText, interim);
  };
  // Mobile recognisers stop themselves after silence — restart while active.
  rec.onend = () => {
    if (active) { try { rec.start(); } catch (e) { active = false; onState(false); } }
    else onState(false);
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture' || e.error === 'network') {
      active = false; onState(false, e.error);
    }
  };

  return {
    start(seed) {
      finalText = seed ? seed.replace(/\s*$/, ' ') : '';
      active = true;
      try { rec.start(); onState(true); } catch (e) { /* already running */ }
    },
    stop() { active = false; try { rec.stop(); } catch (e) { /* noop */ } },
    isActive: () => active,
  };
}
