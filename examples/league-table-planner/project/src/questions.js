/**
 * The app's copy of every stored business question it draws, written from
 * astrato_semantic_layer_get_question / the committed definitions (layer rev 16).
 * An Astrato App cannot read stored questions at runtime, so each tile re-expresses
 * its question here; the tile adds only presentation. Keep the names identical to
 * the layer: the card title IS the question.
 *
 * d = dimensions [key, stored dimension]; m = measures [key, stored measure, calc?];
 * o = orderBy [key, 'asc' | 'desc'].
 */
const Q = (title, d, m, o = [], note = '') => ({ title, d, m, o, note });

export const QUESTIONS = {
  // ---- Where we stand
  usRank: Q('Where do we rank this year, and how far have we moved?', [], [['rank', 'Rank (value)'], ['chg', 'Rank Change (value)'], ['r26', 'Rank 2026 (value)']]),
  usHistory: Q('How has our rank moved by edition?', [['ed', 'Edition']], [['rank', 'Historic Rank']], [['ed', 'asc']]),
  setRank: Q('What is the average rank in view, 2027 vs 2026?', [], [['r27', 'Avg Rank 2027'], ['r26', 'Avg Rank 2026'], ['gain', 'Avg Places Gained']]),
  setHistory: Q("How has the rival set's average rank moved by edition?", [['ed', 'Edition']], [['avg', 'Avg Historic Rank'], ['ma', 'Avg Historic Rank', { moving: { aggregate: 'AVG', begin: -1, end: 0 } }]], [['ed', 'asc']]),
  climbers: Q('How many universities climbed, vs last year?', [], [['now', 'Climbers'], ['before', 'Climbers 2026'], ['chg', 'Climbers Change']]),
  fallers: Q('How many universities fell, vs last year?', [], [['now', 'Fallers'], ['before', 'Fallers 2026'], ['chg', 'Fallers Change']]),
  movement: Q('How did our rivals move this year?', [['mv', 'Movement']], [['n', 'Universities']], [['mv', 'asc']]),
  climbersBand: Q("Where did this year's climbers sit?", [['band', 'Rank Band']], [['n', 'Climbers']], [['band', 'asc']]),
  fallersBand: Q("Where did this year's fallers sit?", [['band', 'Rank Band']], [['n', 'Fallers']], [['band', 'asc']]),
  moved: Q('Who moved most among our rivals?', [['uni', 'University (Short)']], [['chg', 'Rank Change (value)']], [['chg', 'desc']]),
  around: Q('Who sits within 10 places of us, and how do they score?', [['rank', 'Rank 2027'], ['uni', 'University']],
    [['r26', 'Rank 2026 (value)'], ['chg', 'Rank Change (value)'], ['total', 'Avg Total Score'], ['research', 'Avg Research'], ['entry', 'Avg Entry Points'], ['prospects', 'Avg Graduate Prospects'], ['experience', 'Avg Experience'], ['teaching', 'Avg Teaching']],
    [['rank', 'asc']]),

  // ---- What costs us places
  rankOnMeasure: Q('Where does each rival rank on each measure?', [['uni', 'University (Short)']],
    [['rank', 'Rank (value)'], ...[['research', 'Avg Research'], ['entry', 'Avg Entry Points'], ['prospects', 'Avg Graduate Prospects'], ['firsts', 'Avg Firsts'], ['continuation', 'Avg Continuation'], ['experience', 'Avg Experience'], ['teaching', 'Avg Teaching']].map(([k, n]) => [k, n, { rank: 'desc' }])],
    [['rank', 'asc']]),
  gapResearch: Q('Who is ahead of the rival set on research quality, and by how much?', [['uni', 'University (Short)']], [['gap', 'Research vs Set Average']], [['gap', 'desc']]),
  gapEntry: Q('Who is ahead of the rival set on entry standards, and by how much?', [['uni', 'University (Short)']], [['gap', 'Entry vs Set Average']], [['gap', 'desc']]),
  gapProspects: Q("How far is each rival from the rivals' average on graduate prospects?", [['uni', 'University (Short)']], [['gap', 'Prospects vs Set Average']], [['gap', 'desc']]),
  gapExperience: Q("How far is each rival from the rivals' average on student experience?", [['uni', 'University (Short)']], [['gap', 'Experience vs Set Average']], [['gap', 'desc']]),

  // ---- What it takes
  projected: Q('What rank would a higher total score buy us?', [], [['proj', 'Projected Rank at Score']]),
  overtakeCount: Q('How many universities would we overtake?', [], [['n', 'Universities']]),
  pointsGap: Q('How many points of total score separate each rival from us?', [['uni', 'University (Short)']], [['gap', 'Score Gap to Benchmark']], [['gap', 'desc']]),
  overtake: Q('Which universities would we overtake?', [['rank', 'Rank 2027'], ['uni', 'University (Short)']], [['total', 'Avg Total Score'], ['gap', 'Score Gap to Benchmark'], ['chg', 'Rank Change (value)']], [['rank', 'asc']]),
};
