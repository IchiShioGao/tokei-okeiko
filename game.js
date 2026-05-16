// Main game controller. Vanilla JS, no framework.
(function(){
  // Keep this key STABLE across releases — bumping it would orphan saved
  // progress. Schema changes go through STATE_SCHEMA_VERSION + migrations.
  const STATE_KEY = 'clock-cinnamon.state.v1';
  const STATE_BACKUP_KEY = 'clock-cinnamon.state.backup';
  const STATE_SCHEMA_VERSION = 1;

  // Level definitions
  const LEVELS = [
    { id:1, name:'ちょうどの じかん', desc:'○じ',         minutes:[0],                                     unlock:0  },
    { id:2, name:'はん',             desc:'○じ30ぷん',     minutes:[0,30],                                  unlock:30 },
    { id:3, name:'15ふんおき',        desc:'15・30・45ふん', minutes:[0,15,30,45],                            unlock:80 },
    { id:4, name:'5ふんおき',         desc:'5ふんきざみ',    minutes:[0,5,10,15,20,25,30,35,40,45,50,55],     unlock:150 },
    { id:5, name:'1ぷんおき',         desc:'1ぷんまで',     minutes:Array.from({length:60},(_,i)=>i),         unlock:260 },
  ];
  const QUESTIONS_PER_SESSION = 10;
  const MAX_DUE_PER_SESSION   = 5;

  // -------- Persistent state --------
  const defaultState = () => ({
    schemaVersion: STATE_SCHEMA_VERSION,
    coins: 0,
    xp: 0,
    bestLevel: 1,
    levelStars: {1:0,2:0,3:0,4:0,5:0,c1:0,c2:0,c3:0,c4:0,c5:0},  // best stars per level
    friends: ['shina'],
    streakDays: 0,
    lastPlayDate: null,
    stampDates: [],   // ISO date strings, played this week
    hintUsedThisSession: false,
  });
  // Deep-merge so new defaults (e.g. a future level added to levelStars) get
  // filled in WITHOUT overwriting saved progress.
  function mergeDefaults(target, saved){
    if(!saved || typeof saved !== 'object') return target;
    Object.keys(saved).forEach(k => {
      const sv = saved[k], tv = target[k];
      if(sv && typeof sv === 'object' && !Array.isArray(sv)
         && tv && typeof tv === 'object' && !Array.isArray(tv)){
        target[k] = mergeDefaults(tv, sv);
      } else if(sv !== undefined){
        target[k] = sv;
      }
    });
    return target;
  }
  // Run forward-only schema migrations. Add new `if` blocks here as the
  // schema grows; never remove old branches.
  function migrateState(s){
    if(!s.schemaVersion) s.schemaVersion = 1;
    // Example for the future:
    // if(s.schemaVersion < 2){ ...transform...; s.schemaVersion = 2; }
    s.schemaVersion = STATE_SCHEMA_VERSION;
    return s;
  }
  function loadState(){
    const raw = localStorage.getItem(STATE_KEY);
    if(!raw) return defaultState();
    try {
      const saved = JSON.parse(raw);
      return migrateState(mergeDefaults(defaultState(), saved));
    } catch(e){
      // Corrupt JSON — stash the raw bytes so we don't silently destroy the
      // user's history, then fall back to defaults.
      try { localStorage.setItem(STATE_BACKUP_KEY, raw); } catch(_){}
      return defaultState();
    }
  }
  function saveState(s){ localStorage.setItem(STATE_KEY, JSON.stringify(s)); }
  let state = loadState();

  // -------- Helpers --------
  const $ = (id) => document.getElementById(id);
  const rand = (n) => Math.floor(Math.random() * n);
  const choice = (arr) => arr[rand(arr.length)];
  const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]} return a; };

  function fmtTime(h, m){
    if(m === 0) return `${h}じ ちょうど`;
    return `${h}じ${m}ふん`;
  }
  function timeKey(h,m){ return `${h}:${m}`; }

  // -------- Question generation --------
  function makeQuestion(level){
    const lv = LEVELS[level-1];
    const h = 1 + rand(12);                 // 1..12
    const m = choice(lv.minutes);
    return { level, hour:h, minute:m, fromSRS:false };
  }
  function questionFromSRS(item){
    return { level:item.level, hour:item.hour, minute:item.minute, fromSRS:true };
  }
  function buildSession(level){
    const due = SRS.getDueItems(level, MAX_DUE_PER_SESSION);
    const dueQ = due.map(questionFromSRS);
    const seen = new Set(dueQ.map(q => timeKey(q.hour,q.minute)));
    const fresh = [];
    let safety = 0;
    while(fresh.length < QUESTIONS_PER_SESSION - dueQ.length && safety++ < 200){
      const q = makeQuestion(level);
      const k = timeKey(q.hour, q.minute);
      if(seen.has(k)) continue;
      seen.add(k);
      fresh.push(q);
    }
    return shuffle([...dueQ, ...fresh]);
  }
  function makeChoices(q){
    const lv = LEVELS[q.level-1];
    const correct = { h:q.hour, m:q.minute };
    const pool = new Set([timeKey(correct.h, correct.m)]);
    const candidates = [];
    function add(h, m){
      if(h < 1 || h > 12) return;
      if(!lv.minutes.includes(m)) return;
      const k = timeKey(h,m);
      if(pool.has(k)) return;
      pool.add(k);
      candidates.push({h,m});
    }
    // Hour off by ±1, ±2
    [-2,-1,1,2].forEach(d => add(((correct.h - 1 + d + 12) % 12) + 1, correct.m));
    // Minute off by ±1 step (at this level)
    const idx = lv.minutes.indexOf(correct.m);
    [-2,-1,1,2].forEach(d => {
      const ni = idx + d;
      if(ni >= 0 && ni < lv.minutes.length) add(correct.h, lv.minutes[ni]);
    });
    // Both off
    add(((correct.h % 12) + 1), lv.minutes[(idx+1) % lv.minutes.length]);
    add((((correct.h - 2 + 12) % 12) + 1), lv.minutes[(idx-1+lv.minutes.length) % lv.minutes.length]);

    const distractors = shuffle(candidates).slice(0,4);
    const all = shuffle([{h:correct.h, m:correct.m, correct:true}, ...distractors.map(d => ({...d, correct:false}))]);
    return all;
  }

  // -------- Sound (cute kawaii sounds for girls) --------
  let audioCtx = null;
  function ac(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }

  // Base tone with envelope
  function tone(freq, dur=0.12, type='sine', vol=0.08, delay=0){
    try {
      const ctx = ac();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur);
    } catch(e){}
  }

  // Sparkle: layered high sine + triangle for a キラキラ shimmer
  function sparkle(freq, delay=0){
    tone(freq, 0.18, 'sine', 0.06, delay);
    tone(freq * 2, 0.12, 'sine', 0.03, delay);
    tone(freq * 1.5, 0.15, 'triangle', 0.025, delay);
  }

  // Soft bubble pop
  function bubble(freq, delay=0){
    try {
      const ctx = ac();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + delay + 0.15);
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t);
      o.stop(t + 0.2);
    } catch(e){}
  }

  // ✨ Correct: ascending sparkle arpeggio (キラキラ〜ン♪)
  function sndCorrect(){
    sparkle(880, 0);
    sparkle(1109, 0.08);
    sparkle(1319, 0.16);
    sparkle(1760, 0.26);
  }

  // 💭 Wrong: gentle descending bubble (ぽよん…)
  function sndWrong(){
    bubble(400, 0);
    bubble(300, 0.12);
    tone(220, 0.3, 'sine', 0.04, 0.2);
  }

  // 👆 Tap: soft pop (ぽん)
  function sndTap(){
    bubble(600, 0);
    tone(900, 0.06, 'sine', 0.025, 0);
  }

  // 🎶 Win: magical melody (やったね！のファンファーレ)
  function sndWin(){
    // C5 E5 G5 C6 — bright major arpeggio with sparkle layers
    const melody = [523, 659, 784, 1047];
    melody.forEach((f, i) => {
      sparkle(f, i * 0.13);
    });
    // Final high shimmer chord
    setTimeout(() => {
      sparkle(1319, 0);
      sparkle(1568, 0.04);
      sparkle(2093, 0.08);
      tone(1047, 0.5, 'triangle', 0.04, 0.12);
    }, melody.length * 130 + 60);
  }

  // 🌟 Combo milestone sound (すごーい！)
  function sndCombo(){
    tone(784, 0.1, 'triangle', 0.05, 0);
    sparkle(1047, 0.06);
    sparkle(1319, 0.14);
  }

  // 🎀 Level up / unlock jingle
  function sndUnlock(){
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      sparkle(f, i * 0.1);
      tone(f, 0.3, 'triangle', 0.035, i * 0.1);
    });
  }

  // 💖 Friend collected sound
  function sndFriend(){
    const notes = [659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => {
      sparkle(f, i * 0.12);
    });
    tone(1047, 0.6, 'sine', 0.035, 0.5);
    tone(1568, 0.6, 'sine', 0.025, 0.5);
  }

  // -------- Screens --------
  function show(screenId){
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
    window.scrollTo(0,0);
  }
  function refreshHUD(){
    $('hud-level').textContent = state.bestLevel;
    $('hud-coin').textContent  = state.coins;
    $('hud-streak').textContent = state.streakDays;
  }
  function renderHome(){
    $('mascot-home').innerHTML = mascotSVG('shina','happy');

    // Clock-reading levels
    const grid = $('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach(lv => {
      const unlocked = state.coins >= lv.unlock || lv.unlock === 0;
      const stars = state.levelStars[lv.id] || 0;
      const card = document.createElement('div');
      card.className = 'level-card' + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <div class="lv-badge">レベル ${lv.id}</div>
        <div class="lv-name">${lv.name}</div>
        <div class="lv-desc">${lv.desc}</div>
        <div class="lv-stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3-stars)}</span></div>
        ${unlocked ? '' : `<div class="lv-lock">🔒 🌟${lv.unlock}</div>`}
      `;
      if(unlocked){
        card.addEventListener('click', () => { sndTap(); startSession(lv.id); });
      }
      grid.appendChild(card);
    });

    // Calc-mode levels
    const calcGrid = $('calc-grid');
    calcGrid.innerHTML = '';
    CALC.CALC_LEVELS.forEach((lv, i) => {
      const unlocked = state.coins >= lv.unlock || lv.unlock === 0;
      const stars = state.levelStars[lv.id] || 0;
      const card = document.createElement('div');
      card.className = 'level-card calc' + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <div class="lv-badge">けいさん ${i+1}</div>
        <div class="lv-name">${lv.name}</div>
        <div class="lv-desc">${lv.desc}</div>
        <div class="lv-stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3-stars)}</span></div>
        ${unlocked ? '' : `<div class="lv-lock">🔒 🌟${lv.unlock}</div>`}
      `;
      if(unlocked){
        card.addEventListener('click', () => { sndTap(); startSession(lv.id); });
      }
      calcGrid.appendChild(card);
    });

    renderStampCard();
  }

  // -------- Stamp card --------
  function renderStampCard(){
    const row = $('stamp-row');
    row.innerHTML = '';
    const today = new Date();
    const dow = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dow + 6) % 7));
    const labels = ['げつ','か','すい','もく','きん','ど','にち'];
    const dates = [];
    for(let i = 0; i < 7; i++){
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().slice(0,10));
    }
    const todayIso = today.toISOString().slice(0,10);
    let stampedCount = 0;
    dates.forEach((iso, i) => {
      const done = (state.stampDates || []).includes(iso);
      if(done) stampedCount++;
      const el = document.createElement('div');
      el.className = 'stamp' + (done ? ' done' : '') + (iso === todayIso ? ' today' : '');
      el.textContent = done ? '🌸' : labels[i];
      row.appendChild(el);
    });
    const sub = $('stamp-card-sub');
    if(stampedCount >= 7){
      sub.textContent = '🎉 こんしゅう パーフェクト！';
    } else if(stampedCount > 0){
      sub.textContent = `あと ${7 - stampedCount}にちで パーフェクト！`;
    } else {
      sub.textContent = 'きょうも がんばろう！';
    }
  }
  function stampToday(){
    const today = new Date().toISOString().slice(0,10);
    state.stampDates = state.stampDates || [];
    // Trim entries older than 14 days to keep array small
    const cutoff = new Date(Date.now() - 14*86400000).toISOString().slice(0,10);
    state.stampDates = state.stampDates.filter(d => d >= cutoff);
    if(!state.stampDates.includes(today)){
      state.stampDates.push(today);
      return true; // newly stamped
    }
    return false;
  }

  // -------- Toast --------
  function toast(msg, ms=2400){
    let el = document.querySelector('.toast');
    if(!el){
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), ms);
  }

  // -------- Session --------
  let session = null;
  const isCalcLevel = (lv) => typeof lv === 'string' && lv.startsWith('c');

  function startSession(level){
    const mode = isCalcLevel(level) ? 'calc' : 'read';
    const queue = mode === 'calc'
      ? buildCalcSession(level)
      : buildSession(level);
    session = { level, mode, queue, idx:0, correct:0, comboMax:0, combo:0, awarded:0 };
    show('screen-quiz');
    $('q-total').textContent = queue.length;
    renderQuestion();
  }

  function buildCalcSession(level){
    // Calc questions don't use SRS (each one is a unique problem instance)
    const out = [];
    const seen = new Set();
    let safety = 0;
    while(out.length < QUESTIONS_PER_SESSION && safety++ < 200){
      const q = CALC.genQuestion(level);
      const key = JSON.stringify(q.answer) + ':' + (q.story || '').slice(0, 20);
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
    return out;
  }

  function renderQuestion(){
    const q = session.queue[session.idx];
    $('q-index').textContent = session.idx + 1;
    $('progress-fill').style.width = ((session.idx) / session.queue.length * 100) + '%';
    $('combo-count').textContent = session.combo;
    $('combo-chip').classList.toggle('zero', session.combo < 2);
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';

    if(session.mode === 'calc'){
      renderCalcQuestion(q);
    } else {
      renderReadQuestion(q);
    }
  }

  function renderReadQuestion(q){
    $('story-bubble').hidden = true;
    $('clock-stage').className = 'clock-stage';
    $('clock').innerHTML = renderClock(q.hour, q.minute);
    $('clock2').hidden = true;
    $('calc-arrow').hidden = true;
    $('mascot-quiz').style.display = '';
    $('mascot-quiz').innerHTML = mascotSVG('shina','happy');
    $('btn-hint').hidden = true;

    const choices = makeChoices(q);
    const cont = $('choices');
    cont.className = 'choices';
    cont.innerHTML = '';
    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = fmtTime(c.h, c.m);
      btn.addEventListener('click', () => onAnswer(btn, c, q, choices));
      cont.appendChild(btn);
    });
  }

  function renderCalcQuestion(q){
    // Story bubble
    $('story-bubble').hidden = false;
    $('story-mascot').innerHTML = mascotSVG('shina', 'happy');
    $('story-text').innerHTML = q.story;

    // Clock layout
    const stage = $('clock-stage');
    const clock1 = $('clock');
    const clock2 = $('clock2');
    const arrow = $('calc-arrow');
    $('mascot-quiz').style.display = 'none';

    if(q.type === 'sumDur'){
      stage.className = 'clock-stage calc-mode calc-none';
    } else if(q.type === 'elapsed' || q.type === 'elapsedHM'){
      // Both clocks shown
      stage.className = 'clock-stage calc-mode calc-pair';
      clock1.innerHTML = renderClock(q.h1, q.m1);
      clock2.hidden = false;
      clock2.innerHTML = renderClock(q.h2, q.m2);
      arrow.hidden = false;
      arrow.innerHTML = CALC.renderArrow();
    } else if(q.type === 'afterMin' || q.type === 'beforeMin'){
      // Start clock + arrow + mystery clock
      stage.className = 'clock-stage calc-mode calc-pair';
      const known = q.type === 'afterMin'
        ? { h:q.h1, m:q.m1 }
        : { h:q.h2, m:q.m2 };
      clock1.innerHTML = renderClock(known.h, known.m);
      clock2.hidden = false;
      clock2.innerHTML = CALC.renderMysteryClock();
      arrow.hidden = false;
      arrow.innerHTML = CALC.renderArrow();
    }

    // Hint button: available once per question
    const hintBtn = $('btn-hint');
    hintBtn.hidden = false;
    hintBtn.classList.remove('used');
    hintBtn.onclick = () => showHint(q);

    // Choices
    const choices = CALC.makeChoices(q);
    const cont = $('choices');
    cont.className = 'choices calc-choices';
    cont.innerHTML = '';
    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = c.label;
      btn.addEventListener('click', () => onCalcAnswer(btn, c, q, choices));
      cont.appendChild(btn);
    });
  }

  // Show a thinking hint (strategy only — never reveals the answer).
  // Cost: breaks the current combo so it's a real choice, not a free peek.
  function showHint(q){
    const hintBtn = $('btn-hint');
    if(hintBtn.classList.contains('used')) return;
    hintBtn.classList.add('used');
    // Cost: combo reset to 0
    if(session.combo > 0){ session.combo = 0; $('combo-count').textContent = 0; $('combo-chip').classList.add('zero'); }
    let msg = '';
    if(q.type === 'afterMin'){
      msg = `${q.m1}ふんに ${q.dur}ふんを たしざん！ 60を こえたら 1じかん くりあがり`;
    } else if(q.type === 'beforeMin'){
      msg = `${q.m2}ふんから ${q.dur}ふんを ひきざん！ たりなかったら 1じかん もどろう`;
    } else if(q.type === 'elapsed'){
      msg = `おなじ じかんなら ふんの ひきざん。じかんが ちがうなら 60ふん たすのを わすれずに！`;
    } else if(q.type === 'elapsedHM'){
      msg = `まず なんじかん たったか かぞえよう。そのあとで ふんの ちがいを たそう！`;
    } else if(q.type === 'sumDur'){
      msg = `ぜんぶ ふんで たしざん。さいごに 60ふん = 1じかん で なおそう！`;
    }
    if(msg) toast('💡 ' + msg, 3600);
    sndTap();
  }
  function onCalcAnswer(btn, c, q, choices){
    Array.from($('choices').children).forEach(el => el.classList.add('disabled'));
    $('btn-hint').classList.add('used'); // freeze hint
    if(c.correct){
      btn.classList.add('correct');
      session.correct++;
      session.combo++;
      session.comboMax = Math.max(session.comboMax, session.combo);
      const fb = $('feedback');
      const msgs = ['せいかい！','すごーい！','よくできました！','やったね！','てんさい！','かんぺき！','きらきら〜！','すてき！','けいさん めいじん！'];
      const emojis = ['🎉','✨','🌟','💖','🎀','🌸','💫','⭐'];
      fb.textContent = msgs[rand(msgs.length)] + ' ' + emojis[rand(emojis.length)];
      fb.classList.add('good');
      $('story-mascot').innerHTML = mascotSVG('shina','wow');
      if(session.combo >= 3 && session.combo % 3 === 0){ sndCombo(); } else { sndCorrect(); }
    } else {
      btn.classList.add('wrong');
      session.combo = 0;
      Array.from($('choices').children).forEach((el, i) => {
        if(choices[i].correct) el.classList.add('reveal');
      });
      const fb = $('feedback');
      fb.textContent = `おしい！ こたえは ${q.answerLabel}`;
      fb.classList.add('bad');
      $('story-mascot').innerHTML = mascotSVG('shina','sad');
      sndWrong();
    }
    setTimeout(nextQuestion, c.correct ? 1100 : 2200);
  }

  function onAnswer(btn, c, q, choices){
    Array.from($('choices').children).forEach(el => el.classList.add('disabled'));
    SRS.recordAnswer(q.level, q.hour, q.minute, c.correct);
    if(c.correct){
      btn.classList.add('correct');
      session.correct++;
      session.combo++;
      session.comboMax = Math.max(session.comboMax, session.combo);
      const fb = $('feedback');
      const msgs = ['せいかい！','すごーい！','よくできました！','やったね！','てんさい！','かんぺき！','きらきら〜！','すてき！'];
      const emojis = ['🎉','✨','🌟','💖','🎀','🌸','💫','⭐'];
      fb.textContent = msgs[rand(msgs.length)] + ' ' + emojis[rand(emojis.length)];
      fb.classList.add('good');
      $('mascot-quiz').innerHTML = mascotSVG('shina','wow');
      if(session.combo >= 3 && session.combo % 3 === 0) { sndCombo(); } else { sndCorrect(); }
    } else {
      btn.classList.add('wrong');
      session.combo = 0;
      // reveal correct
      Array.from($('choices').children).forEach((el, i) => {
        if(choices[i].correct) el.classList.add('reveal');
      });
      const fb = $('feedback');
      fb.textContent = `おしい！ こたえは ${fmtTime(q.hour,q.minute)}`;
      fb.classList.add('bad');
      $('mascot-quiz').innerHTML = mascotSVG('shina','sad');
      sndWrong();
    }
    setTimeout(nextQuestion, c.correct ? 900 : 1900);
  }
  function nextQuestion(){
    session.idx++;
    if(session.idx >= session.queue.length){
      finishSession();
    } else {
      renderQuestion();
    }
  }
  function finishSession(){
    if(session.mode === 'read') SRS.bumpSession();
    const correct = session.correct;
    const stars = correct >= 10 ? 3 : correct >= 8 ? 2 : correct >= 6 ? 1 : 0;
    // Coins: 2 per correct + combo bonus. Calc gets a small bonus to incentivise.
    const calcBonus = session.mode === 'calc' ? 5 : 0;
    const coins = correct * 2 + session.comboMax * 2 + stars * 5 + calcBonus;
    state.coins += coins;
    state.xp += correct * 10;
    state.levelStars[session.level] = Math.max(state.levelStars[session.level] || 0, stars);
    if(typeof session.level === 'number'){
      state.bestLevel = Math.max(state.bestLevel, session.level);
    }
    // daily streak
    const today = new Date().toISOString().slice(0,10);
    if(state.lastPlayDate !== today){
      const yest = new Date(Date.now() - 86400000).toISOString().slice(0,10);
      state.streakDays = state.lastPlayDate === yest ? (state.streakDays + 1) : 1;
      state.lastPlayDate = today;
    }
    // Stamp card
    const newlyStamped = stampToday();
    saveState(state);
    if(newlyStamped){
      setTimeout(() => toast('🌸 きょうの スタンプ ゲット！'), 600);
      // Bonus when all 7 stamps collected this week
      const weekStamps = (state.stampDates || []).slice(-7).length;
      if(weekStamps === 7){
        setTimeout(() => { state.coins += 50; saveState(state); refreshHUD(); toast('🎉 1しゅうかん パーフェクト！ +🌟50'); }, 1600);
      }
    }

    // Show result
    show('screen-result');
    $('result-correct').textContent = correct;
    $('result-coins').textContent = '+' + coins;
    const titles = stars === 3 ? 'パーフェクト！' : stars === 2 ? 'よくできました！' : stars === 1 ? 'がんばったね！' : 'もういちど！';
    $('result-title').textContent = titles;
    const starsEl = $('stars');
    starsEl.innerHTML = '';
    for(let i = 0; i < 3; i++){
      const s = document.createElement('span');
      s.textContent = '★';
      if(i >= stars) s.className = 'off';
      starsEl.appendChild(s);
    }
    $('mascot-result').innerHTML = mascotSVG('shina', stars >= 2 ? 'wow' : stars === 1 ? 'happy' : 'sad');
    refreshHUD();
    if(stars >= 1) confetti();
    if(stars >= 2) sndWin();
  }

  function confetti(){
    const c = $('confetti');
    c.innerHTML = '';
    const colors = ['#FFD5E5','#BEE3F8','#FFE58A','#D6C7FF','#C5F5D0','#FFB84A'];
    for(let i = 0; i < 60; i++){
      const i_ = document.createElement('i');
      i_.style.left = Math.random()*100 + 'vw';
      i_.style.background = colors[i % colors.length];
      i_.style.animationDuration = (1.6 + Math.random()*1.6) + 's';
      i_.style.animationDelay = (Math.random()*0.6) + 's';
      i_.style.transform = `rotate(${Math.random()*360}deg)`;
      c.appendChild(i_);
    }
    setTimeout(()=>{ c.innerHTML=''; }, 3500);
  }

  // -------- Collection --------
  function renderCollection(){
    const grid = $('collection-grid');
    grid.innerHTML = '';
    FRIENDS.forEach(f => {
      const owned = state.friends.includes(f.key);
      const canBuy = !owned && state.coins >= f.cost;
      const card = document.createElement('div');
      card.className = 'friend-card' + (owned ? '' : ' locked');
      card.innerHTML = `
        <div class="mascot mascot-sm">${mascotSVG(f.key, owned ? 'happy' : 'sleepy')}</div>
        <div class="friend-name">${owned ? f.name : '？？？'}</div>
        <div class="friend-cost">${owned ? f.desc : `🌟 ${f.cost}`}</div>
      `;
      if(canBuy){
        card.style.cursor = 'pointer';
        card.title = 'タップで なかまにする';
        card.addEventListener('click', () => {
          state.coins -= f.cost;
          state.friends.push(f.key);
          saveState(state);
          refreshHUD();
          renderCollection();
          sndFriend();
        });
      }
      grid.appendChild(card);
    });
  }

  // -------- Wire up --------
  function init(){
    refreshHUD();
    renderHome();
    show('screen-home');
    $('btn-back-home').addEventListener('click', () => { sndTap(); show('screen-home'); renderHome(); });
    $('btn-back-home2').addEventListener('click', () => { sndTap(); show('screen-home'); renderHome(); });
    $('btn-collection').addEventListener('click', () => { sndTap(); renderCollection(); show('screen-collection'); });
    $('btn-retry').addEventListener('click', () => { sndTap(); startSession(session.level); });
    $('btn-home').addEventListener('click', () => { sndTap(); show('screen-home'); renderHome(); });
    $('btn-reset').addEventListener('click', () => {
      if(confirm('ぜんぶのきろくを けします。よろしいですか？')){
        localStorage.removeItem(STATE_KEY);
        localStorage.removeItem('clock-cinnamon.srs.v1');
        localStorage.removeItem('clock-cinnamon.meta.v1');
        state = loadState();
        refreshHUD();
        renderHome();
      }
    });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
