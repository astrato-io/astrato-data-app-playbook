/**
 * Explainability for Tidewater client reports: read the governed driver bridges from the semantic layer
 * (one query per grain, every client at once) and turn them into plain-English "what changed and why",
 * recommended actions and anomaly flags. The numbers are the layer's measures; only the wording is here.
 */
const CL = 'Clients', CH = 'Channels', AD = 'Ads', SV = 'SEO', WV = 'Web';
const N = (v) => Number(v ?? 0);

export const loadFacts = async (q) => {
  const [byChan, byKw, byDev, byClient] = await Promise.all([
    q({ dims: [['Client', CL], ['Channel', CH]], measures: ['Conversions Last Month', 'Conversions This Month', 'Conversions Change MoM', 'Conversions Impressions Effect MoM', 'Conversions CTR Effect MoM', 'Conversions CVR Effect MoM', 'CTR Last Month', 'CTR This Month', 'CVR Last Month', 'CVR This Month', 'CPC Last Month', 'CPC This Month', 'Spend This Month', 'Spend Change MoM', 'Conversion Value This Month', 'Conversion Value Change MoM', 'ROAS This Month', 'ROAS Last Month'] }),
    q({ dims: [['Client', CL], ['Keyword Group', SV]], measures: ['Average Position Last Month', 'Average Position This Month', 'Organic Clicks Change MoM', 'Organic Clicks Impressions Effect MoM', 'Organic Clicks CTR Effect MoM', 'Organic Clicks This Month'] }),
    q({ dims: [['Client', CL], ['Device', WV]], measures: ['Key Events Change MoM', 'Key Events Sessions Effect MoM', 'Key Events Rate Effect MoM', 'Engagement Rate Last Month', 'Engagement Rate This Month', 'Site Conversion Rate Last Month', 'Site Conversion Rate This Month'] }),
    q({ dims: [['Client', CL], ['Account Manager', CL], ['Business Model', CL], ['Sector', CL]], measures: ['Spend This Month', 'Spend Last Month', 'Conversions This Month', 'Conversions Last Month', 'Conversion Value This Month', 'Conversion Value Last Month', 'Conversion Value MoM', 'ROAS This Month', 'ROAS Last Month', 'CPA This Month', 'CPA Last Month', 'Organic Clicks This Month', 'Organic Clicks MoM', 'Key Events This Month', 'Key Events MoM', 'Web Revenue This Month'] }),
  ]);
  return { byChan, byKw, byDev, byClient, clients: byClient.map((r) => r.Client).sort() };
};

const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
const sgn = (v, f = (x) => Math.round(x).toLocaleString('en-GB')) => `${v >= 0 ? '+' : '−'}${f(Math.abs(v))}`;
const gbp = (v) => `£${Math.round(v).toLocaleString('en-GB')}`;
const EFFECT = {
  'Conversions Impressions Effect MoM': ['reach', 'impression volume'],
  'Conversions CTR Effect MoM': ['ctr', 'click-through rate'],
  'Conversions CVR Effect MoM': ['cvr', 'conversion rate'],
};
const ACTION = {
  ctr: (ch) => `Refresh creative on ${ch}: click-through is the driver, a classic sign of ad fatigue. Rotate 3–4 new concepts and cap frequency.`,
  cvr: (ch) => `Audit the ${ch} landing journey: people still click but convert less — check page speed, form and offer, especially on mobile.`,
  reach: (ch) => `Review ${ch} budget and impression share: the change is volume, not efficiency.`,
  cpc: (ch) => `Auction pressure on ${ch}: CPCs are up — tighten bids/targets or move budget to cheaper inventory.`,
  rank: (kw) => `SEO: “${kw}” rankings slipped — run a content and technical audit on those pages and refresh internal links.`,
  mobile: () => 'Mobile on-site conversion fell while traffic held — QA the mobile booking/checkout flow (GA4 shows the drop is on-site, not in the ads).',
};

