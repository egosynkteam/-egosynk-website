// HYDRO 150 launch content, taken from the label artwork (BRAND/3d/hydro-launch/label).
// The formula is a draft until the manufacturer's lab testing is done; the page says so.
export const HYDRO = {
  name: "HYDRO 150",
  flavour: "Salted Nimbu",
  netWeight: "420 g",
  servings: 30,
  scoop: "14 g",
  caffeine: 150,
  arms: [
    { key: "MIND", title: "Mind", line: "Caffeine + theanine", detail: "150 mg caffeine with 100 mg L-theanine: alert without the shakes.", stat: "150", unit: "mg caffeine" },
    { key: "MUSCLE", title: "Muscle", line: "Citrulline, beta-alanine", detail: "8 g citrulline malate 2:1 for pump, 1.6 g beta-alanine for the last reps.", stat: "8", unit: "g citrulline" },
    { key: "WATER", title: "Water", line: "Electrolytes", detail: "500 mg of sodium, potassium and magnesium, for training in Indian heat.", stat: "500", unit: "mg electrolytes" },
  ],
  actives: [
    ["Citrulline malate 2:1", "8 g"],
    ["= L-citrulline", "5.3 g"],
    ["Beta-alanine", "1.6 g"],
    ["Taurine", "1 g"],
    ["Caffeine anhydrous", "150 mg"],
    ["L-theanine", "100 mg"],
    ["Sodium", "300 mg"],
    ["Potassium", "150 mg"],
    ["Magnesium", "50 mg"],
  ] as const,
  ladder: [
    { mg: 0, label: "Kala Khatta · caffeine free", status: "Planned" },
    { mg: 150, label: "Salted Nimbu", status: "Launching first" },
    { mg: 200, label: "Salted Nimbu · stronger", status: "Planned" },
  ],
  use: [
    "Mix 1 scoop with 300 ml cold water.",
    "Drink 30 minutes before training.",
    "New to pre-workouts? Start with half a scoop.",
    "Keep drinking water while you train.",
  ],
  warning:
    "Not for medicinal use. Contains 150 mg caffeine per serving. Do not take within 6 hours of sleep or with other caffeine sources. Do not exceed 1 scoop a day. Not for children, pregnant or lactating women, or people sensitive to caffeine. Consult a doctor if you have a heart condition or high blood pressure, or take medication. Beta-alanine may cause a harmless tingling. For adults 18+.",
};
