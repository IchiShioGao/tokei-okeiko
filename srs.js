// FSRS-based spaced repetition (Free Spaced Repetition Scheduler, v4.5-ish).
//
// Item shape:
//   { id, mode, level, params,
//     state: 'new'|'learning'|'review'|'relearning',
//     D, S,            // difficulty (1..10), stability (days)
//     lastReview, due, // timestamps (ms since epoch)
//     reps, lapses }
//
// `mode`   : 'read' (clock-reading) | 'calc' (time calculations)
// `level`  : 1..5 for read, 'c1'..'c5' for calc
// `params` : opaque payload used by the caller to reconstruct a question
//            from a due item (e.g. { hour, minute } or { type, h1, m1, dur }).

const FSRS_KEY = 'clock-cinnamon.fsrs.v1';
const META_KEY = 'clock-cinnamon.meta.v1';

// FSRS-4.5 default weights.
const W = [
  0.4072, 1.1829, 3.1262, 15.4722,
  7.2102, 0.5316, 1.0651, 0.0234,
  1.616,  0.1544, 1.0824, 1.9813,
  0.0953, 0.2975, 2.2042, 0.2407,
  2.9466, 0.5034, 0.6567
];
const REQUEST_RETENTION = 0.9;
const LEARNING_STEP_MS  = 10 * 60 * 1000; // 10 minutes for (re)learning

function loadSRS(){ try { return JSON.parse(localStorage.getItem(FSRS_KEY)) || {}; } catch(e){ return {}; } }
function saveSRS(s){ localStorage.setItem(FSRS_KEY, JSON.stringify(s)); }
function loadMeta(){ try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch(e){ return {}; } }
function saveMeta(m){ localStorage.setItem(META_KEY, JSON.stringify(m)); }

function clampD(d){ return Math.min(10, Math.max(1, d)); }
function initS(rating){ return Math.max(0.1, W[rating - 1]); }
function initD(rating){ return clampD(W[4] - Math.exp(W[5] * (rating - 1)) + 1); }
function meanReversion(initial, current){ return W[7] * initial + (1 - W[7]) * current; }
function nextD(d, rating){
  const dp = d - W[6] * (rating - 3);
  return clampD(meanReversion(initD(3), dp));
}
// Power forgetting curve: R(t) = (1 + t / (9*S))^-1
function retrievability(s, elapsedDays){ return Math.pow(1 + elapsedDays / (9 * s), -1); }
function nextRecallS(d, s, r, rating){
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus   = rating === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9])
              * (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus);
}
function nextLapseS(d, s, r){
  return W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
}
// Inverse of R = (1 + t/(9*S))^-1 → t = 9*S*(1/R - 1)
function intervalDays(s){
  const t = 9 * s * (1 / REQUEST_RETENTION - 1);
  return Math.max(1, Math.round(t));
}

function review(card, rating, now){
  now = now || Date.now();
  const c = Object.assign({}, card);
  const elapsedDays = c.lastReview ? Math.max(0, (now - c.lastReview) / 86400000) : 0;
  if(!c.state || c.state === 'new'){
    c.D = initD(rating);
    c.S = initS(rating);
    c.state = rating === 1 ? 'learning' : 'review';
  } else {
    const R = retrievability(c.S || 0.1, elapsedDays);
    c.D = nextD(c.D || initD(3), rating);
    if(rating === 1){
      c.S = Math.max(0.1, nextLapseS(c.D, c.S || 0.1, R));
      c.lapses = (c.lapses || 0) + 1;
      c.state = 'relearning';
    } else {
      c.S = Math.max(0.1, nextRecallS(c.D, c.S || 0.1, R, rating));
      c.state = 'review';
    }
  }
  c.reps = (c.reps || 0) + 1;
  c.lastReview = now;
  if(c.state === 'learning' || c.state === 'relearning'){
    c.due = now + LEARNING_STEP_MS;
  } else {
    c.due = now + intervalDays(c.S) * 86400000;
  }
  return c;
}

// ---- Item IDs ----
// Read mode: identified by (level, hour, minute).
// Calc mode: identified by (level, type, salient params). Period/story are not
// part of the id since they don't change difficulty.
function itemId(mode, level, params){
  if(mode === 'read'){
    return `read:L${level}:${params.hour}:${params.minute}`;
  }
  const p = params || {};
  switch(p.type){
    case 'afterMin':  return `calc:${level}:afterMin:${p.h1}-${p.m1}-${p.dur}`;
    case 'beforeMin': return `calc:${level}:beforeMin:${p.h2}-${p.m2}-${p.dur}`;
    case 'elapsed':   return `calc:${level}:elapsed:${p.h1}-${p.m1}-${p.dur}`;
    case 'elapsedHM': return `calc:${level}:elapsedHM:${p.h1}-${p.m1}-${p.dur}`;
    case 'sumDur':    return `calc:${level}:sumDur:${(p.parts||[]).join('-')}`;
  }
  return `calc:${level}:unknown:${JSON.stringify(p)}`;
}

function newCard(mode, level, params){
  return {
    id: itemId(mode, level, params),
    mode, level, params,
    state:'new', D:0, S:0,
    lastReview:0, due:0,
    reps:0, lapses:0,
  };
}

function recordAnswer(mode, level, params, isCorrect){
  const s = loadSRS();
  const id = itemId(mode, level, params);
  const cur = s[id] || newCard(mode, level, params);
  cur.params = params;     // keep params fresh
  cur.mode = mode;
  cur.level = level;
  const rating = isCorrect ? 3 : 1; // Good / Again
  s[id] = review(cur, rating, Date.now());
  saveSRS(s);
}

function getDueItems(mode, level, max){
  const s = loadSRS();
  const now = Date.now();
  return Object.values(s)
    .filter(it => it.mode === mode && it.level === level && it.due <= now && it.state !== 'new')
    .sort((a, b) => a.due - b.due)
    .slice(0, max);
}

// Kept for backward compatibility; FSRS uses wall-clock time so session bumping
// is not required, but game.js still calls it.
function bumpSession(){
  const meta = loadMeta();
  meta.session = (meta.session || 0) + 1;
  saveMeta(meta);
  return meta.session;
}

window.SRS = {
  loadSRS, saveSRS, loadMeta, saveMeta,
  recordAnswer, getDueItems, bumpSession,
  itemId, review,
};
