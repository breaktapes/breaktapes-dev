const { loadSPA } = require('./spa-loader');

function totalsToObject(totals) {
  return Object.fromEntries((totals || []).map(total => [total.currency, total.amount]));
}

describe('race cost currency fields', () => {
  beforeAll(() => loadSPA({ races: [] }));

  beforeEach(() => {
    document.body.innerHTML += `
      <select id="rdCostRegCurrency"></select>
      <input id="rdCostReg" />
      <select id="rdCostFlightCurrency"></select>
      <input id="rdCostFlight" />
      <select id="rdCostHotelCurrency"></select>
      <input id="rdCostHotel" />
      <select id="rdCostGearCurrency"></select>
      <input id="rdCostGear" />
    `;
    global.initRaceCostCurrencySelects();
  });

  it('collects amount and currency for each race cost field', () => {
    document.getElementById('rdCostReg').value = '125';
    document.getElementById('rdCostRegCurrency').value = 'EUR';
    document.getElementById('rdCostFlight').value = '980';
    document.getElementById('rdCostFlightCurrency').value = 'ZAR';

    const costState = global.collectRaceCostFields();

    expect(costState.amounts.registrationCost).toBe(125);
    expect(costState.amounts.flightCost).toBe(980);
    expect(costState.amounts.hotelCost).toBe(0);
    expect(costState.costs.registrationCurrency).toBe('EUR');
    expect(costState.costs.flightCurrency).toBe('ZAR');
    expect(costState.costs.hotelCurrency).toBe('USD');
  });

  it('groups mixed currencies separately in the race cost tracker summary', () => {
    const summary = global.computeRaceCostTracker([
      {
        id: 1,
        date: '2026-04-01',
        registrationCost: 120,
        hotelCost: 900,
        costs: {
          registration: 120,
          registrationCurrency: 'USD',
          hotel: 900,
          hotelCurrency: 'ZAR',
        },
      },
      {
        id: 2,
        date: '2026-04-08',
        flightCost: 80,
        gearCost: 60,
        costs: {
          flight: 80,
          flightCurrency: 'USD',
          gear: 60,
          gearCurrency: 'EUR',
        },
      },
    ]);

    expect(totalsToObject(summary.total)).toEqual({ ZAR: 900, USD: 200, EUR: 60 });
    expect(totalsToObject(summary.avg)).toEqual({ ZAR: 450, USD: 100, EUR: 30 });
    expect(totalsToObject(summary.rows.find(row => row.name === 'Registration').totals)).toEqual({ USD: 120 });
    expect(totalsToObject(summary.rows.find(row => row.name === 'Travel + Hotel').totals)).toEqual({ ZAR: 900, USD: 80 });
    expect(totalsToObject(summary.rows.find(row => row.name === 'Gear').totals)).toEqual({ EUR: 60 });
  });
});
