const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function monthlyUnrealizedSeries(');
const end = html.indexOf('/* ============================================================================\n   ChartManager', start);
assert(start >= 0 && end > start, 'monthly calculation must be present');

const context = vm.createContext({});
vm.runInContext(`
  const todayStr = () => '2026-04-15';
  const dayNumber = date => Date.parse(date+'T00:00:00Z') / 86400000;
  const validDay = date => /^\\d{4}-\\d{2}-\\d{2}$/.test(date) &&
    Number.isFinite(dayNumber(date)) &&
    new Date(dayNumber(date)*86400000).toISOString().slice(0,10) === date;
  ${html.slice(start, end)}
  globalThis.calculate = monthlyUnrealizedSeries;
`, context);
const calculate = context.calculate;
const history = (...rows) => rows.map(([date, close]) => ({date, close}));
const buy = (date, qty, price, commission = 0) => ({
  market:'SA', symbol:'TEST', buyDate:date, qty, buyPrice:price, commission
});
const sell = (date, qty, price) => ({
  market:'SA', symbol:'TEST', sellDate:date, qty, sellPrice:price
});
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9,
  `expected ${expected}, received ${actual}`);

{
  const result = calculate({lots:[buy('2026-01-10', 10, 100)], sales:[]},
    {'SA:TEST':history(['2026-01-30',110], ['2026-02-26',121], ['2026-03-31',110])},
    {'SA:TEST':[]}, 3.75, '2026-03-31');
  assert.equal(result.points.length, 3);
  near(result.points[0].pct, 10);
  near(result.points[1].pct, 10);
  near(result.points[2].pct, (110/121-1)*100);
}

{
  const result = calculate({
    lots:[buy('2026-01-10',10,100), buy('2026-02-10',10,105,10)],
    sales:[sell('2026-02-15',5,115)]
  }, {'SA:TEST':history(['2026-01-30',110], ['2026-02-10',105], ['2026-02-26',121])},
  {'SA:TEST':[]}, 3.75, '2026-02-28');
  const february = result.points[1];
  near(february.basis, 5*110 + 10*106);
  near(february.amount, 15*121 - february.basis);
  near(february.pct, february.amount/february.basis*100);
}

{
  const result = calculate({lots:[buy('2026-01-10',10,100,10)],sales:[]},
    {'SA:TEST':history(['2026-01-10',50], ['2026-01-30',55], ['2026-02-26',60])},
    {'SA:TEST':[{date:'2026-01-20',ratio:2}]},3.75,'2026-02-28');
  near(result.points[0].basis, 1010);
  near(result.points[0].amount, 90);
  near(result.points[1].pct, (60/55-1)*100);
}

{
  const result = calculate({lots:[buy('2026-01-10',10,100)],sales:[]},
    {'SA:TEST':history(['2026-01-30',110])}, {'SA:TEST':[]},3.75,'2026-02-28');
  assert.equal(result.points[1].pct, null);
  assert.match(result.points[1].reason, /لا يتوفر سعر/);
}

{
  const result = calculate({lots:[buy('2026-01-10',10,100)],sales:[]},
    {'SA:TEST':history(['2026-01-30',110], ['2026-02-26',121],
      ['2026-03-31',121], ['2026-04-15',133.1])},
    {'SA:TEST':[]},3.75,'2026-04-15');
  assert.equal(result.points.at(-1).month, '2026-04');
  near(result.points.at(-1).pct, 10);
}

console.log('monthly unrealized calculation: 5 cases passed');
