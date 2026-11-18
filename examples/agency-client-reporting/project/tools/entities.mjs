/** Views and measures of "Tidewater Media – Client Performance" (ASTRATO_GALLERY.MOCK_DATA.AGENCY_*). Mock data from four source systems. */
export const title = (c) => c.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
export const AD = 'Ads', WV = 'Web', SV = 'SEO', CL = 'Clients', CH = 'Channels', MV = 'Months';
export const VIEWS = {
  [AD]: ['AGENCY_ADS', 'MONTH MONTH_BUCKET YTD_BUCKET CLIENT CHANNEL CAMPAIGN_ID CAMPAIGN CAMPAIGN_TYPE SOURCE_SYSTEM IMPRESSIONS CLICKS SPEND_GBP CONVERSIONS CONV_VALUE_GBP'],
  [WV]: ['AGENCY_GA4', 'MONTH MONTH_BUCKET YTD_BUCKET CLIENT CHANNEL DEVICE SOURCE_SYSTEM SESSIONS ENGAGED_SESSIONS KEY_EVENTS REVENUE_GBP'],
  [SV]: ['AGENCY_SEO', 'MONTH MONTH_BUCKET YTD_BUCKET CLIENT CHANNEL KEYWORD_GROUP SOURCE_SYSTEM IMPRESSIONS CLICKS POSITION_X_IMPR TRACKED_KEYWORDS TOP3_KEYWORDS'],
  [CL]: ['AGENCY_CLIENTS', 'CLIENT SECTOR BUSINESS_MODEL ACCOUNT_MANAGER MONTHLY_RETAINER_GBP PACKAGE CLIENT_SINCE'],
  [CH]: ['AGENCY_CHANNELS', 'CHANNEL PLATFORM CHANNEL_GROUP PAID_ORGANIC CHANNEL_ORDER'],
  [MV]: ['AGENCY_MONTHS', 'MONTH_INDEX MONTH MONTH_LABEL YEAR MONTH_NUM MONTH_START MONTH_BUCKET YTD_BUCKET'],
};
export const JOINS = [AD, WV, SV].flatMap((from) => [{ from, to: CL, field: 'Client' }, { from, to: CH, field: 'Channel' }, { from, to: MV, field: 'Month' }]);

const agg = (id, view, field, aggregation, extra = {}) => ({ id, kind: 'aggregate', field: { view, field }, aggregation, ...extra });
const eq = (view, field, value) => ({ filter: { conditions: [{ id: 'c', field: { view, field }, operator: 'equals', value }] } });
const ms = (name, description, inputs, pattern, expression) => ({ entity: 'measure', name, definition: { description, inputs, ...(expression ? { expression } : {}), format: { mode: 'custom', pattern } } });
const fd = (name, view, field, description) => ({ entity: 'dimension', name, definition: { kind: 'field', field: { view, field }, description } });

const GBP = '£#,##0', GBP2 = '£#,##0.00', INT = '#,##0', PCT = '0.00%', PCT1 = '0.0%', SPCT = '+0.0%;-0.0%;0.0%', PTS = '+0.00%;-0.00%;0.00%', X = '0.00"x"', POS = '0.0', SPOS = '+0.0;-0.0;0.0', SINT = '+#,##0;-#,##0;0', SGBP = '+£#,##0;-£#,##0;£0';
const P = { tm: ['Month Bucket', 'This month'], lm: ['Month Bucket', 'Last month'], ly: ['Month Bucket', 'Same month LY'], cy: ['Ytd Bucket', 'CY YTD'], py: ['Ytd Bucket', 'PY YTD'] };
const LAB = { tm: 'This Month', lm: 'Last Month', ly: 'Same Month LY', cy: 'YTD', py: 'PY YTD' };
const per = (view, k) => (k ? eq(view, ...P[k]) : {});
const sum = (id, view, field, k) => agg(id, view, field, 'SUM', per(view, k));

