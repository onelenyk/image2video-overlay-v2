import type { SampleKind } from "../engine/template";

// What templates sit on in the gallery: one sample picture per kind of use.
// They are drawn 560 x 420, the same size as the preview stage, so a template
// can line its parts up with the rooms, streets and buttons below.

const WALL = "#38383b";
const plan = `
<rect width='560' height='420' fill='#d9d6ce'/>
<rect x='40' y='30' width='480' height='360' fill='#f3f1eb'/>
<g fill='none' stroke='#b9b5ab' stroke-width='1.5'>
  <path d='M472 36h42v148h-42zM480 96h26v34h-26z'/><circle cx='493' cy='60' r='9'/>
  <path d='M260 250h-40a40 40 0 0 0 40 40M400 300h40a40 40 0 0 1-40 40M320 190v-40a40 40 0 0 1 40 40M305 390v-40a40 40 0 0 1 40 40'/>
</g>
<g fill='none' stroke='${WALL}'>
  <path stroke-width='8' d='M345 390H520V30H40V390H305'/>
  <path stroke-width='5' d='M300 30V190M300 190H320M360 190H520M40 230H300M260 230V250M260 290V390M400 260V300M400 340V390M400 260H520'/>
</g>
<g fill='#f3f1eb' stroke='${WALL}' stroke-width='1.5'>
  <rect x='110' y='26' width='120' height='8'/><rect x='350' y='26' width='110' height='8'/>
  <rect x='36' y='90' width='8' height='90'/><rect x='36' y='280' width='8' height='80'/>
</g>`;

const ROADS: [string, number][] = [["M270-10V114M270 308V430M407 210H570", 6], ["M-10 120H570M140-10V430", 11], ["M-10 300H570", 16], ["M400-10V430", 14]];
const BLOCKS = [
  [20, 20, 40, 30], [74, 24, 44, 50], [22, 66, 36, 34], [166, 18, 60, 36], [166, 68, 56, 30], [296, 18, 80, 30], [300, 62, 70, 36], [414, 62, 36, 42],
  [166, 146, 70, 50], [250, 146, 50, 40], [316, 146, 60, 70], [166, 214, 50, 60], [232, 204, 66, 70], [316, 232, 60, 44],
  [424, 146, 56, 40], [496, 146, 50, 46], [424, 226, 56, 50], [496, 226, 50, 50],
  [18, 326, 50, 36], [80, 326, 40, 70], [166, 326, 80, 40], [166, 380, 80, 30], [284, 326, 44, 70], [340, 326, 40, 40], [424, 326, 60, 40], [496, 326, 50, 70], [424, 380, 56, 30],
];
const map = `
<rect width='560' height='420' fill='#e4e0d6'/>
<rect x='16' y='136' width='108' height='150' rx='8' fill='#c2dab2'/>
<path d='M468-10C478 40 520 70 572 86' fill='none' stroke='#a9cbe4' stroke-width='38'/>
<g fill='#d3cec2'>${BLOCKS.map(([x, y, w, h]) => `<rect x='${x}' y='${y}' width='${w}' height='${h}' rx='2'/>`).join("")}</g>
<g fill='none'>${ROADS.map(([d, w]) => `<path d='${d}' stroke='#c9c3b6' stroke-width='${w + 3}'/>`).join("")}${ROADS.map(([d, w]) => `<path d='${d}' stroke='#f8f6f1' stroke-width='${w}'/>`).join("")}</g>`;

