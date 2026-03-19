// Verification script for Marginal Impact cost splitting
// mirrors the logic in costEngine.ts splitCost (SHARED mode)

function splitCost({ baseDistanceKm, totalDistanceKm, passengerDetourKms, kmPerLiter, fuelPrice, driverProfitPercent = 15 }) {
  const fuelCostTotal = (totalDistanceKm / kmPerLiter) * fuelPrice * (1 + driverProfitPercent / 100);
  const baseFuelRaw   = (baseDistanceKm / kmPerLiter) * fuelPrice;
  const totalCostRaw  = (totalDistanceKm / kmPerLiter) * fuelPrice;

  const passengerCount  = passengerDetourKms.length;
  const totalParticipants = passengerCount + 1; // driver

  const shareBaseFuel  = baseFuelRaw / totalParticipants;
  const detourFuelCost = Math.max(0, totalCostRaw - baseFuelRaw);

  const impacts = passengerDetourKms.map(p => ({ ...p, impact: Math.max(0, p.marginalImpactKm) }));
  const totalImpact = impacts.reduce((s, p) => s + p.impact, 0);

  console.log('Total Impact:', totalImpact.toFixed(3), '| Detour Fuel Cost:', detourFuelCost.toFixed(2));

  const results = impacts.map(p => {
    let detourFuel = 0;
    if (totalImpact > 0) {
      detourFuel = (p.impact / totalImpact) * detourFuelCost;
    } else if (detourFuelCost > 0 && passengerCount > 0) {
      detourFuel = detourFuelCost / passengerCount;
    }
    const fuel = shareBaseFuel + detourFuel;
    const payment = fuel * (1 + driverProfitPercent / 100);
    return { id: p.passengerId, impact: p.impact.toFixed(3), payment: payment.toFixed(2) };
  });

  const driverPayment = shareBaseFuel * (1 + driverProfitPercent / 100);
  results.push({ id: 'driver', impact: '0', payment: driverPayment.toFixed(2) });

  const total = results.reduce((s, r) => s + parseFloat(r.payment), 0);
  return { results, total };
}

const BASE = 20, TOTAL = 20, KML = 10, FUEL = 5;

console.log('\n--- CENÁRIO 1: passageiro no caminho (impact=0) vs fora do caminho (impact=3) ---');
const c1 = splitCost({
  baseDistanceKm: BASE, totalDistanceKm: TOTAL + 3, passengerDetourKms: [
    { passengerId: 'P-on-path', marginalImpactKm: 0 },
    { passengerId: 'P-offpath', marginalImpactKm: 3 }
  ], kmPerLiter: KML, fuelPrice: FUEL
});
console.log('Payments:', c1.results);
console.log('Sum:', c1.total.toFixed(2), '← must equal totalCost');
const onPath = c1.results.find(r => r.id === 'P-on-path');
const offPath = c1.results.find(r => r.id === 'P-offpath');
console.log(parseFloat(offPath.payment) > parseFloat(onPath.payment) ? 'PASS: off-path pays more ✓' : 'FAIL ✗');

console.log('\n--- CENÁRIO 2: dois passageiros com mesmo desvio → custo dividido igualmente ---');
const c2 = splitCost({
  baseDistanceKm: BASE, totalDistanceKm: TOTAL + 4, passengerDetourKms: [
    { passengerId: 'P1', marginalImpactKm: 2 },
    { passengerId: 'P2', marginalImpactKm: 2 }
  ], kmPerLiter: KML, fuelPrice: FUEL
});
console.log('Payments:', c2.results);
const p1 = parseFloat(c2.results.find(r => r.id === 'P1').payment);
const p2 = parseFloat(c2.results.find(r => r.id === 'P2').payment);
console.log(Math.abs(p1 - p2) < 0.01 ? 'PASS: equal payments ✓' : 'FAIL ✗');

console.log('\n--- CENÁRIO 3: impact total = 0 → detour dividido igualmente ---');
const c3 = splitCost({
  baseDistanceKm: 20, totalDistanceKm: 25, passengerDetourKms: [
    { passengerId: 'A', marginalImpactKm: 0 },
    { passengerId: 'B', marginalImpactKm: 0 }
  ], kmPerLiter: KML, fuelPrice: FUEL
});
const pA = parseFloat(c3.results.find(r => r.id === 'A').payment);
const pB = parseFloat(c3.results.find(r => r.id === 'B').payment);
console.log('Payments:', c3.results);
console.log(Math.abs(pA - pB) < 0.01 ? 'PASS: equal split when no impact ✓' : 'FAIL ✗');

console.log('\n--- CENÁRIO 4: suma total === totalCost ---');
const c4 = splitCost({
  baseDistanceKm: 30, totalDistanceKm: 40, passengerDetourKms: [
    { passengerId: 'X', marginalImpactKm: 5 },
    { passengerId: 'Y', marginalImpactKm: 2 },
    { passengerId: 'Z', marginalImpactKm: 0 }
  ], kmPerLiter: 12, fuelPrice: 6.5
});
const expectedTotal = (40 / 12) * 6.5 * 1.15;
console.log('Sum:', c4.total.toFixed(2), '| Expected:', expectedTotal.toFixed(2));
console.log(Math.abs(c4.total - expectedTotal) < 0.05 ? 'PASS: sum matches totalCost ✓' : 'FAIL ✗');