/** X, X This Month … X PY YTD, X MoM, X YoY, X YTD Growth. */
const sumFam = (name, desc, view, field, pattern) => [
  ms(name, desc, [sum('x', view, field)], pattern),
  ...Object.keys(LAB).map((k) => ms(`${name} ${LAB[k]}`, `${desc} (${LAB[k]}).`, [sum('x', view, field, k)], pattern)),
  ms(`${name} MoM`, `${name}: this month vs last month.`, [sum('a', view, field, 'tm'), sum('b', view, field, 'lm')], SPCT, 'a / b - 1'),
  ms(`${name} YoY`, `${name}: this month vs the same month last year.`, [sum('a', view, field, 'tm'), sum('b', view, field, 'ly')], SPCT, 'a / b - 1'),
  ms(`${name} YTD Growth`, `${name}: 2026 YTD vs 2025 YTD.`, [sum('a', view, field, 'cy'), sum('b', view, field, 'py')], SPCT, 'a / b - 1'),
];
/** Ratio a/b (× mult): base, periods, MoM and YoY as a ratio change or a points difference. */
const ratioFam = (name, desc, view, num, den, pattern, change, mult = 1) => {
  const e = mult === 1 ? 'a / b' : `a / b * ${mult}`;
  const inp = (k) => [sum('a', view, num, k), sum('b', view, den, k)];
  const two = (k1, k2) => [sum('a', view, num, k1), sum('b', view, den, k1), sum('c', view, num, k2), sum('d', view, den, k2)];
  const cmp = change === 'ratio' ? '(a / b) / (c / d) - 1' : mult === 1 ? 'a / b - c / d' : `(a / b - c / d) * ${mult}`;
  const cp = change === 'ratio' ? SPCT : change === 'pos' ? SPOS : PTS;
  return [
    ms(name, desc, inp(), pattern, e),
    ...Object.keys(LAB).map((k) => ms(`${name} ${LAB[k]}`, `${desc} (${LAB[k]}).`, inp(k), pattern, e)),
    ms(`${name} MoM`, `${name}: this month vs last month.`, two('tm', 'lm'), cp, cmp),
    ms(`${name} YoY`, `${name}: this month vs the same month last year.`, two('tm', 'ly'), cp, cmp),
  ];
};
/**
 * Explainability: split the change in a product metric into effects that add up exactly to it
 * (sequential substitution). Conversions = Impressions × CTR × CVR; Conversion value = Conversions × value per
 * conversion; Spend = Clicks × CPC; Organic clicks = Impressions × CTR; Key events = Sessions × rate.
 */
