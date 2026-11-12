// Trigger types (fixed by the game rules)
const TRIG = {
  crit:  { name: "Critical", icon: "★", desc: "+10000 power to one unit, +1 critical to one unit" },
  front: { name: "Front",    icon: "⚔", desc: "front row units +10000 power" },
  draw:  { name: "Draw",     icon: "✚", desc: "+10000 power to one unit, draw 1" },
  heal:  { name: "Heal",     icon: "♥", desc: "+10000 power to one unit, heal 1 if your damage ≥ opponent's" },
  over:  { name: "Over",     icon: "✦", desc: "draw 1, +100,000,000 power to one unit, removed from the game; on a drive check its own over-trigger text also works" },
  stand: { name: "Stand",    icon: "⟳", desc: "+power to one unit, stand one of your rear-guards (Premium only, older cards)" },
};
