// The story: eight jobs for Big Sal, Scrap, Tiff and Officer Dale, ending with the Sunset Tower job.
// A mission is plain data: who gives it, what they say, and a list of steps that story.js walks through.
//
// Steps (each may carry `text`, the objective line on the HUD, and `plus`, seconds added to the clock when it is done):
//   { go: [x, z], r, mode, stop, clean, y }     get to a ring. mode 'foot' | 'car'; stop: be slow; clean: no wanted stars; y: on a roof
//   { car: type, as, at: [x, z, heading], own }  a vehicle is put there for you; done once you are driving it (own: it is not theft)
//   { bring: as, to: [x, z], r, clean, take | park }   drive that vehicle into a ring and stop (take: it is driven away, park: you leave it)
//   { grab: [[x, z, y?], ...], r, mode, what, each(run, n) }   pick up everything in any order
//   { goons: [[x, z], ...], kind, opts }         gunmen; done when all are down
//   { flee: type, as, min, max, speed, crook }   a car that runs from you; done when you have rammed or shot it to a stop
//   { lose: true }                               shake the cops
//   { until: (run, dt, t) => true }              anything else
//   { say: [[who, line], ...] }                  people talk
//   { timer: seconds | null }, { wait: seconds }, { run: (run) => {} }
// A value may also be a function of the running mission (run), for places that are only known once it is under way.
import { JOBS, COMBAT } from '../config.js';

