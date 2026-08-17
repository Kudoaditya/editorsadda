/* ─────────────────────────────────────────────────────────────
   EditorsAdda — Audio Engine & Interactive Logic
   Auto-syncing YouTube Playlist Edition (100% Fail-Proof)
   ───────────────────────────────────────────────────────────── */

const DEFAULT_TRACKS = [
  {
    "id": "E7ergOnpO1Q",
    "title": "Not Guilty",
    "artist": "Dhanda Nyoliwala",
    "album": "EditorsAdda Playlist",
    "duration": 240,
    "cover": "https://i.ytimg.com/vi/E7ergOnpO1Q/hqdefault.jpg",
    "rawTitle": "Dhanda Nyoliwala - Not Guilty (Official Music Video)"
  },
  {
    "id": "ZYIWPnkXz5o",
    "title": "Panamera",
    "artist": "Dhanda Nyoliwala",
    "album": "EditorsAdda Playlist",
    "duration": 240,
    "cover": "https://i.ytimg.com/vi/ZYIWPnkXz5o/hqdefault.jpg",
    "rawTitle": "Dhanda Nyoliwala - Panamera (Official Music Video)"
  },
  {
    "id": "bUk1YcCPfpQ",
    "title": "Zigane",
    "artist": "Dhanda Nyoliwala",
    "album": "EditorsAdda Playlist",
    "duration": 240,
    "cover": "https://i.ytimg.com/vi/bUk1YcCPfpQ/hqdefault.jpg",
    "rawTitle": "Dhanda Nyoliwala - Zigane (Official Music Video)"
  }
];

const $ = (id) => document.getElementById(id);

const el = {
  player: $('player'),
  cover: $('cover'),
  title: $('title'),
  artist: $('artist'),
  seek: $('seek'),
  seekFill: $('seekFill'),
  seekKnob: $('seekKnob'),
  tCur: $('tCur'),
  tDur: $('tDur'),
  play: $('play'),
  prev: $('prev'),
  next: $('next'),
  shuffle: $('shuffle'),
  listBtn: $('listBtn'),
  syncBtn: $('syncBtn'),
  list: $('list'),
  listItems: $('listItems'),
  trackCountBadge: $('trackCountBadge'),
  searchInput: $('searchInput'),
  clock: $('clock'),
  cutsCount: $('cutsCount'),
  listeners: $('listeners'),
  volumeGroup: $('volumeGroup'),
  volumeBtn: $('volumeBtn'),
  volumeSlider: $('volumeSlider'),
  share: $('share'),
  shortcutsBtn: $('shortcutsBtn'),
  shortcutsModal: $('shortcutsModal'),
  closeModalBtn: $('closeModalBtn'),
  toast: $('toast'),
  toastIcon: $('toastIcon'),
  toastMsg: $('toastMsg'),
};

const state = {
  tracks: DEFAULT_TRACKS,
  order: [],
  pos: 0,
  shuffle: true,
  ready: false,
  playing: false,
  started: false,
  scrubbing: false,
  muted: false,
  volume: Number(localStorage.getItem('ea-volume')) || 100,
  lastVolume: Number(localStorage.getItem('ea-volume')) || 100,
  cuts: Number(localStorage.getItem('ea-cuts')) || 0,
};

let yt = null;

/* ── Time & Math Helpers ─────────────────────────────────────── */
const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildOrder() {
  const seq = Array.from({ length: state.tracks.length }, (_, i) => i);
  return state.shuffle ? shuffleArray(seq) : seq;
}

const currentTrack = () => state.tracks[state.order[state.pos]] || state.tracks[0];

/* ── Rendering Track & Playlist ──────────────────────────────── */
let swapTimer = null;

function updateMediaSession(t) {
  if ('mediaSession' in navigator && t) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album || 'EditorsAdda Playlist',
      artwork: [
        { src: t.cover || '', sizes: '512x512', type: 'image/jpeg' },
      ],
    });
  }
}

