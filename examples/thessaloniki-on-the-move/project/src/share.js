/**
 * "Share on LinkedIn": a branded 1200×627 card drawn from the governed numbers on screen, a
 * suggested post, and a hand-off to LinkedIn's composer.
 *
 * LinkedIn cannot receive an image through a link, and the app sits behind Astrato sign-in so
 * LinkedIn cannot fetch a preview from it either. So the card is copied to the clipboard (paste
 * it into the post with Ctrl+V) and offered as a download, and the composer opens with the text.
 */

const W = 1200;
const H = 627;
const C = { navy: '#10263F', sea: '#1F6F9F', aqua: '#2BB3C0', sand: '#F5EFE4', card: '#FFFDF8', terra: '#E0583A', gold: '#F2B33D', muted: '#6E675B', line: '#E8DECD' };

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const wrap = (ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) => {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = words[i];
      if (lines === maxLines - 1) { line = words.slice(i).join(' '); break; }
    } else line = test;
  }
  ctx.fillText(line, x, y + lines * lineHeight);
  return lines + 1;
};

/**
 * @param card { scope, findings: [{ big, text }], kpis: [{ label, value }], hours: [{ label, value }] }
 */
export const drawCard = async (card) => {
  await document.fonts.load('800 60px Fraunces').catch(() => null);
  await document.fonts.load('600 20px Inter').catch(() => null);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // paper + sea band
  ctx.fillStyle = C.sand;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, H - 120, W, 120);

  // title
  ctx.fillStyle = C.sea;
  ctx.font = '700 15px Inter, sans-serif';
  ctx.fillText('ΘΕΣΣΑΛΟΝΙΚΗ · OSETH BUS TIMETABLE · 14 JUL – 3 AUG 2026', 56, 64);
  ctx.fillStyle = C.navy;
  ctx.font = '800 62px Fraunces, Georgia, serif';
  ctx.fillText('Thessaloniki', 52, 132);
  ctx.fillStyle = C.terra;
  ctx.font = 'italic 500 62px Fraunces, Georgia, serif';
  ctx.fillText('on the Move', 52, 196);
  ctx.fillStyle = C.sea;
  ctx.font = 'italic 500 21px Fraunces, Georgia, serif';
  ctx.fillText('How the city’s buses connect people, places, and daily life.', 56, 236);

  // three findings
  card.findings.slice(0, 3).forEach((f, i) => {
    const x = 56 + i * 196;
    const y = 270;
    ctx.fillStyle = C.card;
    ctx.fillRect(x, y, 184, 196);
    ctx.fillStyle = C.terra;
    ctx.fillRect(x, y, 5, 196);
    ctx.fillStyle = C.navy;
    let size = 30;
    do { ctx.font = `800 ${size}px Fraunces, Georgia, serif`; size -= 1; } while (ctx.measureText(f.big).width > 152 && size > 14);
    ctx.fillText(f.big, x + 18, y + 48);
    ctx.fillStyle = C.muted;
    ctx.font = '500 15px Inter, sans-serif';
    wrap(ctx, f.text, x + 18, y + 80, 152, 21, 5);
  });

  // the city's pulse: trips leaving each hour
  const px = 680;
  const py = 70;
  const pw = 464;
  const ph = 300;
  ctx.fillStyle = C.card;
  ctx.fillRect(px, py, pw, ph + 96);
  ctx.fillStyle = C.navy;
  ctx.font = '700 17px Inter, sans-serif';
  ctx.fillText('The city’s pulse — trips leaving each hour', px + 22, py + 36);
  const vals = card.hours.map((h) => h.value);
  const max = Math.max(...vals, 1);
  const gx = px + 30;
  const gy = py + 70;
  const gw = pw - 60;
  const gh = ph - 40;
  const X = (i) => gx + (i / Math.max(1, vals.length - 1)) * gw;
  const Y = (v) => gy + gh - (v / max) * gh;
  const grad = ctx.createLinearGradient(0, gy, 0, gy + gh);
  grad.addColorStop(0, 'rgba(224,88,58,.45)');
  grad.addColorStop(1, 'rgba(224,88,58,.03)');
  ctx.beginPath();
  ctx.moveTo(X(0), gy + gh);
  vals.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
  ctx.lineTo(X(vals.length - 1), gy + gh);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  vals.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = C.terra;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  const peakIdx = vals.indexOf(max);
  if (peakIdx >= 0) {
    ctx.fillStyle = C.terra;
    ctx.beginPath(); ctx.arc(X(peakIdx), Y(max), 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.navy;
    ctx.font = '700 15px Inter, sans-serif';
    ctx.fillText(`${Math.round(max)} trips at ${card.hours[peakIdx].label}`, Math.min(X(peakIdx) + 10, px + pw - 190), Y(max) - 12);
  }
  ctx.fillStyle = C.muted;
  ctx.font = '500 13px Inter, sans-serif';
  ['00:00', '06:00', '12:00', '18:00', '23:00'].forEach((t) => {
    const i = card.hours.findIndex((h) => h.label === t);
    if (i >= 0) ctx.fillText(t, X(i) - 18, gy + gh + 22);
  });

  // KPI strip on the sea band
  card.kpis.slice(0, 5).forEach((k, i) => {
    const x = 56 + i * 178;
    ctx.fillStyle = C.gold;
    ctx.font = '800 34px Fraunces, Georgia, serif';
    ctx.fillText(k.value, x, H - 62);
    ctx.fillStyle = '#C9D6E2';
    ctx.font = '600 14px Inter, sans-serif';
    ctx.fillText(k.label.toUpperCase(), x, H - 34);
  });

  // made by Astrato
  const logo = await loadImage('./astrato-logo-white.svg');
  ctx.fillStyle = '#9FB3C8';
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillText('MADE BY', W - 220, H - 50);
  if (logo) ctx.drawImage(logo, W - 150, H - 68, 100, 100 * (logo.height / logo.width || 0.29));
  ctx.fillStyle = '#9FB3C8';
  ctx.font = '500 12px Inter, sans-serif';
  ctx.fillText(card.scope, W - 220, H - 22);

  return canvas;
};

export const linkedInComposer = (text) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
