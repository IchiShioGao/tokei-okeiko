// Time calculation questions (じかんの けいさん)
// Question types: afterMin, beforeMin, elapsed, elapsedHM, sumDur
(function(){
  const rand = (n) => Math.floor(Math.random() * n);
  const choice = (arr) => arr[rand(arr.length)];
  const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]} return a; };

  const CALC_LEVELS = [
    { id:'c1', name:'なんぷん あと',     desc:'○じ○ふんの ○ぷん あと', unlock:0,   type:'afterMin'  },
    { id:'c2', name:'なんぷん まえ',     desc:'○じ○ふんの ○ぷん まえ', unlock:60,  type:'beforeMin' },
    { id:'c3', name:'けいか じかん',     desc:'なんぷん たった？',      unlock:150, type:'elapsed'   },
    { id:'c4', name:'なんじかん なんぷん', desc:'1じかんを こえる',      unlock:280, type:'elapsedHM' },
    { id:'c5', name:'あわせて なんじかん', desc:'たしざん おはなし',     unlock:420, type:'sumDur'    },
  ];

  // ---- Formatting ----
  function fmtTime(period, h, m){
    const pre = period === 'am' ? 'ごぜん ' : period === 'pm' ? 'ごご ' : '';
    const mPart = m === 0 ? 'ちょうど' : `${m}ふん`;
    return `${pre}${h}じ${m === 0 ? ' ' + mPart : mPart}`;
  }
  function fmtTimeShort(h, m){
    if(m === 0) return `${h}じ`;
    return `${h}じ${m}ふん`;
  }
  function fmtDur(min){
    if(min < 60) return `${min}ふん`;
    const h = Math.floor(min / 60), r = min % 60;
    if(r === 0) return `${h}じかん`;
    return `${h}じかん${r}ふん`;
  }

  // ---- Builders: given parameters, assemble the full question object ----
  function buildAfter(period, h1, m1, dur){
    const total = h1 * 60 + m1 + dur;
    const h2 = Math.floor(total / 60), m2 = total % 60;
    const stories = [
      `${fmtTime(period,h1,m1)}から ${dur}ふん おさんぽしたよ。なんじに かえる？`,
      `シナは ${fmtTime(period,h1,m1)}に おひるねを はじめたよ。${dur}ふん ねたら なんじ？`,
      `${fmtTime(period,h1,m1)}から ピアノの れんしゅう ${dur}ふん。おわるのは いつ？`,
      `おやつタイム！ ${fmtTime(period,h1,m1)}から ${dur}ふん たべたら なんじ？`,
    ];
    return {
      type:'afterMin', period, h1, m1, dur, h2, m2,
      answer:{ kind:'time', h:h2, m:m2 },
      answerLabel: fmtTimeShort(h2, m2),
      story: choice(stories),
    };
  }
  function buildBefore(period, h2, m2, dur){
    const total = h2 * 60 + m2 - dur;
    const h1 = Math.floor(total / 60), m1 = total % 60;
    const stories = [
      `シナは ${fmtTime(period,h2,m2)}に ごはんを たべおわったよ。${dur}ふん たべていたなら、はじめたのは なんじ？`,
      `${fmtTime(period,h2,m2)}の ${dur}ふん まえは なんじ？`,
      `${fmtTime(period,h2,m2)}に おふろから でたよ。${dur}ふん はいっていたなら はじめは？`,
    ];
    return {
      type:'beforeMin', period, h1, m1, dur, h2, m2,
      answer:{ kind:'time', h:h1, m:m1 },
      answerLabel: fmtTimeShort(h1, m1),
      story: choice(stories),
    };
  }
  function buildElapsed(period, h1, m1, dur){
    const total = h1 * 60 + m1 + dur;
    const h2 = Math.floor(total / 60), m2 = total % 60;
    const stories = [
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで えほんを よんだよ。なんぷん？`,
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで マイクラで あそんだよ。なんぷん？`,
      `おかいもの ${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで。なんぷん かかった？`,
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで おさんぽ。なんぷん あるいた？`,
    ];
    return {
      type:'elapsed', period, h1, m1, dur, h2, m2,
      answer:{ kind:'dur', min:dur },
      answerLabel: fmtDur(dur),
      story: choice(stories),
    };
  }
  function buildElapsedHM(period, h1, m1, dur){
    const total = h1 * 60 + m1 + dur;
    const h2 = Math.floor(total / 60), m2 = total % 60;
    const stories = [
      `${fmtTime(period,h1,m1)}に おきて ${fmtTime(period,h2,m2)}に いえを でたよ。じゅんびの じかんは なんじかん なんぷん？`,
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで おでかけ。なんじかん なんぷん？`,
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで パーティー！ なんじかん なんぷん？`,
    ];
    return {
      type:'elapsedHM', period, h1, m1, dur, h2, m2,
      answer:{ kind:'dur', min:dur },
      answerLabel: fmtDur(dur),
      story: choice(stories),
    };
  }
  function buildSum(parts){
    const total = parts.reduce((s,v)=>s+v, 0);
    let story;
    if(parts.length === 2){
      // Heuristic: alternate between the two-part story variants
      story = Math.random() < 0.5
        ? `きのう ${fmtDur(parts[0])}、きょう ${fmtDur(parts[1])} どくしょしたよ。あわせて なんじかん なんぷん？`
        : `おべんきょう きのう ${fmtDur(parts[0])}、きょう ${fmtDur(parts[1])}。ふつかかんで あわせて なんじかん なんぷん？`;
    } else {
      story = `あさ ${fmtDur(parts[0])}、ひる ${fmtDur(parts[1])}、ゆうがた ${fmtDur(parts[2])} あそんだよ。あわせて なんじかん なんぷん？`;
    }
    return {
      type:'sumDur', parts, total,
      answer:{ kind:'dur', min:total },
      answerLabel: fmtDur(total),
      story,
    };
  }

  // ---- Question generators (random fresh question) ----
  function genAfter(){
    const period = Math.random() < 0.5 ? 'am' : 'pm';
    const h1 = 1 + rand(10);              // 1..10
    const m1 = 5 * (1 + rand(11));        // 5..55
    const dur = 5 * (2 + rand(10));       // 10..55
    const total = h1 * 60 + m1 + dur;
    if(Math.floor(total / 60) > 12) return genAfter();
    return buildAfter(period, h1, m1, dur);
  }
  function genBefore(){
    const period = Math.random() < 0.5 ? 'am' : 'pm';
    const h2 = 2 + rand(10);              // 2..11
    const m2 = 5 * (1 + rand(11));        // 5..55
    const dur = 5 * (2 + rand(10));       // 10..55
    const total = h2 * 60 + m2 - dur;
    if(total < 60) return genBefore();
    return buildBefore(period, h2, m2, dur);
  }
  function genElapsed(){
    const period = Math.random() < 0.5 ? 'am' : 'pm';
    const h1 = 1 + rand(10);
    const m1 = 5 * rand(12);
    const dur = 5 * (2 + rand(11));       // 10..60
    const total = h1 * 60 + m1 + dur;
    if(Math.floor(total / 60) > 12) return genElapsed();
    return buildElapsed(period, h1, m1, dur);
  }
  function genElapsedHM(){
    const period = Math.random() < 0.5 ? 'am' : 'pm';
    const h1 = 1 + rand(8);
    const m1 = 5 * rand(12);
    const hours = 1 + rand(2);            // 1..2
    const extraMin = 5 * (1 + rand(11));  // 5..55
    const dur = hours * 60 + extraMin;
    const total = h1 * 60 + m1 + dur;
    if(Math.floor(total / 60) > 12) return genElapsedHM();
    return buildElapsedHM(period, h1, m1, dur);
  }
  function genSum(){
    const variant = rand(3);
    let parts;
    if(variant === 0){
      const a = 5 * (6 + rand(8));         // 30..65
      const b = 5 * (8 + rand(10));        // 40..85
      parts = [a, b];
    } else if(variant === 1){
      const a = 5 * (5 + rand(6));
      const b = 5 * (5 + rand(6));
      const c = 5 * (6 + rand(8));
      parts = [a, b, c];
    } else {
      const a = 5 * (8 + rand(8));
      const b = 5 * (9 + rand(10));
      parts = [a, b];
    }
    const total = parts.reduce((s,v)=>s+v, 0);
    if(total < 60) return genSum();
    return buildSum(parts);
  }

  function genQuestion(levelId){
    const lv = CALC_LEVELS.find(l => l.id === levelId);
    switch(lv.type){
      case 'afterMin':  return genAfter();
      case 'beforeMin': return genBefore();
      case 'elapsed':   return genElapsed();
      case 'elapsedHM': return genElapsedHM();
      case 'sumDur':    return genSum();
    }
  }

  // Reconstruct a calc question from stored SRS params.
  // Period (am/pm) is not part of the SRS id, so we re-pick it for variety.
  function buildFromParams(p){
    const period = p.period || (Math.random() < 0.5 ? 'am' : 'pm');
    switch(p.type){
      case 'afterMin':  return buildAfter(period, p.h1, p.m1, p.dur);
      case 'beforeMin': return buildBefore(period, p.h2, p.m2, p.dur);
      case 'elapsed':   return buildElapsed(period, p.h1, p.m1, p.dur);
      case 'elapsedHM': return buildElapsedHM(period, p.h1, p.m1, p.dur);
      case 'sumDur':    return buildSum(p.parts);
    }
    return null;
  }

  // Salient parameters used to identify a question in FSRS storage.
  function paramsOf(q){
    switch(q.type){
      case 'afterMin':  return { type:q.type, h1:q.h1, m1:q.m1, dur:q.dur };
      case 'beforeMin': return { type:q.type, h2:q.h2, m2:q.m2, dur:q.dur };
      case 'elapsed':   return { type:q.type, h1:q.h1, m1:q.m1, dur:q.dur };
      case 'elapsedHM': return { type:q.type, h1:q.h1, m1:q.m1, dur:q.dur };
      case 'sumDur':    return { type:q.type, parts:q.parts.slice() };
    }
    return { type:q.type };
  }

  // ---- Choices (distractors) ----
  function makeChoices(q){
    const correctLabel = q.answerLabel;
    const pool = new Set([correctLabel]);
    const out = [];
    function add(label){
      if(pool.has(label)) return;
      pool.add(label);
      out.push({ label, correct:false });
    }
    if(q.answer.kind === 'time'){
      const h = q.answer.h, m = q.answer.m;
      add(fmtTimeShort(h === 12 ? 1 : h + 1, m));
      add(fmtTimeShort(h === 1 ? 12 : h - 1, m));
      const mP = (m + 10) % 60;
      const mM = (m - 10 + 60) % 60;
      add(fmtTimeShort(h, mP));
      add(fmtTimeShort(h, mM));
      if(m >= 10 && m % 10 === 0){
        const swappedH = Math.floor(m / 10);
        const swappedM = h * 10;
        if(swappedH >= 1 && swappedH <= 12 && swappedM < 60){
          add(fmtTimeShort(swappedH, swappedM));
        }
      }
      const mP5 = (m + 5) % 60;
      const mM5 = (m - 5 + 60) % 60;
      add(fmtTimeShort(h, mP5));
      add(fmtTimeShort(h, mM5));
    } else {
      const min = q.answer.min;
      [-15, -10, -5, 5, 10, 15].forEach(d => {
        const v = min + d;
        if(v > 0 && v < 24*60) add(fmtDur(v));
      });
      if(min >= 60){
        const h = Math.floor(min / 60);
        const r = min % 60;
        if(h >= 2 && r < 30){
          add(`${h-1}じかん${r+60}ふん`);
        }
        add(`${h}じかん`);
      }
      if(q.type === 'sumDur' && q.parts){
        const last = q.parts[q.parts.length - 1];
        add(fmtDur(last));
        if(q.parts.length >= 2){
          const sumFirstTwo = q.parts[0] + q.parts[1];
          add(fmtDur(sumFirstTwo));
        }
      }
    }
    const distractors = shuffle(out).slice(0, 3);
    const all = shuffle([{ label: correctLabel, correct:true }, ...distractors]);
    return all;
  }

  // ---- SVG: arrow between clocks / ? clock ----
  function renderArrow(){
    return `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" class="calc-arrow-svg">
      <defs>
        <linearGradient id="arrG" x1="0" x2="1">
          <stop offset="0" stop-color="#FFB8D9"/>
          <stop offset="1" stop-color="#F5A623"/>
        </linearGradient>
      </defs>
      <path d="M 6 30 L 44 30 M 36 18 L 50 30 L 36 42" stroke="url(#arrG)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`;
  }
  function renderMysteryClock(){
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="95" fill="#FFF6FA" stroke="#FFC2D9" stroke-width="4" stroke-dasharray="6 6"/>
      <circle cx="100" cy="100" r="86" fill="#FFFBFD"/>
      <text x="100" y="125" text-anchor="middle" font-family="'Mochiy Pop One',sans-serif" font-size="76" fill="#FFB8D9">?</text>
    </svg>`;
  }

  window.CALC = {
    CALC_LEVELS,
    genQuestion,
    buildFromParams,
    paramsOf,
    makeChoices,
    fmtTime,
    fmtTimeShort,
    fmtDur,
    renderArrow,
    renderMysteryClock,
  };
})();