function renderTrack() {
  const t = currentTrack();
  if (!t) return;

  if (el.player) {
    el.player.classList.add('is-swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => el.player.classList.remove('is-swapping'), 60);
  }

  if (el.title) el.title.textContent = t.title;
  if (el.artist) el.artist.textContent = t.artist || 'EditorsAdda';
  if (el.cover) {
    el.cover.src = t.cover || '';
    el.cover.alt = `${t.title} artwork`;
  }

  if (state.started) {
    document.title = `▶ ${t.title} — EditorsAdda`;
  }

  updateMediaSession(t);

  if (el.listItems) {
    [...el.listItems.children].forEach((li) => {
      const idx = Number(li.dataset.orderIndex);
      li.classList.toggle('is-current', idx === state.pos);
    });

    const activeLi = el.listItems.querySelector(`li[data-order-index="${state.pos}"]`);
    if (activeLi && el.list && el.list.classList.contains('is-open')) {
      activeLi.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

function renderList(filterText = '') {
  if (!el.listItems) return;
  el.listItems.innerHTML = '';
  const query = filterText.toLowerCase().trim();

  state.order.forEach((trackIdx, orderIndex) => {
    const t = state.tracks[trackIdx];
    if (!t) return;
    if (query && !t.title.toLowerCase().includes(query) && !t.artist.toLowerCase().includes(query)) {
      return;
    }

    const li = document.createElement('li');
    li.dataset.orderIndex = orderIndex;
    if (orderIndex === state.pos) li.classList.add('is-current');

    const btn = document.createElement('button');
    btn.type = 'button';

    const num = document.createElement('span');
    num.className = 't-num';
    num.textContent = String(orderIndex + 1).padStart(2, '0');

    const info = document.createElement('div');
    info.className = 't-info';

    const title = document.createElement('span');
    title.className = 't-title';
    title.textContent = t.title;

    const artist = document.createElement('span');
    artist.className = 't-artist';
    artist.textContent = t.artist || 'EditorsAdda';

    info.append(title, artist);
    btn.append(num, info);
    btn.addEventListener('click', () => go(orderIndex));

    li.append(btn);
    el.listItems.append(li);
  });

  if (el.trackCountBadge) {
    el.trackCountBadge.textContent = `${state.tracks.length} tracks`;
  }
}

/* ── Cuts / Timeline Odometer ────────────────────────────────── */
let cutsTimer = null;

function paintCuts() {
  if (el.cutsCount) el.cutsCount.textContent = Math.floor(state.cuts).toLocaleString();
}

function cutsTick() {
  state.cuts += 1;
  localStorage.setItem('ea-cuts', String(state.cuts));
  paintCuts();
}
paintCuts();

/* ── Playback State Indicator ────────────────────────────────── */
function renderPlaying(on) {
  state.playing = on;
  document.body.classList.toggle('is-playing', on);
  if (el.play) el.play.setAttribute('aria-label', on ? 'Pause' : 'Play');

  clearInterval(cutsTimer);
  if (on) cutsTimer = setInterval(cutsTick, 5000);
}

/* ── Playback Navigation ─────────────────────────────────────── */
function go(newPos) {
  const n = state.order.length;
  if (!n) return;
  state.pos = ((newPos % n) + n) % n;
  renderTrack();
  if (!yt) return;
  state.started = true;
  yt.loadVideoById(currentTrack().id);
}

function toggle() {
  if (!yt || !state.ready) return;
  if (state.playing) {
    yt.pauseVideo();
  } else {
    state.started = true;
    yt.playVideo();
  }
}

/* ── Autoplay on First User Interaction ──────────────────────── */
let userInteracted = false;

function maybeAutoStart() {
  if (userInteracted && yt && state.ready && !state.started) {
    state.started = true;
    yt.playVideo();
  }
}

['pointerdown', 'keydown'].forEach((evt) =>
  document.addEventListener(
    evt,
    () => {
      userInteracted = true;
      maybeAutoStart();
    },
    { once: true, capture: true },
  ),
);

/* ── 60 FPS Extrapolated Progress Bar ────────────────────────── */
const poll = { at: 0, time: 0, duration: 0 };
let lastSecond = -1;
let lastDuration = -1;

function samplePlayer() {
  if (!yt || typeof yt.getCurrentTime !== 'function') return;
  poll.time = yt.getCurrentTime() || 0;
  poll.duration = yt.getDuration() || 0;
  poll.at = performance.now();
}

function paintProgress() {
  requestAnimationFrame(paintProgress);
  if (!yt || state.scrubbing || !poll.duration) return;

  const drift = state.playing ? (performance.now() - poll.at) / 1000 : 0;
  const cur = Math.min(poll.duration, poll.time + drift);
  const frac = Math.min(1, Math.max(0, cur / poll.duration));

  if (el.seekFill) el.seekFill.style.transform = `scaleX(${frac})`;
  if (el.seekKnob && el.seek) {
    el.seekKnob.style.transform = `translate(-50%, -50%) translateX(${
      frac * el.seek.clientWidth
    }px)`;
  }

  const second = Math.floor(cur);
  if (second !== lastSecond) {
    lastSecond = second;
    if (el.tCur) el.tCur.textContent = fmt(cur);
    if (el.seek) el.seek.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
  }

  if (poll.duration !== lastDuration) {
    lastDuration = poll.duration;
    if (el.tDur) el.tDur.textContent = fmt(poll.duration);
  }
}

/* ── Seeking & Scrubbing ─────────────────────────────────────── */
function fractionFromEvent(e) {
  if (!el.seek) return 0;
  const r = el.seek.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
}

function previewSeek(frac) {
  if (el.seekFill) el.seekFill.style.transform = `scaleX(${frac})`;
  if (el.seekKnob && el.seek) {
    el.seekKnob.style.transform = `translate(-50%, -50%) translateX(${
      frac * el.seek.clientWidth
    }px)`;
  }
  if (yt && typeof yt.getDuration === 'function' && el.tCur) {
    el.tCur.textContent = fmt((yt.getDuration() || 0) * frac);
  }
}

if (el.seek) {
  el.seek.addEventListener('pointerdown', (e) => {
    if (!yt) return;
    state.scrubbing = true;
    el.seek.setPointerCapture(e.pointerId);
    previewSeek(fractionFromEvent(e));
  });

  el.seek.addEventListener('pointermove', (e) => {
    if (state.scrubbing) previewSeek(fractionFromEvent(e));
  });

  el.seek.addEventListener('pointerup', (e) => {
    if (!state.scrubbing) return;
    state.scrubbing = false;
    el.seek.releasePointerCapture(e.pointerId);
    const dur = yt?.getDuration?.() || 0;
    if (dur) yt.seekTo(dur * fractionFromEvent(e), true);
    samplePlayer();
  });
}

/* ── Toast Notification System ──────────────────────────────── */
let toastTimer = null;
function showToast(icon, msg, duration = 2800) {
  if (!el.toast) return;
  if (el.toastIcon) el.toastIcon.textContent = icon;
  if (el.toastMsg) el.toastMsg.textContent = msg;

  el.toast.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.remove('is-shown');
  }, duration);
}

/* ── Auto-Sync Engine with YouTube Playlist ─────────────────── */
async function syncPlaylist(showIndicator = true) {
  if (showIndicator) {
    if (el.syncBtn) el.syncBtn.classList.add('is-syncing');
    showToast('⚡', 'Checking YouTube playlist…', 5000);
  }

  let newTracks = null;

  try {
    // 1. Try local backend server sync trigger first (if running ruby server)
    try {
      const syncRes = await fetch('/api/sync');
      if (syncRes && syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData && Array.isArray(syncData.tracks) && syncData.tracks.length > 0) {
          newTracks = syncData.tracks;
        }
      }
    } catch {}

    // 2. Try regular local tracks endpoint
    if (!newTracks) {
      try {
        const trackRes = await fetch('/api/tracks');
        if (trackRes && trackRes.ok) {
          const trackData = await trackRes.json();
          if (Array.isArray(trackData) && trackData.length > 0) {
            newTracks = trackData;
          }
        }
      } catch {}
    }

    // 3. Try static tracks.json with cache-busting
    if (!newTracks) {
      try {
        const staticRes = await fetch('tracks.json?v=' + Date.now());
        if (staticRes && staticRes.ok) {
          const staticData = await staticRes.json();
          if (Array.isArray(staticData) && staticData.length > 0) {
            newTracks = staticData;
          }
        }
      } catch {}
    }

    // 4. Try raw GitHub repo backup (for live GitHub Pages instant updates)
    if (!newTracks) {
      try {
        const ghRes = await fetch('https://raw.githubusercontent.com/Kudoaditya/editorsadda/main/tracks.json?v=' + Date.now());
        if (ghRes && ghRes.ok) {
          const ghData = await ghRes.json();
          if (Array.isArray(ghData) && ghData.length > 0) {
            newTracks = ghData;
          }
        }
      } catch {}
    }

    if (Array.isArray(newTracks) && newTracks.length > 0) {
      const oldIds = state.tracks.map((t) => t.id).join(',');
      const newIds = newTracks.map((t) => t.id).join(',');

      if (oldIds !== newIds) {
        const currentPlayingTrack = currentTrack();
        state.tracks = newTracks;
        state.order = buildOrder();

        if (currentPlayingTrack) {
          const newIdx = state.tracks.findIndex((t) => t.id === currentPlayingTrack.id);
          if (newIdx !== -1) {
            state.pos = Math.max(0, state.order.indexOf(newIdx));
          }
        }

        renderList(el.searchInput ? el.searchInput.value : '');
        renderTrack();

        if (showIndicator) {
          showToast('✨', `Playlist updated (${newTracks.length} tracks)`, 3000);
        }
      } else {
        if (showIndicator) {
          showToast('✓', `Playlist is up to date (${newTracks.length} tracks)`, 2500);
        }
      }
    } else {
      if (showIndicator) {
        showToast('✓', `Playlist active (${state.tracks.length} tracks)`, 2500);
      }
    }
  } catch (err) {
    console.warn('Sync notice:', err.message);
    if (showIndicator) {
      showToast('✓', `Playlist active (${state.tracks.length} tracks)`, 2500);
    }
  } finally {
    if (showIndicator && el.syncBtn) {
      setTimeout(() => el.syncBtn.classList.remove('is-syncing'), 800);
    }
  }
}

// Background auto-sync every 45 seconds
setInterval(() => syncPlaylist(false), 45000);

if (el.syncBtn) {
  el.syncBtn.addEventListener('click', () => syncPlaylist(true));
}

/* ── Control Event Listeners ─────────────────────────────────── */
if (el.play) el.play.addEventListener('click', toggle);

if (el.prev) {
  el.prev.addEventListener('click', () => {
    if (yt && (yt.getCurrentTime() || 0) > 3) yt.seekTo(0, true);
    else go(state.pos - 1);
  });
}

if (el.next) el.next.addEventListener('click', () => go(state.pos + 1));

if (el.shuffle) {
  el.shuffle.addEventListener('click', () => {
    const keep = currentTrack();
    state.shuffle = !state.shuffle;
    el.shuffle.classList.toggle('is-on', state.shuffle);
    el.shuffle.setAttribute('aria-pressed', String(state.shuffle));

    state.order = buildOrder();
    state.pos = Math.max(0, state.order.indexOf(state.tracks.indexOf(keep)));
    renderList(el.searchInput ? el.searchInput.value : '');
    renderTrack();
  });
}

if (el.listBtn && el.list) {
  el.listBtn.addEventListener('click', () => {
    const open = !el.list.classList.contains('is-open');
    el.list.classList.toggle('is-open', open);
    el.listBtn.classList.toggle('is-on', open);
    el.listBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      if (el.searchInput) el.searchInput.focus();
      const activeLi = el.listItems ? el.listItems.querySelector(`li[data-order-index="${state.pos}"]`) : null;
      activeLi?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      syncPlaylist(false);
    }
  });
}

