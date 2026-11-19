// The game table (v6, 2026-11-19): no playmat picture. One player's half is a box of aspect 1150 : 415, laid out from the
// user's sketch: Order / Damage on the left, the six circles in a framed field, Trigger check + Energy generator on top right,
// Deck / Drop and Ride deck / G zone on the right. The opponent's half uses the same numbers mirrored (100 − x, 100 − y),
// so the field sits at the centre of the box and the two fields line up across the guardian circle.
// slots = circle centres [x, y]; boxes = [left, top, right, bottom], all in % of the half-table box.
const MAT_LAYOUT = {
  slots: { fl: [32.6, 27.7], vc: [50, 27.7], fr: [67.4, 27.7], bl: [32.6, 69.2], bc: [50, 69.2], br: [67.4, 69.2] },
  field: [23.0, 1.2, 77.0, 89.2],   // the frame around the six circles
  order: [11.3, 1.2, 22.6, 30.6],   // ORDER ZONE (set orders, Songs face down)
  damage: [11.3, 32.5, 22.6, 89.9], // DAMAGE ZONE: six sideways places stacked down the box
  dmgSlots: [0, 1, 2, 3, 4, 5].map((i) => [11 + i * 14.3, 11 + i * 14.3 + 27]), // [top, bottom] in % of the damage box; each card goes over the one before
  trigger: [77.4, 1.2, 88.3, 37.3], // TRIGGER CHECK ZONE (the card being checked)
  crest: [89.1, 1.2, 99.1, 15.7],   // crest zone: Energy Generator + energy
  ride: [89.1, 17.6, 99.1, 47.0],   // RIDE DECK
  deck: [77.4, 39.3, 87.0, 67.7],   // DECK
  gzone: [89.1, 48.9, 99.1, 90.4],  // G ZONE (Stride): face-down G deck + face-up G units
  drop: [77.4, 69.6, 87.0, 99.5],   // DROP ZONE
  plate: [0, 0, 10, 10],            // the player plate lives in the screen corner (position fixed); this box is unused
};
