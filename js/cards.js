// Trigger types (fixed by the game rules)
const TRIG = {
  crit:  { name: "Critical", icon: "★", desc: "+10000 power to one unit, +1 critical to one unit" },
  front: { name: "Front",    icon: "⚔", desc: "front row units +10000 power" },
  draw:  { name: "Draw",     icon: "✚", desc: "+10000 power to one unit, draw 1" },
  heal:  { name: "Heal",     icon: "♥", desc: "+10000 power to one unit, heal 1 if your damage ≥ opponent's" },
  over:  { name: "Over",     icon: "✦", desc: "+100,000,000 power to one unit, draw 1, removed from game" },
};

// Starter data, written into the database only the first time the game opens.
// Edit cards in editor.html instead of here.
function seedData() {
  const cards = [], decks = [];
  const make = (deckKey, nation, t) => {
    const ids = {};
    const add = (name, grade, power, shield, extra = {}) => {
      if (ids[name]) return ids[name];
      const id = `${deckKey}-${cards.length}`;
      cards.push({ id, name, grade, power, shield, crit: 1, type: extra.trigger ? "trigger" : "unit",
        trigger: null, sentinel: false, persona: false, nation, race: "", image: "", text: "", abilities: [], ...extra });
      ids[name] = id;
      return id;
    };
    const ride = [add(t.ride[0], 0, 6000, 10000), add(t.ride[1], 1, 8000, 5000), add(t.ride[2], 2, 10000, 5000),
      add(t.ride[3], 3, 13000, 0, { persona: true, abilities: t.g3abilities })];
    const main = [];
    const put = (n, id) => { for (let i = 0; i < n; i++) main.push(id); };
    put(4, add(t.trig.crit, 0, 5000, 15000, { trigger: "crit" }));
    put(4, add(t.trig.crit2, 0, 5000, 15000, { trigger: "crit" }));
    put(4, add(t.trig.heal, 0, 5000, 15000, { trigger: "heal" }));
    put(2, add(t.trig.draw, 0, 5000, 15000, { trigger: "draw" }));
    put(2, add(t.trig.front, 0, 5000, 15000, { trigger: "front" }));
    put(4, add(t.g1[0], 1, 8000, 5000, { abilities: t.g1abilities || [] }));
    put(4, add(t.g1[1], 1, 8000, 5000));
    put(2, add(t.g1[2], 1, 7000, 10000));
    put(4, add(t.sentinel, 1, 6000, 0, { sentinel: true }));
    put(4, add(t.g2[0], 2, 10000, 5000));
    put(4, add(t.g2[1], 2, 10000, 5000));
    put(3, add(t.g2[2], 2, 11000, 5000));
    put(3, ride[3]);
    put(4, add(t.g3[0], 3, 13000, 0));
    put(2, add(t.g3[1], 3, 13000, 0));
    decks.push({ id: "deck-" + deckKey, name: t.name, energy: !!t.energy, ride, main });
  };

  make("flame", "Flame Realm", {
    name: "Flame Dragons (sample)",
    ride: ["Ember Egg", "Sparkling Drakeling", "Wrathflame Dragon", "Dawnblaze Dragon Emperor"],
    trig: { crit: "Red Flame Imp", crit2: "Blaze Fang Pup", heal: "Healing Flame Imp", draw: "Sage Flame Imp", front: "Charging Flame Imp" },
    g1: ["Flametail Soldier", "Cinder Priest", "Stoneshield Dragon"],
    sentinel: "Firewall Guardian Dragon",
    g2: ["Hotblade Dragon Knight", "Flamewing Dragon", "Lava Spear Warrior"],
    g3: ["Volcano Dragon", "Ashen Dragon Queen"],
    g3abilities: [
      { kind: "AUTO", zone: "VC", when: "attack", once: "turn", conds: [{ type: "oppVcGrade", n: 3 }], costs: [{ type: "CB", n: 1 }],
        effects: [{ type: "retire", target: "chooseOppFrontRC", n: 1 }, { type: "power", amount: 10000, target: "self", dur: "battle" }] },
    ],
    g1abilities: [
      { kind: "AUTO", zone: "RC", when: "boost", conds: [{ type: "vcGrade", n: 3 }], costs: [{ type: "SB", n: 1 }],
        effects: [{ type: "draw", n: 1 }] },
    ],
  });
  make("star", "Star Kingdom", {
    name: "Starlight Knights (sample)", energy: true,
    ride: ["Starlight Foal", "Moonlight Squire", "Meteor Blade Knight", "Eternal Dawnstar King"],
    trig: { crit: "Red Star Fairy", crit2: "Shooting Star Cub", heal: "Dewdrop Fairy", draw: "Starscribe Fairy", front: "Warhorn Fairy" },
    g1: ["Dawn Archer", "Starlight Priest", "Crystal Shield Knight"],
    sentinel: "Lightveil Protector",
    g2: ["Moon Lance Knight", "Comet Cavalry", "Rainbow Swordsman"],
    g3: ["White Star Dragon", "Stellar Magus"],
    g3abilities: [
      { kind: "ACT", zone: "VC", once: "turn", conds: [], costs: [{ type: "EB", n: 3 }],
        effects: [{ type: "bind", target: "chooseOppRC", n: 1 }, { type: "search", from: "drop", n: 1, filter: { gmin: 2, gmax: 2, ctype: "unit" }, dest: "RC" }] },
      { kind: "AUTO", zone: "VC", when: "attack", once: "turn", conds: [], costs: [{ type: "CB", n: 1 }],
        effects: [{ type: "stand", target: "chooseMyRC", n: 1, filter: { gmin: 2, gmax: 2 } }] },
    ],
  });
  return { cards, decks };
}
