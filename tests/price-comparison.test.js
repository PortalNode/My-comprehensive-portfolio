const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('const dayNumber =');
const end = html.indexOf('/* الربح/الخسارة غير المحققة', start);
assert(start >= 0 && end > start);
const context = vm.createContext({});
vm.runInContext(`${html.slice(start, end)}
globalThis.stockPriceComparison=stockPriceComparison;
globalThis.combinedPriceComparison=combinedPriceComparison;`, context);
const series = rows => rows.map(([date, close]) => ({date, close}));
const close = (a,b,c) => series([
  ['2026-01-02', a], ['2026-01-03', b], ['2026-01-04', c]
]);
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8,
  `expected ${expected}; got ${actual}`);
const state = {
  lots:[
    {market:'SA',symbol:'SA1',buyDate:'2026-01-02',qty:1,remainingQty:1,buyPrice:100},
    {market:'US',symbol:'US1',buyDate:'2026-01-02',qty:1,remainingQty:1,buyPrice:100},
    {market:'US',symbol:'US1',buyDate:'2026-01-03',qty:1,remainingQty:1,buyPrice:90}
  ],sales:[],dividends:[],cashMoves:[]
};
const indices={SA:close(100,105,110),US:close(100,95,100)};
const histories={'SA:SA1':close(100,110,121),'US:US1':close(100,90,99)};
const splits={'SA:SA1':[],'US:US1':[]};
const sa=context.stockPriceComparison(state,indices.SA,{SA1:histories['SA:SA1']},
  {SA1:[]},'SA','2026-01-04');
const us=context.stockPriceComparison(state,indices.US,{US1:histories['US:US1']},
  {US1:[]},'US','2026-01-04');
near(sa.actual.period,21);
near(sa.benchmark.period,10);
near(us.actual.period,-1);
near(us.benchmark.period,0);
const all=context.combinedPriceComparison(state,indices,histories,splits,3.75,'2026-01-04');
assert.equal(all.reason,undefined);
assert.equal(all.from,'2026-01-02');
assert.equal(all.points.length,3);
const firstActual=(110+90*3.75)/(100+100*3.75);
const secondActual=(121+2*99*3.75)/(110+2*90*3.75);
const firstBench=(105+95*3.75)/(100+100*3.75);
const secondBench=(110/105*110+100/95*2*90*3.75)/(110+2*90*3.75);
near(all.actual.period,(firstActual*secondActual-1)*100);
near(all.benchmark.period,(firstBench*secondBench-1)*100);
const withoutFunding={...state,cashMoves:[]};
assert(context.stockPriceComparison(withoutFunding,indices.US,{US1:histories['US:US1']},
  {US1:[]},'US','2026-01-04').actual);
const sparse={SA:series([['2025-12-25',90],['2026-01-01',95],['2026-01-02',100],
  ['2026-01-03',105],['2026-01-04',110]]),US:indices.US};
assert.equal(context.combinedPriceComparison(state,sparse,histories,splits,3.75,
  '2026-01-04').from,'2026-01-02');
const missing={...histories,'US:US1':[]};
assert.match(context.combinedPriceComparison(state,indices,missing,splits,3.75,
  '2026-01-04').reason,/لا يتوفر تاريخ/);
const oldClosed={...state,lots:[...state.lots,
  {market:'SA',symbol:'OLD',buyDate:'2025-01-01',qty:2,remainingQty:0,buyPrice:50}],
  sales:[{market:'SA',symbol:'OLD',sellDate:'2025-05-01',qty:2,sellPrice:55}]};
near(context.combinedPriceComparison(oldClosed,indices,histories,splits,3.75,
  '2026-01-04').actual.period,all.actual.period);
console.log('price comparisons: market returns, daily weights, missing funding, dense window and missing prices passed');
