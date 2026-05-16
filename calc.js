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

  // ---- Question generators ----
  // Each returns: { type, period, ...times, dur(s), answer, answerLabel, story }

  // ○分後の時こく (within same period, h2 <= 12)
  function genAfter(){
    const period = Math.random() < 0.5 ? 'am' : 'pm';
    const h1 = 1 + rand(10);              // 1..10
    const m1 = 5 * (1 + rand(11));        // 5..55 (avoid 0 for variety)
    const dur = 5 * (2 + rand(10));       // 10..55
    const total = h1 * 60 + m1 + dur;
    const h2 = Math.floor(total / 60);
    const m2 = total % 60;
    if(h2 > 12) return genAfter();
    const stories = [
      `${fmtTime(period,h1,m1)}から ${dur}ふん おさんぽしたよ。なんじに かえる？`,
      `シナは ${fmtTime(period,h1,m1)}に おひるねを はじめたよ。${dur}ふん ねたら なんじ？`,
      `${fmtTime(period,h1,m1)}から ピアノの れんしゅう ${dur}ふん。おわるのは いつ？`,
      `おやつタイム！ ${fmtTime(period,h1,m1)}から ${dur}ふん たべたら なんじ？`,
    ];
    return {
      type:'afterMin', period, h1, m1, dur, h2, m2,
      answer: { kind:'time', h:h2, m:m2 },
      answerLabel: fmtTimeShort(h2, m2),
      story: choice(stories),
    };
  }

  // ○分前の時こく
  function genBefore(){
    const period = Math.random() < 0.5 ? 'am' : 'pm';
    const h2 = 2 + rand(10);              // 2..11
    const m2 = 5 * (1 + rand(11));        // 5..55
    const dur = 5 * (2 + rand(10));       // 10..55
    const total = h2 * 60 + m2 - dur;
    if(total < 60) return genBefore();    // keep h1 >= 1
    const h1 = Math.floor(total / 60);
    const m1 = total % 60;
    const stories = [
      `シナは ${fmtTime(period,h2,m2)}に ごはんを たべおわったよ。${dur}ふん たべていたなら、はじめたのは なんじ？`,
      `${fmtTime(period,h2,m2)}の ${dur}ふん まえは なんじ？`,
      `${fmtTime(period,h2,m2)}に おふろから でたよ。${dur}ふん はいっていたなら はじめは？`,
    ];
    return {
      type:'beforeMin', period, h1, m1, dur, h2, m2,
      answer: { kind:'time', h:h1, m:m1 },
      answerLabel: fmtTimeShort(h1, m1),
      story: choice(stories),
    };
  }

  // けいか時間（同じ時間内、または1時間以内の差）
  function genElapsed(){
    const period = Math.random() < 0.5 ? 'am' : 'pm';
    const h1 = 1 + rand(10);
    const m1 = 5 * rand(12);
    const dur = 5 * (2 + rand(11));       // 10..60
    const total = h1 * 60 + m1 + dur;
    const h2 = Math.floor(total / 60);
    const m2 = total % 60;
    if(h2 > 12) return genElapsed();
    const stories = [
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで えほんを よんだよ。なんぷん？`,
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで マイクラで あそんだよ。なんぷん？`,
      `おかいもの ${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで。なんぷん かかった？`,
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで おさんぽ。なんぷん あるいた？`,
    ];
    return {
      type:'elapsed', period, h1, m1, dur, h2, m2,
      answer: { kind:'dur', min:dur },
      answerLabel: fmtDur(dur),
      story: choice(stories),
    };
  }

  // けいか時間（1時間以上、何時間何分）
  function genElapsedHM(){
    const period = Math.random() < 0.5 ? 'am' : 'pm';
    const h1 = 1 + rand(8);
    const m1 = 5 * rand(12);
    const hours = 1 + rand(2);            // 1..2 hours
    const extraMin = 5 * (1 + rand(11));  // 5..55 minutes
    const dur = hours * 60 + extraMin;
    const total = h1 * 60 + m1 + dur;
    const h2 = Math.floor(total / 60);
    const m2 = total % 60;
    if(h2 > 12) return genElapsedHM();
    const stories = [
      `${fmtTime(period,h1,m1)}に おきて ${fmtTime(period,h2,m2)}に いえを でたよ。じゅんびの じかんは なんじかん なんぷん？`,
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで おでかけ。なんじかん なんぷん？`,
      `${fmtTime(period,h1,m1)}から ${fmtTime(period,h2,m2)}まで パーティー！ なんじかん なんぷん？`,
    ];
    return {
      type:'elapsedHM', period, h1, m1, dur, h2, m2,
      answer: { kind:'dur', min:dur },
      answerLabel: fmtDur(dur),
      story: choice(stories),
    };
  }

  // たしざん おはなし — ensure total >= 60 so answer is "○じかん○ふん"
  function genSum(){
    const variant = rand(3);
    let parts, story;
    if(variant === 0){
      // 2-day reading
      const a = 5 * (6 + rand(8));         // 30..65
      const b = 5 * (8 + rand(10));        // 40..85
      parts = [a, b];
      story = `きのう ${fmtDur(a)}、きょう ${fmtDur(b)} どくしょしたよ。あわせて なんじかん なんぷん？`;
    } else if(variant === 1){
      // 3 short play sessions
      const a = 5 * (5 + rand(6));         // 25..50
      const b = 5 * (5 + rand(6));
      const c = 5 * (6 + rand(8));         // 30..65
      parts = [a, b, c];
      story = `あさ ${fmtDur(a)}、ひる ${fmtDur(b)}、ゆうがた ${fmtDur(c)} あそんだよ。あわせて なんじかん なんぷん？`;
    } else {
      // Yesterday + today study
      const a = 5 * (8 + rand(8));         // 40..75
      const b = 5 * (9 + rand(10));        // 45..90
      parts = [a, b];
      story = `おべんきょう きのう ${fmtDur(a)}、きょう ${fmtDur(b)}。ふつかかんで あわせて なんじかん なんぷん？`;
    }
    const total = parts.reduce((s,v)=>s+v, 0);
    if(total < 60) return genSum();  // safety
    return {
      type:'sumDur', parts, total,
      answer: { kind:'dur', min:total },
      answerLabel: fmtDur(total),
      story,
    };
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
      // Same minute, different hour (off-by-one)
      add(fmtTimeShort(h === 12 ? 1 : h + 1, m));
      add(fmtTimeShort(h === 1 ? 12 : h - 1, m));
      // Same hour, ±10 minute
      const mP = (m + 10) % 60;
      const mM = (m - 10 + 60) % 60;
      add(fmtTimeShort(h, mP));
      add(fmtTimeShort(h, mM));
      // Swapped digits if interesting (e.g. 4:30 -> 3:40)
      if(m >= 10 && m % 10 === 0){
        const swappedH = Math.floor(m / 10);
        const swappedM = h * 10;
        if(swappedH >= 1 && swappedH <= 12 && swappedM < 60){
          add(fmtTimeShort(swappedH, swappedM));
        }
      }
      // ±5 minute
      const mP5 = (m + 5) % 60;
      const mM5 = (m - 5 + 60) % 60;
      add(fmtTimeShort(h, mP5));
      add(fmtTimeShort(h, mM5));
    } else {
      const min = q.answer.min;
      // ±10, ±5 minute variants
      [-15, -10, -5, 5, 10, 15].forEach(d => {
        const v = min + d;
        if(v > 0 && v < 24*60) add(fmtDur(v));
      });
      // Common kid mistake: forgot to carry — "1じかん70ぷん" style
      if(min >= 60){
        const h = Math.floor(min / 60);
        const r = min % 60;
        if(h >= 2 && r < 30){
          // present (h-1) hours + (r+60) minutes
          add(`${h-1}じかん${r+60}ふん`);
        }
        // Hours-only confusion
        add(`${h}じかん`);
      }
      // For sum: present partial sums or each part as a wrong answer
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
    makeChoices,
    fmtTime,
    fmtTimeShort,
    fmtDur,
    renderArrow,
    renderMysteryClock,
  };
})();