/** What changed for one client this month, why, and what to do about it. */
export const explain = (F, client) => {
  const chan = F.byChan.filter((r) => r.Client === client);
  const kw = F.byKw.filter((r) => r.Client === client);
  const dev = F.byDev.filter((r) => r.Client === client);
  const c = F.byClient.find((r) => r.Client === client);
  if (!c) return { headline: 'No data for this client.', bullets: [], actions: [], drivers: [] };
  const cv1 = N(c['Conversions This Month']), cv0 = N(c['Conversions Last Month']), dConv = cv1 - cv0;
  const v1 = N(c['Conversion Value This Month']), v0 = N(c['Conversion Value Last Month']);
  const r1 = N(c['ROAS This Month']), r0 = N(c['ROAS Last Month']);
  const verb = dConv < 0 ? 'fell' : 'rose';
  const headline = `${client}: paid conversions ${verb} ${Math.abs(Math.round(dConv)).toLocaleString('en-GB')} (${sgn(dConv / cv0, (x) => pct(x))}) from August to September; conversion value ${sgn(v1 - v0, gbp)} and ROAS ${r0.toFixed(2)}x → ${r1.toFixed(2)}x.`;

  // Every (channel, effect) pair, signed, so the biggest movers in the direction of the change come first.
  const drivers = chan.flatMap((r) => Object.entries(EFFECT).map(([m, [k, label]]) => ({ channel: r.Channel, key: k, label, value: N(r[m]), row: r })))
    .sort((a, b) => (dConv < 0 ? a.value - b.value : b.value - a.value));
  const bullets = [];
  const actions = [];
  const top = drivers.filter((d) => (dConv < 0 ? d.value < 0 : d.value > 0)).slice(0, 2);
  for (const d of top) {
    const r = d.row;
    const detail = d.key === 'ctr' ? `CTR ${pct(N(r['CTR Last Month']), 2)} → ${pct(N(r['CTR This Month']), 2)}`
      : d.key === 'cvr' ? `CVR ${pct(N(r['CVR Last Month']), 2)} → ${pct(N(r['CVR This Month']), 2)}`
        : `${sgn(N(r['Spend Change MoM']), gbp)} spend`;
    const share = dConv ? Math.round((d.value / dConv) * 100) : 0;
    bullets.push(`${d.channel} · ${d.label}: ${sgn(d.value)} conversions (${share}% of the change) — ${detail}.`);
    actions.push(ACTION[d.key](d.channel));
  }
  // CPC pressure is a cost story even when conversions hold.
  const cpc = chan.map((r) => ({ ch: r.Channel, g: N(r['CPC This Month']) / N(r['CPC Last Month']) - 1 })).sort((a, b) => b.g - a.g)[0];
  if (cpc && cpc.g > 0.12) { bullets.push(`${cpc.ch} cost per click up ${pct(cpc.g)} month on month.`); actions.push(ACTION.cpc(cpc.ch)); }
  const offset = drivers.filter((d) => (dConv < 0 ? d.value > 0 : d.value < 0)).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
  if (offset && Math.abs(offset.value) >= 3) bullets.push(`Partly offset by ${offset.channel} ${offset.label} (${sgn(offset.value)} conversions).`);
  // Organic: the keyword group whose rankings moved most.
  const k = [...kw].sort((a, b) => N(a['Organic Clicks CTR Effect MoM']) - N(b['Organic Clicks CTR Effect MoM']))[0];
  if (k) {
    const p0 = N(k['Average Position Last Month']), p1 = N(k['Average Position This Month']);
    if (p1 - p0 > 1) { bullets.push(`SEO: “${k['Keyword Group']}” keywords fell from position ${p0.toFixed(1)} to ${p1.toFixed(1)}, costing ${Math.abs(Math.round(N(k['Organic Clicks CTR Effect MoM']))).toLocaleString('en-GB')} organic clicks through lower click-through — a ranking issue, not lower demand.`); actions.push(ACTION.rank(k['Keyword Group'])); }
    else bullets.push(`SEO steady: organic clicks ${sgn(N(c['Organic Clicks MoM']), (x) => pct(x))} month on month.`);
  }
  // Web: a device whose on-site conversion rate collapsed.
  const d = [...dev].sort((a, b) => N(a['Key Events Rate Effect MoM']) - N(b['Key Events Rate Effect MoM']))[0];
  if (d && N(d['Key Events Rate Effect MoM']) < -0.08 * Math.max(1, N(c['Key Events This Month']))) {
    bullets.push(`GA4: ${d.Device} engagement ${pct(N(d['Engagement Rate Last Month']))} → ${pct(N(d['Engagement Rate This Month']))}; ${Math.abs(Math.round(N(d['Key Events Rate Effect MoM'])))} fewer key events from on-site conversion alone.`);
    if (d.Device === 'Mobile') actions.push(ACTION.mobile());
  }
  return { headline, bullets, actions, drivers, client: c };
};

export const commentaryOf = (F, client) => {
  const e = explain(F, client);
  return [e.headline, '', 'What drove it', ...e.bullets.map((b) => `• ${b}`), '', 'What we are doing next', ...e.actions.map((a) => `• ${a}`)].join('\n');
};

/** Anomalies a reviewer must explain before a report can be approved. */
export const anomaliesOf = (F, client) => {
  const out = [];
  for (const r of F.byChan.filter((x) => x.Client === client)) {
    const c0 = N(r['Conversions Last Month']), c1 = N(r['Conversions This Month']);
    if (c0 >= 20 && Math.abs(c1 / c0 - 1) >= 0.2) out.push({ id: `conv-${r.Channel}`, what: `${r.Channel} conversions ${sgn(c1 / c0 - 1, (x) => pct(x))} MoM`, sev: c1 < c0 ? 'High' : 'Info' });
    const p0 = N(r['CPC Last Month']), p1 = N(r['CPC This Month']);
    if (p1 / p0 - 1 >= 0.15) out.push({ id: `cpc-${r.Channel}`, what: `${r.Channel} CPC ${sgn(p1 / p0 - 1, (x) => pct(x))} MoM`, sev: 'Medium' });
  }
  for (const k of F.byKw.filter((x) => x.Client === client)) {
    const d = N(k['Average Position This Month']) - N(k['Average Position Last Month']);
    if (d >= 1.5) out.push({ id: `pos-${k['Keyword Group']}`, what: `“${k['Keyword Group']}” average position ${N(k['Average Position Last Month']).toFixed(1)} → ${N(k['Average Position This Month']).toFixed(1)}`, sev: 'High' });
  }
  for (const v of F.byDev.filter((x) => x.Client === client)) {
    const d = N(v['Engagement Rate This Month']) - N(v['Engagement Rate Last Month']);
    if (d <= -0.06) out.push({ id: `eng-${v.Device}`, what: `${v.Device} engagement rate ${pct(N(v['Engagement Rate Last Month']))} → ${pct(N(v['Engagement Rate This Month']))}`, sev: 'High' });
  }
  return out;
};
