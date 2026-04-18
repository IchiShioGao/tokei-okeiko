// Original cinnamon-roll-inspired mascot. Not affiliated with any existing IP.
// "シナ" (Shina) is a fluffy pastry-puppy with a cinnamon swirl on the tummy.

const MASCOT_COLORS = {
  shina:    { body:'#FFFFFF', ear:'#FFF3E0', swirl:'#C49977', cheek:'#FFB3C6', ribbon:'#BEE3F8' },
  mocha:    { body:'#E8C9A5', ear:'#D9B184', swirl:'#7A4E2B', cheek:'#E88BA5', ribbon:'#FFD5E5' },
  milky:    { body:'#FFF7E2', ear:'#F4E5C5', swirl:'#D1A06A', cheek:'#FFB3C6', ribbon:'#FFE58A' },
  berry:    { body:'#FFE0EC', ear:'#FFC9DD', swirl:'#C4567A', cheek:'#FF91B2', ribbon:'#FFFFFF' },
  lemon:    { body:'#FFF6BE', ear:'#FFE987', swirl:'#C4982B', cheek:'#FFB3C6', ribbon:'#BEE3F8' },
  lave:     { body:'#E4D8FF', ear:'#CBB7FF', swirl:'#7857C6', cheek:'#FFB3C6', ribbon:'#FFD5E5' },
  sora:     { body:'#D6ECFF', ear:'#BEE3F8', swirl:'#4A7BB5', cheek:'#FFB3C6', ribbon:'#FFD5E5' },
  matcha:   { body:'#DFF0C8', ear:'#C5E2A1', swirl:'#5B8A2E', cheek:'#FFB3C6', ribbon:'#FFE58A' },
  sakura:   { body:'#FFE8EE', ear:'#FFD0DC', swirl:'#D07090', cheek:'#FF91B2', ribbon:'#FFFFFF' },
};

const FRIENDS = [
  { key:'shina',  name:'シナ',     cost:0,   desc:'はじめての おともだち' },
  { key:'milky',  name:'ミルキー', cost:30,  desc:'やさしい こ' },
  { key:'mocha',  name:'モカ',     cost:80,  desc:'こんがり やけた こ' },
  { key:'berry',  name:'ベリー',   cost:150, desc:'あまずっぱい こ' },
  { key:'lemon',  name:'レモン',   cost:230, desc:'すっぱ げんき' },
  { key:'lave',   name:'ラベ',     cost:320, desc:'ゆめみがち' },
  { key:'sora',   name:'ソラ',     cost:420, desc:'おそらの いろ' },
  { key:'matcha', name:'マッチャ', cost:540, desc:'おちゃめ な こ' },
  { key:'sakura', name:'サクラ',   cost:680, desc:'はるの おとずれ' },
];

function mascotSVG(colorKey='shina', mood='happy'){
  const c = MASCOT_COLORS[colorKey] || MASCOT_COLORS.shina;
  const eyeY = mood === 'sad' ? 102 : 100;
  const mouth = mood === 'sad'
    ? `<path d="M 98 128 Q 110 120 122 128" stroke="#3D2B1F" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : mood === 'wow'
    ? `<ellipse cx="110" cy="128" rx="6" ry="8" fill="#3D2B1F"/>`
    : `<path d="M 98 126 Q 110 136 122 126" stroke="#3D2B1F" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const eyes = mood === 'sleepy'
    ? `<path d="M 86 ${eyeY} Q 92 ${eyeY+4} 98 ${eyeY}" stroke="#3D2B1F" stroke-width="3" fill="none" stroke-linecap="round"/>
       <path d="M 122 ${eyeY} Q 128 ${eyeY+4} 134 ${eyeY}" stroke="#3D2B1F" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="92" cy="${eyeY}" rx="4.5" ry="6" fill="#3D2B1F"/>
       <ellipse cx="128" cy="${eyeY}" rx="4.5" ry="6" fill="#3D2B1F"/>
       <circle cx="93.5" cy="${eyeY-2}" r="1.5" fill="#FFFFFF"/>
       <circle cx="129.5" cy="${eyeY-2}" r="1.5" fill="#FFFFFF"/>`;
  return `
  <svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
    <!-- feet -->
    <ellipse cx="90" cy="186" rx="14" ry="8" fill="${c.ear}"/>
    <ellipse cx="130" cy="186" rx="14" ry="8" fill="${c.ear}"/>
    <!-- ears (floppy) -->
    <path d="M 55 70 Q 40 105 60 130 Q 75 118 78 90 Z" fill="${c.ear}"/>
    <path d="M 165 70 Q 180 105 160 130 Q 145 118 142 90 Z" fill="${c.ear}"/>
    <!-- body -->
    <ellipse cx="110" cy="125" rx="62" ry="58" fill="${c.body}" stroke="#EADDC7" stroke-width="2"/>
    <!-- cinnamon swirl on tummy -->
    <g transform="translate(110 150)">
      <circle r="18" fill="${c.ear}"/>
      <path d="M 0 0 m -12 0 a 12 12 0 1 1 24 0 a 8 8 0 1 1 -16 0 a 4 4 0 1 1 8 0" fill="none" stroke="${c.swirl}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <!-- cheeks -->
    <circle cx="78" cy="118" r="7" fill="${c.cheek}" opacity=".7"/>
    <circle cx="142" cy="118" r="7" fill="${c.cheek}" opacity=".7"/>
    <!-- eyes -->
    ${eyes}
    <!-- mouth -->
    ${mouth}
    <!-- ribbon on ear -->
    <g transform="translate(60 64) rotate(-20)">
      <path d="M -8 0 L 0 -4 L 8 0 L 0 4 Z" fill="${c.ribbon}"/>
      <circle r="2.5" fill="${c.ribbon}"/>
    </g>
  </svg>`;
}

window.mascotSVG = mascotSVG;
window.FRIENDS = FRIENDS;