export function buildMissions(game) {
  const rooms = game.city.interiors.rooms, chop = game.jobs.chop, p = game.player, police = game.police, hud = game.hud;
  // a spot `out` metres in front of a walk-in building's door
  const door = (id, out = 1.6) => { const q = rooms.find(r => r.id === id); return { x: q.door.x + q.face[0] * out, z: q.door.z + q.face[1] * out, face: Math.atan2(q.face[0], q.face[1]) }; };
  const [csx, csz] = JOBS.chop.side;
  // where each of them waits with a job: the pavement outside the motel, the arcade and Sunset PD, and beside Scrap's shop
  // (x, z): the ring you step into. (bx, bz): where they stand, beside the door, facing the street (face).
  const wait = (id) => {
    const q = rooms.find(r => r.id === id), [fx, fz] = q.face, sx = -fz * 1.5, sz = fx * 1.5;
    return { x: q.door.x + fx * 2.1 + sx, z: q.door.z + fz * 2.1 + sz, bx: q.door.x + fx * .75 + sx, bz: q.door.z + fz * .75 + sz, face: Math.atan2(fx, fz), room: q };
  };
  const spots = { sal: wait('motel'), tiff: wait('arcade'), dale: wait('station') };
  { const x = chop.x - csx * 4.9 + csz * 5, z = chop.z - csz * 4.9 - csx * 5; spots.scrap = { x, z, bx: x - csx * 1.35, bz: z - csz * 1.35, face: Math.atan2(csx, csz), always: true }; }
  const motelKerb = door('motel', 4.8), towerDoor = door('tower', 1.8), roof = game.city.skyline?.sunset?.roof;
  const inCar = { until: () => p.mode === 'car', text: 'Get yourself a car' };
  const arm = (id, words) => ({ run: () => { game.combat.give(id); p.armor = COMBAT.armor; hud.toast(words, 'good'); } });
  // beside a stopped car, on whichever side is free
  const beside = (v) => {
    for (const [ox, oz] of [[-v.rx, -v.rz], [v.rx, v.rz], [-v.fx * 1.6, -v.fz * 1.6]]) {
      const x = v.x + ox * (v.halfWid + 1.6), z = v.z + oz * (v.halfWid + 1.6);
      if (game.physics.blocked(v.x, v.z, x, z) < 0) return [x, z];
    }
    return [v.x - v.rx * 2.6, v.z - v.rz * 2.6];
  };

  const missions = [
    // ------------------------------------------------------------------ 1
    {
      id: 'rent', title: "RENT'S DUE", giver: 'sal', brief: 'Fetch Big Sal\'s limo from the Promenade',
      intro: [
        ['sal', 'Rocco! Three weeks in my motel and all I got out of you is a towel bill.'],
        ['rocco', 'I\'m between fortunes, Sal.'],
        ['sal', 'Then work it off. Some valet took my limo for a joyride and left it at the Pizza Pier car park, down on the Promenade.'],
        ['sal', 'Bring her home. And kid: one scratch, and it comes out of your tail.'],
      ],
      steps: [
        { car: 'limo', as: 'limo', own: true, at: [-80, -199, 0], text: 'Find Big Sal\'s limo at the Pizza Pier car park, south of downtown' },
        { bring: 'limo', to: [motelKerb.x, motelKerb.z], r: 5, park: true, text: 'Drive the limo back to the motel' },
      ],
      outro: [
        ['sal', 'There she is. Not a... is that a dent? I\'m choosing not to look.'],
        ['sal', 'Here\'s your cut. Now go see Scrap at the chop shop. That bucket of bolts can always use a spare paw.'],
      ],
    },
    // ------------------------------------------------------------------ 2
    {
      id: 'parts', title: 'SPARE PARTS', giver: 'scrap', brief: 'Collect four crates from Port Sunset',
      intro: [
        ['scrap', 'BZZT. Raccoon unit. Sal says you are useful. Scrap will measure.'],
        ['scrap', 'Four crates of parts fell off a ship in Port Sunset. Fell. Yes.'],
        ['rocco', 'Fell. Sure.'],
        ['scrap', 'Collect all four before the dock crew counts again. Then bring them back here. Scrap pays cash.'],
      ],
      steps: [
        inCar, { timer: 170 },
        { grab: [[324, 81], [297, 0], [324, -108], [216, -162]], r: 4.5, what: 'CRATE', text: 'Grab the four crates in Port Sunset, east of downtown' },
        { go: [chop.x + csz * 12, chop.z - csx * 12], r: 4.5, stop: true, text: 'Take the crates back to Scrap: park in the green ring outside his shop' },
        { timer: null },
      ],
      outro: [
        ['scrap', 'Four crates. Counting again. Still four. Scrap is impressed. A little.'],
        ['scrap', 'Take this pistol. The docks are not friendly, and neither are possums. BZZT.'],
      ],
      reward: () => { game.combat.give('pistol'); },
    },
    // ------------------------------------------------------------------ 3
    {
      id: 'repo', title: 'REPO RACCOON', giver: 'sal', brief: 'Get Big Sal\'s cash back from the Possum Posse',
      intro: [
        ['sal', 'Rocco. The Possum Posse just walked out of my office with the week\'s take. In MY cash van.'],
        ['rocco', 'The who?'],
        ['sal', 'Possums. Matching jackets. No manners. They\'re still circling downtown like they own the place.'],
        ['sal', 'Run that van off the road and bring me what\'s inside.'],
      ],
      steps: [
        inCar,
        { flee: 'van', as: 'van', min: 80, max: 150, speed: 23, crook: 'possum', text: 'Ram the Posse\'s van until it stops' },
        { grab: (run) => [beside(run.refs.van)], r: 2.2, mode: 'foot', what: 'CASH BAG', text: 'Grab the cash bag from beside the van' },
        { go: [motelKerb.x, motelKerb.z], r: 5, text: 'Take the cash back to Big Sal at the motel' },
      ],
      outro: [
        ['sal', 'Every dollar. I counted twice, because I don\'t trust you yet.'],
        ['sal', 'The Posse won\'t like this. Good. Go see Tiff at the arcade. That kid has a plan with your name on it.'],
      ],
    },
    // ------------------------------------------------------------------ 4
    {
      id: 'signal', title: 'SIGNAL BOOST', giver: 'tiff', brief: 'Plant five boosters from downtown to Marlin Bay',
      intro: [
        ['tiff', 'You\'re Rocco? Sal said taller. Whatever. I\'m Tiff. I run the high scores here and, like, the entire plan.'],
        ['tiff', 'The Posse keeps its loot on top of Sunset Tower. I can crack their security, but my signal dies at the hills.'],
        ['tiff', 'So you\'re planting five boosters, from here to Marlin Bay, before my battery pack cooks itself.'],
        ['rocco', 'How long is that?'],
        ['tiff', 'Drive like you stole it. Which, knowing you...'],
      ],
      steps: [
        { ...inCar, text: 'Get something fast' }, { timer: 70 },
        { go: [54, 324], r: 9, plus: 35, text: 'Booster 1: the lookout at the top of Vista Heights' },
        { go: [162, 405], r: 9, plus: 35, text: 'Booster 2: Pelican Pass, the road over the hills' },
        { go: [81, 486], r: 9, plus: 35, text: 'Booster 3: Valley Avenue, outside Coral Plaza' },
        { go: [-81, 524], r: 9, plus: 50, text: 'Booster 4: the gates of Flamingo Park' },
        { go: [292, 585], r: 9, text: 'Booster 5: the quay at Marlin Bay' },
        { timer: null },
      ],
      outro: [
        ['tiff', 'Five bars! I can see every camera in that tower. Also a guard asleep in the lobby.'],
        ['tiff', 'Next problem: the vault wants a keycard, and the only spare is in a display case at Coral Plaza. Find me when you feel like shopping.'],
      ],
    },
    // ------------------------------------------------------------------ 5
    {
      id: 'mall', title: 'WINDOW SHOPPING', giver: 'tiff', brief: 'Smash and grab at Coral Plaza',
      intro: [
        ['tiff', 'Okay. Coral Plaza, the big mall up in the valley. Five display cases in the main hall, and one of them holds our keycard.'],
        ['rocco', 'Which one?'],
        ['tiff', 'Unclear! Grab all five. The glass at the entrance breaks if you hit it fast enough. I checked. With math.'],
        ['tiff', 'The alarm WILL go off. Lose the cops, then meet my cousin at the gates of Flamingo Park.'],
      ],
      steps: [
        { go: [81, 512], r: 9, text: 'Drive to Coral Plaza, in the valley north of the hills' },
        {
          grab: [[75, 589], [87, 598], [75, 613], [87, 622], [81, 631]], r: 2.4, what: 'DISPLAY CASE', text: 'Smash into the main hall and grab all five display cases',
          each: (run, n) => { if (n === 1) police.crime(70, 3, 'MALL ALARM!'); },
        },
        { lose: true, text: 'Lose the cops' },
        { go: [-81, 524], r: 7, clean: true, text: 'Meet Tiff\'s cousin at the gates of Flamingo Park' },
      ],
      outro: [
        ['tiff', 'Keycard! And four cases of... novelty spoons. Wow. Keeping those.'],
        ['tiff', 'One snag. Officer Dale has been asking about a raccoon in a red hoodie. Go talk to him before he talks to anyone else.'],
        ['tiff', 'He\'s at the Sunset PD front desk. Guarding the donuts.'],
      ],
    },
    // ------------------------------------------------------------------ 6
    {
      id: 'barn', title: 'BARN BURNER', giver: 'dale', brief: 'Clear the Possum Posse out of Golden Acres',
      intro: [
        ['dale', 'Well, well. The red hoodie. I got a file on you this thick. Mostly doodles, but still.'],
        ['rocco', 'What do you want, Dale?'],
        ['dale', 'The Possum Posse is making me look bad. They got a hideout at the old barn on Golden Acres, and a ledger with the night shifts at Sunset Tower.'],
        ['dale', 'Clear \'em out and the ledger is yours. I\'ll be busy not seeing nothing. Here: from the evidence locker. Don\'t ask whose.'],
      ],
      steps: [
        arm('smg', 'SMG AND BODY ARMOR'),
        { go: [-110, 812], r: 10, text: 'Drive to the old barn on Golden Acres, in the far north-west' },
        { goons: [[-121, 835], [-95, 837], [-91, 852], [-118, 856], [-103, 859], [-127, 863]], kind: 'possum', text: 'Take out the Possum Posse' },
        { grab: [[-106, 854]], r: 2.2, mode: 'foot', what: 'LEDGER', text: 'Pick up the ledger behind the barn' },
        { lose: true, text: 'Lose the cops' },
      ],
      outro: [
        ['dale', 'Barn\'s quiet. The paperwork says "gas leak". I love paperwork.'],
        ['dale', 'Now get outta here before I remember I\'m a cop. And tell Scrap his tail light is out.'],
      ],
    },
    // ------------------------------------------------------------------ 7
    {
      id: 'army', title: 'ARMY SURPLUS', giver: 'scrap', brief: 'Borrow a truck from Fort Pelican',
      intro: [
        ['scrap', 'Raccoon unit. Tiff\'s vault door is forty centimetres of steel. Scrap needs a drill. A big one.'],
        ['scrap', 'Fort Pelican has one, in a supply truck in the motor pool. The army will not lend it. Scrap asked.'],
        ['rocco', 'So I\'m stealing from the army.'],
        ['scrap', 'Borrowing. Loudly. Lose them, then bring the truck to the tin hangar on the Golden Acres airstrip.'],
      ],
      steps: [
        { car: 'truck', as: 'truck', at: [294.8, 735, Math.PI / 2], text: 'Steal the supply truck from the motor pool at Fort Pelican, in the far north-east' },
        { bring: 'truck', to: [-128, 890], r: 7, clean: true, take: true, text: () => police.stars > 0 ? 'Lose the army' : 'Drive the truck to the hangar on the Golden Acres airstrip' },
      ],
      outro: [
        ['scrap', 'One drill. Zero scratches that Scrap will mention. BZZT.'],
        ['scrap', 'Everything is ready. Big Sal wants the whole crew at the motel. Tonight we take the tower.'],
      ],
    },
    // ------------------------------------------------------------------ 8
    {
      id: 'tower', title: 'THE SUNSET TOWER JOB', giver: 'sal', brief: 'Empty the Posse\'s vault and get away',
      intro: [
        ['sal', 'This is it, kid. Tiff is in the cameras, Scrap\'s drill is on the roof, and Dale is "on break".'],
        ['sal', 'The Posse\'s vault sits on top of Sunset Tower. Ride the lift up, empty it, ride down.'],
        ['tiff', 'The second you touch the gold, every cop in town gets a text. Not from me. From the vault.'],
        ['sal', 'So you run. There\'s a boat waiting on the quay at Marlin Bay. Get the gold on it and we\'re legends.'],
        ['rocco', 'And if I don\'t make it?'],
        ['sal', 'Then I rent out your room.'],
      ],
      steps: [
        arm('burst', 'BURST RIFLE AND BODY ARMOR'),
        { go: [towerDoor.x, towerDoor.z], r: 2.4, mode: 'foot', clean: true, text: 'Walk into the Sunset Tower lobby, in the middle of downtown' },
        { until: () => roof && p.y > roof.y - 4, text: 'Take the lift to the roof: press E at the lift doors' },
        {
          grab: roof ? [[roof.x - roof.hw + 2.2, roof.z + roof.hd - 2.2, roof.y], [roof.x + roof.hw - 2.2, roof.z + roof.hd - 2.2, roof.y], [roof.x + roof.hw - 2.2, roof.z - roof.hd + 2.2, roof.y]] : [],
          r: 1.6, beam: false, mode: 'foot', what: 'GOLD', text: 'Empty the vault: three cases of gold on the roof',
          each: (run, n) => { if (n === 1) police.crime(90, 3, 'VAULT ALARM!'); },
        },
        { until: () => p.y < 40, text: 'Take the lift back down' },
        { go: [292, 585], r: 8, text: 'Get the gold to the boat on the quay at Marlin Bay, north over the hills' },
        { run: () => police.clear(false) },
      ],
      outro: [
        ['tiff', 'GO GO GO! ...okay, we\'re past the breakwater. You can breathe now.'],
        ['sal', 'Kid. You did it. The Posse is broke, the tower is ours, and my limo has one new dent I\'m not mentioning.'],
        ['scrap', 'Scrap calculates a four-way split. Scrap rounded in Scrap\'s favour.'],
        ['dale', 'I didn\'t see nothing. As usual.'],
        ['rocco', 'So... rent\'s covered?'],
        ['sal', 'Rent\'s covered. Welcome to Sunset Coast, Rocco.'],
      ],
    },
  ];
  return { missions, spots };
}
