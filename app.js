/* ─────────────────────────────────────────────────────────────
   EditorsAdda — Audio Engine & Interactive Logic
   Auto-syncing YouTube Playlist Edition
   ───────────────────────────────────────────────────────────── */

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
  volumeBtn: $('volumeBtn'),
  share: $('share'),
  shortcutsBtn: $('shortcutsBtn'),
  shortcutsModal: $('shortcutsModal'),
  closeModalBtn: $('closeModalBtn'),
};

const state = {
  tracks: [],
  order: [],
  pos: 0,
  shuffle: true,
  ready: false,
  playing: false,
  started: false,
  scrubbing: false,
  muted: false,
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

const currentTrack = () => state.tracks[state.order[state.pos]];

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

  el.player.classList.add('is-swapping');
  clearTimeout(swapTimer);
  swapTimer = setTimeout(() => el.player.classList.remove('is-swapping'), 60);

  el.title.textContent = t.title;
  el.artist.textContent = t.artist || 'EditorsAdda';
  el.cover.src = t.cover || '';
  el.cover.alt = `${t.title} artwork`;

  if (state.started) {
    document.title = `▶ ${t.title} — EditorsAdda`;
  }

  updateMediaSession(t);

  // Update active item in list
  [...el.listItems.children].forEach((li) => {
    const idx = Number(li.dataset.orderIndex);
    li.classList.toggle('is-current', idx === state.pos);
  });

  const activeLi = el.listItems.querySelector(`li[data-order-index="${state.pos}"]`);
  if (activeLi && el.list.classList.contains('is-open')) {
    activeLi.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function renderList(filterText = '') {
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

  el.trackCountBadge.textContent = `${state.tracks.length} tracks`;
}

/* ── Cuts / Timeline Odometer ────────────────────────────────── */
let cutsTimer = null;

function paintCuts() {
  el.cutsCount.textContent = Math.floor(state.cuts).toLocaleString();
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
  el.play.setAttribute('aria-label', on ? 'Pause' : 'Play');

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

  el.seekFill.style.transform = `scaleX(${frac})`;
  el.seekKnob.style.transform = `translate(-50%, -50%) translateX(${
    frac * el.seek.clientWidth
  }px)`;

  const second = Math.floor(cur);
  if (second !== lastSecond) {
    lastSecond = second;
    el.tCur.textContent = fmt(cur);
    el.seek.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
  }

  if (poll.duration !== lastDuration) {
    lastDuration = poll.duration;
    el.tDur.textContent = fmt(poll.duration);
  }
}

/* ── Seeking & Scrubbing ─────────────────────────────────────── */
function fractionFromEvent(e) {
  const r = el.seek.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
}

function previewSeek(frac) {
  el.seekFill.style.transform = `scaleX(${frac})`;
  el.seekKnob.style.transform = `translate(-50%, -50%) translateX(${
    frac * el.seek.clientWidth
  }px)`;
  if (yt && typeof yt.getDuration === 'function') {
    el.tCur.textContent = fmt((yt.getDuration() || 0) * frac);
  }
}

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

/* ── Auto-Sync Engine with YouTube Playlist ─────────────────── */
async function syncPlaylist(showIndicator = true) {
  if (showIndicator && el.syncBtn) el.syncBtn.classList.add('is-syncing');

  try {
    const res = await fetch('/api/tracks');
    if (!res.ok) throw new Error('API error');
    const newTracks = await res.json();

    if (Array.isArray(newTracks) && newTracks.length > 0) {
      const oldIds = state.tracks.map((t) => t.id).join(',');
      const newIds = newTracks.map((t) => t.id).join(',');

      if (oldIds !== newIds) {
        const currentPlayingTrack = currentTrack();
        state.tracks = newTracks;
        state.order = buildOrder();

        // Preserve active track index in new order
        if (currentPlayingTrack) {
          const newIdx = state.tracks.findIndex((t) => t.id === currentPlayingTrack.id);
          if (newIdx !== -1) {
            state.pos = Math.max(0, state.order.indexOf(newIdx));
          }
        }

        renderList(el.searchInput.value);
        renderTrack();
      }
    }
  } catch (err) {
    console.warn('Sync notice:', err.message);
  } finally {
    if (showIndicator && el.syncBtn) {
      setTimeout(() => el.syncBtn.classList.remove('is-syncing'), 600);
    }
  }
}

// Background auto-sync every 45 seconds
setInterval(() => syncPlaylist(false), 45000);

if (el.syncBtn) {
  el.syncBtn.addEventListener('click', () => syncPlaylist(true));
}

/* ── Control Event Listeners ─────────────────────────────────── */
el.play.addEventListener('click', toggle);

el.prev.addEventListener('click', () => {
  if (yt && (yt.getCurrentTime() || 0) > 3) yt.seekTo(0, true);
  else go(state.pos - 1);
});

el.next.addEventListener('click', () => go(state.pos + 1));

el.shuffle.addEventListener('click', () => {
  const keep = currentTrack();
  state.shuffle = !state.shuffle;
  el.shuffle.classList.toggle('is-on', state.shuffle);
  el.shuffle.setAttribute('aria-pressed', String(state.shuffle));

  state.order = buildOrder();
  state.pos = Math.max(0, state.order.indexOf(state.tracks.indexOf(keep)));
  renderList(el.searchInput.value);
  renderTrack();
});

el.listBtn.addEventListener('click', () => {
  const open = !el.list.classList.contains('is-open');
  el.list.classList.toggle('is-open', open);
  el.listBtn.classList.toggle('is-on', open);
  el.listBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    el.searchInput.focus();
    const activeLi = el.listItems.querySelector(`li[data-order-index="${state.pos}"]`);
    activeLi?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    syncPlaylist(false); // Check for playlist updates on open
  }
});

el.searchInput.addEventListener('input', (e) => {
  renderList(e.target.value);
});

el.volumeBtn.addEventListener('click', () => {
  if (!yt) return;
  state.muted = !state.muted;
  if (state.muted) {
    yt.mute();
    el.volumeBtn.querySelector('.i-vol-high').style.display = 'none';
    el.volumeBtn.querySelector('.i-vol-mute').style.display = 'block';
  } else {
    yt.unMute();
    el.volumeBtn.querySelector('.i-vol-high').style.display = 'block';
    el.volumeBtn.querySelector('.i-vol-mute').style.display = 'none';
  }
});

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

el.shortcutsBtn.addEventListener('click', () => el.shortcutsModal.showModal());
el.closeModalBtn.addEventListener('click', () => el.shortcutsModal.close());
el.shortcutsModal.addEventListener('click', (e) => {
  if (e.target === el.shortcutsModal) el.shortcutsModal.close();
});

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
    case 'm':
    case 'M':
      el.volumeBtn.click();
      break;
    case 's':
    case 'S':
      el.shuffle.click();
      break;
    case '?':
      el.shortcutsBtn.click();
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
  el.clock.textContent = d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
tickClock();
setInterval(tickClock, 1000);

let activeEditors = 18;
setInterval(() => {
  const delta = Math.floor(Math.random() * 3) - 1;
  activeEditors = Math.max(12, Math.min(36, activeEditors + delta));
  el.listeners.textContent = String(activeEditors);
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
      playsinline: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
    },
    events: {
      onReady: () => {
        state.ready = true;
        el.play.disabled = false;
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
      onError: () => {
        if (state.started) go(state.pos + 1);
      },
    },
  });

  setInterval(samplePlayer, 250);
  requestAnimationFrame(paintProgress);
};

/* ── Initialization ─────────────────────────────────────────── */
(async function init() {
  try {
    const res = await fetch('/api/tracks').catch(() => fetch('tracks.json'));
    state.tracks = await res.json();
  } catch {
    el.title.textContent = 'Could not load tracks';
    return;
  }

  state.order = buildOrder();
  renderList();
  renderTrack();

  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.append(s);
})();