if (el.searchInput) {
  el.searchInput.addEventListener('input', (e) => {
    renderList(e.target.value);
  });
}

/* ── Volume Control Logic & Slider ───────────────────────────── */
function updateVolumeIcons(val) {
  if (!el.volumeBtn) return;
  const h = el.volumeBtn.querySelector('.i-vol-high');
  const l = el.volumeBtn.querySelector('.i-vol-low');
  const m = el.volumeBtn.querySelector('.i-vol-mute');

  if (h) h.style.display = val >= 50 ? 'block' : 'none';
  if (l) l.style.display = (val > 0 && val < 50) ? 'block' : 'none';
  if (m) m.style.display = val === 0 ? 'block' : 'none';
}

function setVolume(val, updateInput = true) {
  val = Math.max(0, Math.min(100, Math.round(val)));
  state.volume = val;
  state.muted = (val === 0);
  localStorage.setItem('ea-volume', String(val));

  if (val > 0) state.lastVolume = val;

  if (el.volumeSlider && updateInput) {
    el.volumeSlider.value = String(val);
  }

  if (yt && typeof yt.setVolume === 'function') {
    if (val === 0) {
      yt.mute();
    } else {
      yt.unMute();
      yt.setVolume(val);
    }
  }

  updateVolumeIcons(val);
}

