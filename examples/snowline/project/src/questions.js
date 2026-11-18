/**
 * The app's copy of every stored business question it draws, written from the definitions
 * committed to the "Ski Resort Operations" semantic layer (published revision 6) and read back
 * with astrato_semantic_layer_execute_question. In local development an Astrato App cannot run
 * a stored question by name (app-runtime 0.9's runQuestion needs the `question:run` capability,
 * granted only in a published App or the Builder preview), so each tile re-expresses its question
 * here and adds only presentation. The card title IS the question, word for word.
 *
 * d = dimensions [key, stored dimension]; m = measures [key, stored measure, calc?];
 * o = orderBy [key, 'asc' | 'desc']; x = { season: '2025/26' } static filter, { topN }.
 */
const Q = (title, d, m, o = [], x = {}) => ({ title, d, m, o, ...x });
const THIS_SEASON = { season: '2025/26' };

export const QUESTIONS = {
  // ---- Season review
  snowKpi: Q('How much snow fell this season, against last season?', [], [['now', 'Snowfall This Season'], ['before', 'Snowfall Last Season'], ['chg', 'Snowfall Change vs Last Season']]),
  snowWeeks: Q('How much fresh snow fell each week of this season?', [['wk', 'Season Week']], [['snow', 'Total Snowfall']], [['wk', 'asc']], THIS_SEASON),
  crowdKpi: Q('Did the crowds grow with the snow?', [], [['now', 'Crowd Index This Season'], ['before', 'Crowd Index Last Season'], ['chg', 'Crowd Index Change vs Last Season']]),
  crowdWeeks: Q('How busy was each week of this season?', [['wk', 'Season Week']], [['crowd', 'Avg Crowd Index']], [['wk', 'asc']], THIS_SEASON),
  baseKpi: Q('How deep was the snow base this season?', [], [['now', 'Base Depth This Season'], ['chg', 'Base Depth Change vs Last Season']]),
  baseWeeks: Q('How did the snow base build through this season?', [['wk', 'Season Week']], [['base', 'Avg Base Depth']], [['wk', 'asc']], THIS_SEASON),
  qpwKpi: Q('How many powder weeks went quiet this season?', [], [['now', 'Quiet Powder Weeks This Season'], ['chg', 'Quiet Powder Weeks Change vs Last Season']]),
  qpwStage: Q('In which part of the season did powder weeks go quiet?', [['stage', 'Season Stage']], [['qpw', 'Quiet Powder Weeks']], [['stage', 'asc']], THIS_SEASON),
  scoreKpi: Q('Was the average week better for guests this season?', [], [['now', 'Overall Week Score This Season'], ['chg', 'Overall Week Score Change vs Last Season']]),
  scoreWeeks: Q('How did week quality move through this season?', [['wk', 'Season Week']], [['score', 'Overall Week Score']], [['wk', 'asc']], THIS_SEASON),
  hero: Q('Did the snowiest weeks draw the biggest crowds?', [['wk', 'Season Week']], [['snow', 'Avg Weekly Snowfall'], ['crowd', 'Avg Crowd Index']], [['wk', 'asc']]),
  resorts: Q("How did each resort's season compare with last season?", [['resort', 'Resort']],
    [['score', 'Overall Week Score This Season'], ['crowd', 'Crowd Index This Season'], ['crowdChg', 'Crowd Index Change vs Last Season'], ['snowChg', 'Snowfall Change vs Last Season'], ['qpw', 'Quiet Powder Weeks This Season'], ['head', 'Demand Headroom This Season']],
    [['score', 'desc']]),

  // ---- Best resorts & weeks
  bestResorts: Q('Which resorts give guests the best weeks?', [['resort', 'Resort']], [['score', 'Overall Week Score'], ['rank', 'Overall Week Score', { rank: 'desc' }]], [['score', 'desc']]),
  bestWeeks: Q('Which weeks of the season are best at each resort?', [['resort', 'Resort'], ['wk', 'Season Week']], [['score', 'Overall Week Score']], [['resort', 'asc'], ['wk', 'asc']]),
  topTen: Q('Which were the ten best resort-weeks of this season?', [['resort', 'Resort'], ['week', 'Week']], [['score', 'Overall Week Score'], ['snow', 'Avg Weekly Snowfall'], ['crowd', 'Avg Crowd Index'], ['cost', 'Avg Trip Cost']], [['score', 'desc']], { ...THIS_SEASON, topN: { by: 'score', count: 10 } }),
  profile: Q('How does each resort score on snow, value, quiet, family and expert terrain?', [['resort', 'Resort']],
    [['snow', 'Avg Snow Score'], ['value', 'Avg Value Score'], ['quiet', 'Avg Quiet Score'], ['family', 'Avg Family Score'], ['expert', 'Avg Expert Score'], ['cost', 'Avg Trip Cost']], [['snow', 'desc']]),

  // ---- Snow & crowds
  bands: Q('How busy are the slopes at each level of fresh snow, in holiday and regular weeks?', [['band', 'Snowfall Band'], ['type', 'Week Type']], [['crowd', 'Avg Crowd Index']], [['band', 'asc']]),
  uplift: Q('How much busier are holiday weeks than regular weeks?', [], [['now', 'Holiday Crowd Uplift This Season'], ['chg', 'Holiday Crowd Uplift Change vs Last Season']]),
  weekTypes: Q('How busy are holiday and regular weeks?', [['type', 'Week Type']], [['crowd', 'Avg Crowd Index']], [['type', 'asc']]),
  stages: Q('Which part of the season has the deepest base but the thinnest crowds?', [['stage', 'Season Stage']], [['base', 'Avg Base Depth'], ['crowd', 'Avg Crowd Index']], [['stage', 'asc']]),
  smoothed: Q('Do crowds follow the snow once the weekly noise is smoothed out?', [['wk', 'Season Week']],
    [['snow', 'Avg Weekly Snowfall', { moving: { aggregate: 'AVG', begin: -2, end: 0 } }], ['crowd', 'Avg Crowd Index', { moving: { aggregate: 'AVG', begin: -2, end: 0 } }]], [['wk', 'asc']]),
  levels: Q('How many resort-weeks reach each crowd level at each snowfall band?', [['band', 'Snowfall Band'], ['level', 'Crowd Level']], [['n', 'Resort Weeks']], [['band', 'asc'], ['level', 'asc']]),

  // ---- Next season's marketing
  headroom: Q('Where is the snow better than the crowds it draws?', [['resort', 'Resort']], [['head', 'Demand Headroom']], [['head', 'desc']]),
  qpwResorts: Q('Which resorts hold most of the quiet powder weeks?', [['resort', 'Resort'], ['airport', 'Gateway Airport']], [['qpw', 'Quiet Powder Weeks'], ['share', 'Share of Quiet Powder Weeks'], ['head', 'Demand Headroom'], ['cost', 'Avg Trip Cost']], [['qpw', 'desc']]),
  airports: Q('Which gateway airports serve the most quiet powder weeks?', [['airport', 'Gateway Airport']], [['qpw', 'Quiet Powder Weeks']], [['qpw', 'desc']]),
  targets: Q('How many target weeks does the campaign rule find?', [], [['n', 'Target Weeks']]),
  // Added in layer revision 10: a season comparison for the what-if KPI and a governed baseline
  // (the default plan) beside the scenario.
  targetsKpi: Q('How many target weeks does the campaign rule find this season, against last season?', [],
    [['now', 'Target Weeks This Season'], ['before', 'Target Weeks Last Season'], ['chg', 'Target Weeks Change vs Last Season']]),
  targetsStage: Q('In which part of the season does the campaign rule find its target weeks?', [['stage', 'Season Stage']], [['n', 'Target Weeks']], [['stage', 'asc']]),
  splitBase: Q("How would next season's marketing budget split across resorts, against the default plan?", [['resort', 'Resort']],
    [['base', 'Suggested Budget at Default Rule'], ['budget', 'Suggested Budget']], [['budget', 'desc']]),
  splitStageBase: Q('In which part of the season should the budget land, against the default plan?', [['stage', 'Season Stage']],
    [['base', 'Suggested Budget at Default Rule'], ['budget', 'Suggested Budget']], [['stage', 'asc']]),
  split: Q("How would next season's marketing budget split across resorts?", [['resort', 'Resort']], [['budget', 'Suggested Budget'], ['n', 'Target Weeks']], [['budget', 'desc']]),
  splitStage: Q('In which part of the season should the budget land?', [['stage', 'Season Stage']], [['budget', 'Suggested Budget']], [['stage', 'asc']]),
};
