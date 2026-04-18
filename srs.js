// Leitner-style SRS for clock-reading items.
// Each item: { id: "h:m", level, box(1..5), nextDue (session count), wrongCount, lastSeen }
// Items are scheduled by an integer "session counter" (incremented when a session ends).

const SRS_KEY = 'clock-cinnamon.srs.v1';
const META_KEY = 'clock-cinnamon.meta.v1';

function loadSRS(){
  try { return JSON.parse(localStorage.getItem(SRS_KEY)) || {}; }
  catch(e){ return {}; }
}
function saveSRS(s){ localStorage.setItem(SRS_KEY, JSON.stringify(s)); }
function loadMeta(){
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; }
  catch(e){ return {}; }
}
function saveMeta(m){ localStorage.setItem(META_KEY, JSON.stringify(m)); }

function itemId(h, m, level){ return `L${level}:${h}:${m}`; }

// Box -> session interval (sessions until next due)
const BOX_INTERVALS = { 1:1, 2:2, 3:4, 4:7, 5:12 };

function recordAnswer(level, hour, minute, isCorrect){
  const s = loadSRS();
  const id = itemId(hour, minute, level);
  const meta = loadMeta();
  const session = meta.session || 0;
  const cur = s[id] || { id, level, hour, minute, box:1, nextDue:session, wrongCount:0, lastSeen:0 };
  if(isCorrect){
    cur.box = Math.min(5, cur.box + 1);
  } else {
    cur.box = 1;
    cur.wrongCount = (cur.wrongCount || 0) + 1;
  }
  cur.lastSeen = session;
  cur.nextDue = session + (BOX_INTERVALS[cur.box] || 1);
  s[id] = cur;
  saveSRS(s);
}

function getDueItems(level, max){
  const s = loadSRS();
  const meta = loadMeta();
  const session = meta.session || 0;
  return Object.values(s)
    .filter(it => it.level === level && it.nextDue <= session && it.box < 5)
    .sort((a,b) => (a.box - b.box) || (a.nextDue - b.nextDue))
    .slice(0, max);
}

function bumpSession(){
  const meta = loadMeta();
  meta.session = (meta.session || 0) + 1;
  saveMeta(meta);
  return meta.session;
}

window.SRS = { loadSRS, saveSRS, loadMeta, saveMeta, recordAnswer, getDueItems, bumpSession };
