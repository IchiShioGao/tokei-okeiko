// Main game controller. Vanilla JS, no framework.
(function(){
  const STATE_KEY = 'clock-cinnamon.state.v1';

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
    coins: 0,
    xp: 0,
    bestLevel: 1,
    levelStars: {1:0,2:0,3:0,4:0,5:0},  // best stars per level
    friends: ['shina'],
    streakDays: 0,
    lastPlayDate: null,
  });
  function loadState(){
    try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STATE_KEY)) || {}); }
    catch(e){ return defaultState(); }
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

  // -------- Sound (tiny WebAudio beeps) --------
  let audioCtx = null;
  function ac(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
  function beep(freq, dur=0.12, type='sine', vol=0.08){
    try {
      const ctx = ac();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch(e){}
  }
  function sndCorrect(){ beep(660,.1,'triangle',.07); setTimeout(()=>beep(880,.14,'triangle',.07),90); }
  function sndWrong(){ beep(200,.18,'sawtooth',.05); }
  function sndTap(){ beep(420,.05,'sine',.04); }
  function sndWin(){
    [523,659,784,1047].forEach((f,i) => setTimeout(()=>beep(f,.16,'triangle',.07), i*120));
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
  }

  // -------- Session --------
  let session = null;  // { level, queue, idx, correct, comboMax, combo, awarded }
  function startSession(level){
    const queue = buildSession(level);
    session = { level, queue, idx:0, correct:0, comboMax:0, combo:0, awarded:0 };
    show('screen-quiz');
    $('q-total').textContent = queue.length;
    renderQuestion();
  }
  function renderQuestion(){
    const q = session.queue[session.idx];
    $('q-index').textContent = session.idx + 1;
    $('progress-fill').style.width = ((session.idx) / session.queue.length * 100) + '%';
    $('combo-count').textContent = session.combo;
    $('combo-chip').classList.toggle('zero', session.combo < 2);
    $('clock').innerHTML = renderClock(q.hour, q.minute);
    $('mascot-quiz').innerHTML = mascotSVG('shina','happy');
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';
    const choices = makeChoices(q);
    const cont = $('choices');
    cont.innerHTML = '';
    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = fmtTime(c.h, c.m);
      btn.addEventListener('click', () => onAnswer(btn, c, q, choices));
      cont.appendChild(btn);
    });
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
      const msgs = ['せいかい！','すごい！','よくできました！','やったね！','てんさい！'];
      fb.textContent = msgs[rand(msgs.length)] + ' 🎉';
      fb.classList.add('good');
      $('mascot-quiz').innerHTML = mascotSVG('shina','wow');
      sndCorrect();
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
    SRS.bumpSession();
    const correct = session.correct;
    const stars = correct >= 10 ? 3 : correct >= 8 ? 2 : correct >= 6 ? 1 : 0;
    // Coins: 2 per correct + combo bonus
    const coins = correct * 2 + session.comboMax * 2 + stars * 5;
    state.coins += coins;
    state.xp += correct * 10;
    state.levelStars[session.level] = Math.max(state.levelStars[session.level] || 0, stars);
    state.bestLevel = Math.max(state.bestLevel, session.level);
    // daily streak
    const today = new Date().toISOString().slice(0,10);
    if(state.lastPlayDate !== today){
      const yest = new Date(Date.now() - 86400000).toISOString().slice(0,10);
      state.streakDays = state.lastPlayDate === yest ? (state.streakDays + 1) : 1;
      state.lastPlayDate = today;
    }
    saveState(state);

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
          sndWin();
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