if (el.volumeSlider) {
  el.volumeSlider.value = String(state.volume);
  updateVolumeIcons(state.volume);

  el.volumeSlider.addEventListener('input', (e) => {
    setVolume(Number(e.target.value), false);
  });
}

if (el.volumeBtn) {
  el.volumeBtn.addEventListener('click', () => {
    if (state.volume > 0) {
      state.lastVolume = state.volume;
      setVolume(0);
    } else {
      setVolume(state.lastVolume || 80);
    }
  });
}

if (el.share) {
  el.share.addEventListener('click', async () => {
    const track = currentTrack();
    const text = track
      ? `Listening to "${track.title}" on EditorsAdda`
      : 'EditorsAdda — Music for Video Editors, Creators & Late Night Cuts';
    const shareData = { title: 'EditorsAdda', text, url: location.href };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
      return;
    }

    await navigator.clipboard.writeText(shareData.url);
    const orig = el.share.innerHTML;
    el.share.innerHTML = '<span style="font-size:12px; font-weight:bold;">✓</span>';
    setTimeout(() => (el.share.innerHTML = orig), 1500);
  });
}

if (el.shortcutsBtn && el.shortcutsModal) {
  el.shortcutsBtn.addEventListener('click', () => el.shortcutsModal.showModal());
}
if (el.closeModalBtn && el.shortcutsModal) {
  el.closeModalBtn.addEventListener('click', () => el.shortcutsModal.close());
}
if (el.shortcutsModal) {
  el.shortcutsModal.addEventListener('click', (e) => {
    if (e.target === el.shortcutsModal) el.shortcutsModal.close();
  });
}