const drivers = (sfx, k0) => {
  const t = (id, view, field) => sum(id, view, field, 'tm');
  const o = (id, view, field) => sum(id, view, field, k0);
  const vs = sfx === 'MoM' ? 'last month' : 'the same month last year';
  return [
    ms(`Conversions Change ${sfx}`, `Conversions this month minus ${vs}.`, [t('a', AD, 'Conversions'), o('b', AD, 'Conversions')], SINT, 'a - b'),
    ms(`Conversions Impressions Effect ${sfx}`, `Part of the conversion change vs ${vs} explained by impression volume (reach / budget).`, [t('i', AD, 'Impressions'), o('j', AD, 'Impressions'), o('w', AD, 'Conversions')], SINT, '(i - j) * w / j'),
    ms(`Conversions CTR Effect ${sfx}`, `Part of the conversion change vs ${vs} explained by click-through rate (creative / ad relevance).`, [t('i', AD, 'Impressions'), o('j', AD, 'Impressions'), t('c', AD, 'Clicks'), o('d', AD, 'Clicks'), o('w', AD, 'Conversions')], SINT, '(c - i * d / j) * w / d'),
    ms(`Conversions CVR Effect ${sfx}`, `Part of the conversion change vs ${vs} explained by conversion rate (landing page / offer).`, [t('c', AD, 'Clicks'), o('d', AD, 'Clicks'), t('v', AD, 'Conversions'), o('w', AD, 'Conversions')], SINT, 'v - c * w / d'),
    ms(`Conversion Value Change ${sfx}`, `Conversion value this month minus ${vs}.`, [t('a', AD, 'Conv Value Gbp'), o('b', AD, 'Conv Value Gbp')], SGBP, 'a - b'),
    ms(`Conversion Value Volume Effect ${sfx}`, `Value change vs ${vs} from the number of conversions.`, [t('v', AD, 'Conversions'), o('w', AD, 'Conversions'), o('r', AD, 'Conv Value Gbp')], SGBP, '(v - w) * r / w'),
    ms(`Conversion Value AOV Effect ${sfx}`, `Value change vs ${vs} from value per conversion.`, [t('v', AD, 'Conversions'), o('w', AD, 'Conversions'), t('q', AD, 'Conv Value Gbp'), o('r', AD, 'Conv Value Gbp')], SGBP, 'q - v * r / w'),
    ms(`Spend Change ${sfx}`, `Media spend this month minus ${vs}.`, [t('a', AD, 'Spend Gbp'), o('b', AD, 'Spend Gbp')], SGBP, 'a - b'),
    ms(`Spend Clicks Effect ${sfx}`, `Spend change vs ${vs} from click volume.`, [t('c', AD, 'Clicks'), o('d', AD, 'Clicks'), o('s', AD, 'Spend Gbp')], SGBP, '(c - d) * s / d'),
    ms(`Spend CPC Effect ${sfx}`, `Spend change vs ${vs} from cost per click (auction pressure).`, [t('c', AD, 'Clicks'), o('d', AD, 'Clicks'), t('r', AD, 'Spend Gbp'), o('s', AD, 'Spend Gbp')], SGBP, 'r - c * s / d'),
    ms(`Organic Clicks Change ${sfx}`, `Organic clicks this month minus ${vs}.`, [t('a', SV, 'Clicks'), o('b', SV, 'Clicks')], SINT, 'a - b'),
    ms(`Organic Clicks Impressions Effect ${sfx}`, `Organic click change vs ${vs} from search demand / visibility.`, [t('i', SV, 'Impressions'), o('j', SV, 'Impressions'), o('k', SV, 'Clicks')], SINT, '(i - j) * k / j'),
    ms(`Organic Clicks CTR Effect ${sfx}`, `Organic click change vs ${vs} from click-through rate (rankings / SERP).`, [t('i', SV, 'Impressions'), o('j', SV, 'Impressions'), t('h', SV, 'Clicks'), o('k', SV, 'Clicks')], SINT, 'h - i * k / j'),
    ms(`Key Events Change ${sfx}`, `GA4 key events this month minus ${vs}.`, [t('a', WV, 'Key Events'), o('b', WV, 'Key Events')], SINT, 'a - b'),
    ms(`Key Events Sessions Effect ${sfx}`, `Key-event change vs ${vs} from traffic.`, [t('s', WV, 'Sessions'), o('u', WV, 'Sessions'), o('f', WV, 'Key Events')], SINT, '(s - u) * f / u'),
    ms(`Key Events Rate Effect ${sfx}`, `Key-event change vs ${vs} from on-site conversion rate.`, [t('s', WV, 'Sessions'), o('u', WV, 'Sessions'), t('e', WV, 'Key Events'), o('f', WV, 'Key Events')], SINT, 'e - s * f / u'),
  ];
};

export const DIMS = [
  fd('Month', MV, 'Month', 'Calendar month YYYY-MM (shared by every source).'),
  fd('Month Label', MV, 'Month Label', 'Month as "Sep 26".'),
  fd('Year', MV, 'Year', 'Calendar year.'),
  fd('Client', CL, 'Client', 'Tidewater Media client (shared by every source).'),
  fd('Sector', CL, 'Sector', 'Client sector.'),
  fd('Business Model', CL, 'Business Model', 'E-commerce or lead generation.'),
  fd('Account Manager', CL, 'Account Manager', 'Tidewater account manager.'),
  fd('Package', CL, 'Package', 'Retainer package.'),
  fd('Channel', CH, 'Channel', 'Marketing channel (shared by every source).'),
  fd('Platform', CH, 'Platform', 'Google Ads, Meta Ads, SEO, Website.'),
  fd('Channel Group', CH, 'Channel Group', 'Paid search, paid social, organic, direct & owned.'),
  fd('Paid Organic', CH, 'Paid Organic', 'Paid, organic or owned.'),
  fd('Campaign', AD, 'Campaign', 'Ad campaign (Google Ads / Meta Ads Manager).'),
  fd('Campaign Type', AD, 'Campaign Type', 'Search, Performance Max, Advantage+…'),
  fd('Device', WV, 'Device', 'GA4 device category.'),
  fd('Keyword Group', SV, 'Keyword Group', 'Search Console keyword cluster.'),
];

