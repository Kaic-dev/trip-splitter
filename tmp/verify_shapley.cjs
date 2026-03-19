// Verification script for Shapley Value Approximation
const iterations = 100;

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function computeRouteDistance(indices, matrix) {
  if (indices.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < indices.length - 1; i++) {
    total += matrix.distances[indices[i]][indices[i + 1]];
  }
  return total;
}

function computeShapley(passengers, matrix) {
  const contributions = {};
  passengers.forEach(p => contributions[p.id] = 0);

  const originIdx = 0;
  const destIdx = matrix.distances.length - 1;

  for (let iter = 0; iter < iterations; iter++) {
    const shuffled = shuffle(passengers);
    let currentCoalition = [originIdx];

    for (const p of shuffled) {
      const costWith = computeRouteDistance([...currentCoalition, p.mIdx, destIdx], matrix);
      const costWithout = computeRouteDistance([...currentCoalition, destIdx], matrix);
      
      const marginalContribution = Math.max(0, costWith - costWithout);
      contributions[p.id] += marginalContribution;
      currentCoalition.push(p.mIdx);
    }
  }

  Object.keys(contributions).forEach(id => {
    contributions[id] /= iterations;
  });
  return contributions;
}

// TEST SCENARIO
// Origin: 0, P1: 1, P2: 2, Dest: 3
// Distances:
// 0 -> 3: 10km (Direct)
// 0 -> 1 -> 3: 15km (P1 desvio 5km)
// 0 -> 2 -> 3: 15km (P2 desvio 5km)
// 0 -> 1 -> 2 -> 3: 16km (P1 e P2 juntos, desvio total 6km)

const matrix = {
  distances: [
    [0, 5000, 8000, 10000],   // From Origin
    [5000, 0, 1000, 10000],   // From P1 (P1 to P2 is very close)
    [8000, 1000, 0, 8000],    // From P2
    [10000, 10000, 8000, 0],  // From Dest
  ]
};

const passengers = [
  { id: 'P1', mIdx: 1 },
  { id: 'P2', mIdx: 2 }
];

console.log('--- Shapley Verification ---');
const results = computeShapley(passengers, matrix);
console.log('Contributions:', results);

// Expectation: P1 and P2 share the "shared" part of the detour.
// Total Route Cost (0-1-2-3): 16km
// Base Cost (0-3): 10km
// Detour: 6km
// Shapley should split this 6km fairly.

const totalShapley = results.P1 + results.P2;
console.log('Total Shapley Sum:', totalShapley);
const p1Percent = (results.P1 / totalShapley) * 100;
const p2Percent = (results.P2 / totalShapley) * 100;

console.log(`P1: ${p1Percent.toFixed(1)}%`);
console.log(`P2: ${p2Percent.toFixed(1)}%`);
