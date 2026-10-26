// Spoken mode: the game reads itself aloud (decisions 2026-10-25,
// questions-are-not-the-ration §5 — "a preschooler can play"). The
// browser's own speechSynthesis does it: on-device, free, no runtime
// dependency, and nothing said here leaves the machine.
//
// The listening half is deliberately absent, and this is a hard rule
// rather than a gap in the work: **a kid's voice never leaves the
// machine.** Chrome's SpeechRecognition uploads the recording to
// Google's servers, so it is never used — not behind a flag, not as a
// fallback. The big mic button ships only together with a local
// listener (the candidate is Cactus Compute's Whistle, server-side on
// localhost), which takes its own decision file, install and
// hand-verification first. Until then the kid's input is tap-to-pick
// picture prompts, which need no reading and no microphone.
//
// A device with no voices, a locked-down browser, or a kid who has
// been given the reader toggle simply gets silence: nothing here is
// load-bearing for play.

export function makeVoice({ enabled = false } = {}) {
  const synth = typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
  let on = enabled;

  // Spoken words are read as they are written, minus the decoration:
  // a screenful of emoji read aloud is noise to a listener.
  function plain(text) {
    return String(text ?? '')
      .replace(/[\p{Extended_Pictographic}‍️]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function say(text, { interrupt = true } = {}) {
    const words = plain(text);
    if (!on || !synth || !words) return false;
    try {
      if (interrupt) synth.cancel();
      const u = new SpeechSynthesisUtterance(words);
      u.rate = 0.95; // a child's pace, not a newsreader's
      u.pitch = 1.05;
      synth.speak(u);
      return true;
    } catch {
      return false; // a silent device still plays the game
    }
  }

  function hush() {
    try {
      synth?.cancel();
    } catch {
      /* nothing to stop */
    }
  }

  return {
    say,
    hush,
    get enabled() {
      return on;
    },
    setEnabled(v) {
      on = v === true;
      if (!on) hush();
    },
  };
}