export const ENTITIES = [
  // Paid media — Google Ads + Meta Ads Manager
  ...sumFam('Spend', 'Paid media spend, £', AD, 'Spend Gbp', GBP),
  ...sumFam('Impressions', 'Paid ad impressions', AD, 'Impressions', INT),
  ...sumFam('Clicks', 'Paid ad clicks', AD, 'Clicks', INT),
  ...sumFam('Conversions', 'Platform-reported conversions', AD, 'Conversions', INT),
  ...sumFam('Conversion Value', 'Platform-reported conversion value (revenue / lead value), £', AD, 'Conv Value Gbp', GBP),
  ...ratioFam('CTR', 'Clicks ÷ impressions', AD, 'Clicks', 'Impressions', PCT, 'diff'),
  ...ratioFam('CPC', 'Spend ÷ clicks, £', AD, 'Spend Gbp', 'Clicks', GBP2, 'ratio'),
  ...ratioFam('CPM', 'Spend per 1,000 impressions, £', AD, 'Spend Gbp', 'Impressions', GBP2, 'ratio', 1000),
  ...ratioFam('CVR', 'Conversions ÷ clicks', AD, 'Conversions', 'Clicks', PCT, 'diff'),
  ...ratioFam('CPA', 'Spend ÷ conversions, £', AD, 'Spend Gbp', 'Conversions', GBP2, 'ratio'),
  ...ratioFam('ROAS', 'Conversion value ÷ spend', AD, 'Conv Value Gbp', 'Spend Gbp', X, 'ratio'),
  // Web analytics — GA4
  ...sumFam('Sessions', 'GA4 sessions', WV, 'Sessions', INT),
  ...sumFam('Key Events', 'GA4 key events (purchases / leads)', WV, 'Key Events', INT),
  ...sumFam('Web Revenue', 'GA4 revenue (purchases or lead value), £', WV, 'Revenue Gbp', GBP),
  ...ratioFam('Engagement Rate', 'Engaged sessions ÷ sessions', WV, 'Engaged Sessions', 'Sessions', PCT1, 'diff'),
  ...ratioFam('Site Conversion Rate', 'Key events ÷ sessions', WV, 'Key Events', 'Sessions', PCT, 'diff'),
  // SEO — Google Search Console + rank tracking
  ...sumFam('Organic Clicks', 'Search Console clicks', SV, 'Clicks', INT),
  ...sumFam('Organic Impressions', 'Search Console impressions', SV, 'Impressions', INT),
  ...ratioFam('Organic CTR', 'Organic clicks ÷ impressions', SV, 'Clicks', 'Impressions', PCT, 'diff'),
  ...ratioFam('Average Position', 'Impression-weighted average Google position (lower is better)', SV, 'Position X Impr', 'Impressions', POS, 'pos'),
  ms('Top 3 Keywords', 'Tracked keywords ranking in the top 3; use by month.', [sum('x', SV, 'Top3 Keywords')], INT),
  ...['tm', 'lm', 'ly'].map((k) => ms(`Top 3 Keywords ${LAB[k]}`, `Tracked keywords in the top 3 (${LAB[k]}).`, [sum('x', SV, 'Top3 Keywords', k)], INT)),
  ms('Top 3 Keywords Change MoM', 'Top-3 keywords this month minus last month.', [sum('a', SV, 'Top3 Keywords', 'tm'), sum('b', SV, 'Top3 Keywords', 'lm')], SINT, 'a - b'),
  ms('Top 3 Share This Month', 'Share of tracked keywords in the top 3, this month.', [sum('a', SV, 'Top3 Keywords', 'tm'), sum('b', SV, 'Tracked Keywords', 'tm')], PCT1, 'a / b'),
  // Explainability — additive driver bridges
  ...drivers('MoM', 'lm'),
  ...drivers('YoY', 'ly'),
];
export const COMPARE = [];
