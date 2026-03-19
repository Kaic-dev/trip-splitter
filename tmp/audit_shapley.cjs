// Reproduction script for matrix index mismatch and split fairness
const matrix = {
  distances: [
    [0, 1000, 10000, 11000],  // Origin (0) to P1, P2, Dest
    [1000, 0, 10000, 10000],  // P1 to others
    [10000, 10000, 0, 1000],  // P2 to others (P2 is far)
    [11000, 10000, 1000, 0]   // Dest
  ]
};

// Mock passengers
const passengers = [
  { id: 'P1', name: 'On-Way', marginalImpactKm: 0.1 },
  { id: 'P2', name: 'Far-Out', marginalImpactKm: 10.0 }
];

// Logic in costEngine.ts (Slightly simplified for JS)
const breakdown = { totalCost: 100 };
const baseFuelCost = 10;
const totalParticipants = 3;
const shareBaseFuel = baseFuelCost / totalParticipants; // 3.33
const detourFuelCost = 90;

function computeRouteDistance(indices) {
    let total = 0;
    for (let i = 0; i < indices.length - 1; i++) {
      total += matrix.distances[indices[i]][indices[i + 1]];
    }
    return total;
}

function computeShapley() {
    const iterations = 20;
    const contributions = { P1: 0, P2: 0 };
    const mappings = [{id: 'P1', mIdx: 1}, {id: 'P2', mIdx: 2}];

    for (let i = 0; i < iterations; i++) {
        const shuffled = mappings.sort(() => Math.random() - 0.5);
        let coalition = [0];
        for (const p of shuffled) {
            const costWith = computeRouteDistance([...coalition, p.mIdx, 3]);
            const costWithout = computeRouteDistance([...coalition, 3]);
            contributions[p.id] += (costWith - costWithout);
            coalition.push(p.mIdx);
        }
    }
    contributions.P1 /= iterations;
    contributions.P2 /= iterations;
    return contributions;
}

const shapley = computeShapley();
console.log('Shapley Contributions:', shapley);

const totalShapley = shapley.P1 + shapley.P2;
const p1Detour = (shapley.P1 / totalShapley) * detourFuelCost;
const p2Detour = (shapley.P2 / totalShapley) * detourFuelCost;

console.log('P1 Total:', shareBaseFuel + p1Detour);
console.log('P2 Total:', shareBaseFuel + p2Detour);

// Verify if they are equal (The bug)
if (Math.abs(p1Detour - p2Detour) < 0.1) {
    console.log('BUG DETECTED: Payments are nearly equal despite distance difference.');
} else {
    console.log('SUCCESS: Payments are distinct and fair.');
}
