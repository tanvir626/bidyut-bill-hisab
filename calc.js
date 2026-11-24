(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BillCalc = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var RATES = {
    asOf: "৪ জুন ২০২৬",
    notice: "BERC 28.01.0000.012.04.003.26.2521 (৩ জুন ২০২৬) এবং সংশোধনী 28.01.0000.012.04.003.26.2569 (৪ জুন ২০২৬)",
    sourceUrl: "https://ocsms.desco.org.bd/publicinfo/electricityact",
    lifelineRate: 4.63,
    lifelineMax: 50,
    demandPerKw: 42,
    vatRate: 0.05,
    slabs: [
      { upTo: 75, rate: 5.26, label: "০–৭৫ ইউনিট" },
      { upTo: 200, rate: 8.5, label: "৭৬–২০০ ইউনিট" },
      { upTo: 300, rate: 9.1, label: "২০১–৩০০ ইউনিট" },
      { upTo: 400, rate: 9.62, label: "৩০১–৪০০ ইউনিট" },
      { upTo: 600, rate: 15.01, label: "৪০১–৬০০ ইউনিট" },
      { upTo: Infinity, rate: 17.35, label: "৬০০ ইউনিটের পর" }
    ]
  };

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function energyBreakdown(units, lifeline) {
    var lines = [];
    if (units < 0) {
      return { lines: lines, energy: 0, lifelineApplied: false, lifelineLost: false };
    }

    if (lifeline && units <= RATES.lifelineMax) {
      var lifelineAmount = roundMoney(units * RATES.lifelineRate);
      lines.push({
        label: "লাইফলাইন ০–৫০",
        units: roundMoney(units),
        rate: RATES.lifelineRate,
        amount: lifelineAmount
      });
      return { lines: lines, energy: lifelineAmount, lifelineApplied: true, lifelineLost: false };
    }

    var remaining = units;
    var cursor = 0;
    for (var i = 0; i < RATES.slabs.length && remaining > 0.0001; i++) {
      var slab = RATES.slabs[i];
      var width = slab.upTo === Infinity ? remaining : Math.min(remaining, slab.upTo - cursor);
      if (width > 0) {
        lines.push({
          label: slab.label,
          units: roundMoney(width),
          rate: slab.rate,
          amount: roundMoney(width * slab.rate)
        });
        remaining -= width;
        cursor = slab.upTo;
      }
    }

    var energy = roundMoney(lines.reduce(function (sum, line) { return sum + line.amount; }, 0));
    return {
      lines: lines,
      energy: energy,
      lifelineApplied: false,
      lifelineLost: !!(lifeline && units > RATES.lifelineMax)
    };
  }

  function unitsFromMoney(money, usedUnits, lifeline) {
    var left = roundMoney(Math.max(0, money));
    var used = Math.max(0, usedUnits || 0);
    if (left <= 0) return { units: 0, lines: [] };

    if (lifeline && used === 0 && left <= roundMoney(RATES.lifelineMax * RATES.lifelineRate)) {
      var lifelineUnits = roundMoney(left / RATES.lifelineRate);
      return {
        units: lifelineUnits,
        lines: [{ label: "লাইফলাইন ০–৫০", units: lifelineUnits, rate: RATES.lifelineRate, amount: left }]
      };
    }

    var lines = [];
    var bought = 0;
    var cursor = used;
    for (var i = 0; i < RATES.slabs.length && left > 0.001; i++) {
      var slab = RATES.slabs[i];
      if (cursor >= slab.upTo) continue;
      var room = slab.upTo === Infinity ? left / slab.rate : slab.upTo - cursor;
      var take = Math.min(room, left / slab.rate);
      if (take <= 0) continue;
      var spent = roundMoney(Math.min(left, take * slab.rate));
      take = roundMoney(spent / slab.rate);
      lines.push({ label: slab.label, units: take, rate: slab.rate, amount: spent });
      bought += take;
      left = roundMoney(left - spent);
      cursor += take;
    }

    return { units: roundMoney(bought), lines: lines };
  }

  function postpaid(input) {
    var units = Number(input.units) || 0;
    var loadKw = Number(input.loadKw) || 0;
    var meterRent = Number(input.meterRent) || 0;
    var energy = energyBreakdown(units, !!input.lifeline);
    var demand = roundMoney(Math.max(0, loadKw) * RATES.demandPerKw);
    var rent = roundMoney(Math.max(0, meterRent));
    var net = roundMoney(energy.energy + demand + rent);
    var vat = roundMoney(net * RATES.vatRate);
    return {
      lines: energy.lines,
      energy: energy.energy,
      demand: demand,
      meterRent: rent,
      net: net,
      vat: vat,
      total: roundMoney(net + vat),
      lifelineApplied: energy.lifelineApplied,
      lifelineLost: energy.lifelineLost
    };
  }

  function prepaid(input) {
    var recharge = Math.max(0, Number(input.recharge) || 0);
    var loadKw = Math.max(0, Number(input.loadKw) || 0);
    var meterRent = Math.max(0, Number(input.meterRent) || 0);
    var usedUnits = Math.max(0, Number(input.usedUnits) || 0);
    var firstOfMonth = !!input.firstOfMonth;
    var demand = firstOfMonth ? roundMoney(loadKw * RATES.demandPerKw) : 0;
    var rent = firstOfMonth ? roundMoney(meterRent) : 0;
    var vat = roundMoney(recharge * RATES.vatRate);
    var energyMoney = roundMoney(recharge - vat - demand - rent);
    var shortfall = energyMoney < 0 ? roundMoney(demand + rent + vat - recharge) : 0;
    var purchase = unitsFromMoney(energyMoney > 0 ? energyMoney : 0, firstOfMonth ? 0 : usedUnits, !!input.lifeline && firstOfMonth);
    return {
      recharge: roundMoney(recharge),
      vat: vat,
      demand: demand,
      meterRent: rent,
      energyMoney: energyMoney > 0 ? energyMoney : 0,
      shortfall: shortfall,
      units: purchase.units,
      lines: purchase.lines,
      firstOfMonth: firstOfMonth
    };
  }

  return {
    RATES: RATES,
    energyBreakdown: energyBreakdown,
    unitsFromMoney: unitsFromMoney,
    postpaid: postpaid,
    prepaid: prepaid
  };
});
