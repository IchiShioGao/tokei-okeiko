// Render an analog clock SVG showing the given hour (0-23) and minute (0-59).
function renderClock(hour, minute){
  const h = ((hour % 12) + 12) % 12;
  const m = ((minute % 60) + 60) % 60;
  const minAngle = m * 6;            // 360/60
  const hourAngle = h * 30 + m * 0.5; // 360/12 + smooth

  // Hour numbers (1..12)
  let nums = '';
  for(let i = 1; i <= 12; i++){
    const a = (i * 30 - 90) * Math.PI / 180;
    const x = 100 + Math.cos(a) * 72;
    const y = 100 + Math.sin(a) * 72 + 7;  // +7 for vertical centering
    nums += `<text x="${x}" y="${y}" text-anchor="middle" class="ck-num">${i}</text>`;
  }
  // Minute ticks
  let ticks = '';
  for(let i = 0; i < 60; i++){
    const a = (i * 6 - 90) * Math.PI / 180;
    const r1 = 88, r2 = i % 5 === 0 ? 80 : 84;
    const w = i % 5 === 0 ? 3 : 1.5;
    const col = i % 5 === 0 ? '#8B5E3C' : '#C49977';
    const x1 = 100 + Math.cos(a) * r1;
    const y1 = 100 + Math.sin(a) * r1;
    const x2 = 100 + Math.cos(a) * r2;
    const y2 = 100 + Math.sin(a) * r2;
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  }

  return `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <!-- outer rim -->
    <circle cx="100" cy="100" r="95" fill="#FFFFFF" stroke="#EADDC7" stroke-width="4"/>
    <circle cx="100" cy="100" r="95" fill="none" stroke="#F5A623" stroke-width="2" stroke-dasharray="4 6" opacity=".5"/>
    <!-- inner face -->
    <circle cx="100" cy="100" r="86" fill="#FFFBF3"/>
    ${ticks}
    <g font-family="'Mochiy Pop One', sans-serif" font-size="16" fill="#5B3A29">${nums}</g>
    <!-- hour hand -->
    <g transform="rotate(${hourAngle} 100 100)">
      <line x1="100" y1="108" x2="100" y2="55" stroke="#5B3A29" stroke-width="7" stroke-linecap="round"/>
    </g>
    <!-- minute hand -->
    <g transform="rotate(${minAngle} 100 100)">
      <line x1="100" y1="110" x2="100" y2="32" stroke="#F5A623" stroke-width="4.5" stroke-linecap="round"/>
    </g>
    <!-- center -->
    <circle cx="100" cy="100" r="6" fill="#5B3A29"/>
    <circle cx="100" cy="100" r="2.5" fill="#FFE58A"/>
  </svg>`;
}

window.renderClock = renderClock;