/* ── Keyboard Shortcuts ──────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, [contenteditable]')) return;

  switch (e.key) {
    case ' ':
    case 'k':
    case 'K':
      e.preventDefault();
      toggle();
      break;
    case 'n':
    case 'N':
      go(state.pos + 1);
      break;
    case 'p':
    case 'P':
      go(state.pos - 1);
      break;
    case 'j':
    case 'J':
      if (yt) yt.seekTo(Math.max(0, (yt.getCurrentTime() || 0) - 5), true);
      break;
    case 'l':
    case 'L':
      if (e.target !== el.searchInput) {
        if (yt) yt.seekTo(Math.min(yt.getDuration() || 0, (yt.getCurrentTime() || 0) + 5), true);
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      setVolume(state.volume + 5);
      break;
    case 'ArrowDown':
      e.preventDefault();
      setVolume(state.volume - 5);
      break;
    case 'm':
    case 'M':
      if (el.volumeBtn) el.volumeBtn.click();
      break;
    case 's':
    case 'S':
      if (el.shuffle) el.shuffle.click();
      break;
    case '?':
      if (el.shortcutsBtn) el.shortcutsBtn.click();
      break;
  }
});

/* ── MediaSession Action Handlers ────────────────────────────── */
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', toggle);
  navigator.mediaSession.setActionHandler('pause', toggle);
  navigator.mediaSession.setActionHandler('previoustrack', () => go(state.pos - 1));
  navigator.mediaSession.setActionHandler('nexttrack', () => go(state.pos + 1));
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (yt && details.seekTime !== undefined) yt.seekTo(details.seekTime, true);
  });
}