const rows = [282, 314, 346, 378];
const bars = [50, 80, 60, 110, 90, 120, 70];
const screen = `
<rect width='560' height='420' fill='#eceef2'/>
<rect width='104' height='420' fill='#fff'/><rect x='104' width='456' height='48' fill='#fff'/>
<rect x='16' y='14' width='22' height='22' rx='6' fill='#2f6fed'/><rect x='46' y='20' width='40' height='10' rx='5' fill='#2b2b2e'/>
<rect x='8' y='90' width='88' height='26' rx='7' fill='#e7edfb'/>
<g fill='#d5d9e0'>${[70, 126, 154, 182, 210].map((y) => `<rect x='18' y='${y}' width='${y % 4 ? 62 : 50}' height='10' rx='5'/>`).join("")}</g>
<rect x='18' y='98' width='56' height='10' rx='5' fill='#2f6fed'/>
<rect x='124' y='18' width='96' height='12' rx='6' fill='#2b2b2e'/><rect x='330' y='12' width='150' height='24' rx='12' fill='#eceef2'/><circle cx='524' cy='24' r='12' fill='#c7ccd6'/>
<g fill='#fff'><rect x='120' y='64' width='250' height='180' rx='10'/><rect x='386' y='64' width='158' height='82' rx='10'/><rect x='386' y='162' width='158' height='82' rx='10'/><rect x='120' y='260' width='250' height='144' rx='10'/><rect x='386' y='260' width='158' height='144' rx='10'/></g>
<g fill='#c7ccd6'><rect x='136' y='80' width='70' height='9' rx='4.5'/><rect x='402' y='80' width='50' height='8' rx='4'/><rect x='402' y='178' width='60' height='8' rx='4'/><rect x='402' y='300' width='126' height='7' rx='3.5'/><rect x='402' y='314' width='96' height='7' rx='3.5'/></g>
<g fill='#2b2b2e'><rect x='402' y='100' width='84' height='20' rx='5'/><rect x='402' y='198' width='64' height='20' rx='5'/><rect x='402' y='278' width='90' height='10' rx='5'/></g>
<g fill='#b6c6ea'>${bars.map((h, i) => `<rect x='${140 + i * 32}' y='${228 - h}' width='20' height='${h}' rx='3'${h === 120 ? " fill='#2f6fed'" : ""}/>`).join("")}</g>
${rows.map((y) => `<circle cx='144' cy='${y}' r='8' fill='#d5d9e0'/><rect x='160' y='${y - 5}' width='${96 + (y % 3) * 12}' height='10' rx='5' fill='#d5d9e0'/><rect x='312' y='${y - 5}' width='42' height='10' rx='5' fill='#e6e8ec'/>`).join("")}
<rect x='402' y='350' width='126' height='34' rx='8' fill='#2f6fed'/><rect x='440' y='363' width='50' height='8' rx='4' fill='#fff'/>`;

const photo = `
<defs>
  <linearGradient id='w' x2='1' y2='1'><stop stop-color='#d8cdbd'/><stop offset='1' stop-color='#bdb09d'/></linearGradient>
  <linearGradient id='s' y2='1' x2='0'><stop stop-color='#a9cdea'/><stop offset='1' stop-color='#eef5f8'/></linearGradient>
  <linearGradient id='f' y2='1' x2='0'><stop stop-color='#9a7c62'/><stop offset='1' stop-color='#7c6250'/></linearGradient>
</defs>
<rect width='560' height='292' fill='url(#w)'/><rect y='292' width='560' height='128' fill='url(#f)'/><rect y='284' width='560' height='9' fill='#ece5d9'/>
<rect x='60' y='48' width='170' height='172' fill='url(#s)' stroke='#f4f0e8' stroke-width='9'/><path d='M145 48v172M60 134h170' stroke='#f4f0e8' stroke-width='5'/>
<path d='M60 220l60-70 40 40 30-26 40 56z' fill='#9db79a' opacity='.7'/>
<rect x='332' y='66' width='92' height='72' fill='#efe9dd' stroke='#5d4d3f' stroke-width='5'/><circle cx='366' cy='108' r='18' fill='#cf8f62'/><path d='M384 132l18-34 18 34z' fill='#6f8a8f'/>
<ellipse cx='392' cy='352' rx='176' ry='34' fill='#cdbda4'/>
<path d='M250 100v200' stroke='#3a3a3a' stroke-width='3'/><path d='M236 78h28l10 34h-48z' fill='#f3e6c2'/><ellipse cx='250' cy='302' rx='18' ry='4' fill='#3a3a3a'/>
<rect x='292' y='196' width='220' height='78' rx='16' fill='#5c7789'/><rect x='272' y='226' width='34' height='74' rx='13' fill='#526b7b'/><rect x='498' y='226' width='34' height='74' rx='13' fill='#526b7b'/><rect x='300' y='250' width='204' height='48' rx='12' fill='#6c8a9d'/>
<rect x='318' y='212' width='60' height='42' rx='9' fill='#dcbb8b'/><rect x='426' y='212' width='60' height='42' rx='9' fill='#ece3d2'/>
<rect x='336' y='322' width='112' height='11' rx='4' fill='#6a4e3a'/><path d='M346 333v24M438 333v24' stroke='#6a4e3a' stroke-width='5'/>
<path d='M94 304h40l-6 52h-28z' fill='#b3704d'/><g fill='#5b8a5c'><ellipse cx='114' cy='270' rx='12' ry='36'/><ellipse cx='94' cy='282' rx='10' ry='28' transform='rotate(-28 94 282)'/><ellipse cx='136' cy='282' rx='10' ry='28' transform='rotate(28 136 282)'/></g>`;

const url = (body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 560 420'>${body.replace(/\n\s*/g, "")}</svg>`)}")`;

/** CSS backgrounds, one per kind of sample. */
export const SAMPLES: Record<SampleKind, string> = { plan: url(plan), map: url(map), screen: url(screen), photo: url(photo) };