/* ── Clock & Live Presence ───────────────────────────────────── */
function tickClock() {
  const d = new Date();
  if (el.clock) {
    el.clock.textContent = d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
tickClock();
setInterval(tickClock, 1000);

let activeEditors = 18;
setInterval(() => {
  const delta = Math.floor(Math.random() * 3) - 1;
  activeEditors = Math.max(12, Math.min(36, activeEditors + delta));
  if (el.listeners) el.listeners.textContent = String(activeEditors);
}, 15000);

/* ── YouTube Iframe Boot ─────────────────────────────────────── */
function preferAudio() {
  try {
    yt?.setPlaybackQuality?.('tiny');
  } catch {}
}

window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player('yt-player', {
    height: '1',
    width: '1',
    videoId: currentTrack().id,
    playerVars: {
      origin: window.location.origin,
      enablejsapi: 1,
      playsinline: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      autoplay: 0,
    },
    events: {
      onReady: () => {
        state.ready = true;
        if (el.play) el.play.disabled = false;
        try {
          yt.setVolume(state.volume);
          if (state.muted) yt.mute();
        } catch {}
        preferAudio();
        maybeAutoStart();
      },
      onStateChange: (e) => {
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) {
          renderPlaying(true);
          preferAudio();
        } else if (e.data === S.PAUSED || e.data === S.BUFFERING) {
          renderPlaying(e.data === S.BUFFERING && state.playing);
        } else if (e.data === S.ENDED) {
          go(state.pos + 1);
        }
      },
      onError: (err) => {
        console.warn('YouTube Player notice:', err);
        showToast('⏭️', 'Skipping to next track…', 2000);
        setTimeout(() => go(state.pos + 1), 500);
      },
    },
  });

  setInterval(samplePlayer, 250);
  requestAnimationFrame(paintProgress);
};

/* ── Interactive 3D Mouse Parallax & Dynamic Equalizer ───────── */
const bgImg = $('bgImg');
const dock = $('dock');
const spectrumBars = document.querySelectorAll('.spectrum-bar');

window.addEventListener('mousemove', (e) => {
  const normX = (e.clientX / window.innerWidth - 0.5) * 2;
  const normY = (e.clientY / window.innerHeight - 0.5) * 2;

  if (bgImg) {
    bgImg.style.transform = `scale(1.05) translate(${normX * -12}px, ${normY * -12}px)`;
  }

  if (dock && window.innerWidth > 768) {
    dock.style.transform = `perspective(1000px) rotateX(${normY * -3.5}deg) rotateY(${normX * 4.5}deg)`;
  }
});

// Dynamic Multi-Frequency Soundwave Waveform Generator
let wavePhase = 0;
function animateSpectrum() {
  requestAnimationFrame(animateSpectrum);
  if (!state.playing || !spectrumBars.length) return;

  wavePhase += 0.08;
  spectrumBars.forEach((bar, i) => {
    const wave = Math.sin(wavePhase + i * 0.45) * 0.5 + 0.5;
    const wave2 = Math.cos(wavePhase * 1.6 + i * 0.25) * 0.5 + 0.5;
    const height = 6 + Math.floor((wave * 0.6 + wave2 * 0.4) * 30);
    bar.style.height = `${height}px`;
  });
}
requestAnimationFrame(animateSpectrum);

/* ── Initialization ─────────────────────────────────────────── */
(async function init() {
  state.tracks = DEFAULT_TRACKS;

  try {
    const res = await fetch('tracks.json?v=' + Date.now());
    if (res && res.ok) {
      const fetched = await res.json();
      if (Array.isArray(fetched) && fetched.length > 0) {
        state.tracks = fetched;
      }
    }
  } catch (err) {
    console.warn('Using default tracks fallback:', err);
  }

  state.order = buildOrder();
  renderList();
  renderTrack();

  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.append(s);
})();
