# FTA 6 · Flynn Theft Auto: Sunset Coast

A small open-world crime-city game that runs in the browser. You are Rocco the raccoon:
walk the streets, steal a car, and outrun the cops.

**Play:** open `index.html` from any static web server (or the GitHub Pages link for this repo).
There is no build step.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk, drive |
| Mouse | Look around (click the game to capture the mouse) |
| E | Steal a car / get out; buy at a counter; call the lift |
| Space | Handbrake (in a boat: hard astern) |
| Space / Shift | In a helicopter: up / down (let go and it hovers; W S fly forward and back, A D turn) |
| Shift | Sprint |
| Left click | Punch / shoot (hold for the SMG) |
| Right click (hold) | Aim down the gun's own sights; the sniper looks through its scope (mouse wheel: 4× / 8×) |
| [ and ] | Mouse sensitivity down / up (remembered) |
| 1 to 6 / mouse wheel | Fists, pistol, SMG, shotgun, burst rifle, sniper |
| R | Reload |
| H | Horn |
| T | Skip to night / day |
| Q | Graphics: high / fast |
| Tab (hold) | The map of Sunset Coast: everything there is to do and how much of it you've done |
| X (hold) | Quit the race or job you're in |
| C (hold) | Cops vs Robbers, as a cop: cuff the robber standing next to you |
| M | Mute |
| F11 | Full screen (also on the title and pause menus) |
| Esc | Pause |

## How the game works

- **The cast.** Three families share the streets: Critters (raccoons, possums, pigeon cops), Tin Bots, and Big Heads, goofy humans
  with giant heads and loud outfits. Every Big Head is rolled from skin tones, head shapes, hair, hats, eyewear, mustaches and
  clothes, so no two match. Big Sal runs the motel, Tiff minds the arcade and Officer Dale sits at the police desk. Their heads
  bobble when they run and snap back when they are hit, and that head is a bigger target for a headshot (they are a little tougher to make up for it).
  How big the heads are is one number, `CAST.bigHead` in `src/config.js`.
- **Play as.** The title and pause menus let you be Rocco, Big Sal, Tiff or a freshly rolled Big Head (click Random again for another).
  The swap happens on the spot and keeps your guns and cash; the choice is remembered.
- **Driving.** Steering alone never breaks the tyres loose: the car turns as tight as its grip allows at that speed and no tighter. Hold the handbrake and steer to swing the tail round; let go and the tyres bite again within half a second, keeping most of the speed.
- **Aiming.** Hold right mouse and you look through Rocco's eyes, down the sights of the gun in his hands: the pistol's notch and post (with night-sight dots), the SMG's red dot, the bead on the shotgun's rib and the burst rifle's optic. Shots go where the sights point, which is always the middle of the screen. The gun kicks, its slide or pump cycles, and it trails the hand a little when you turn. The aim lands on whoever is nearly dead ahead when the gun comes up, and a lit aiming mark brightens over someone you can hit. The sniper keeps its full scope.
- **Steal a car.** Parked cars may set off an alarm. Taking one with a driver in it always gets you a star.
- **Stars.** More trouble means more stars, and more (and angrier) cruisers. Officers jump out if you stop.
- **Lose them.** Break line of sight until the stars stop flashing. You get paid for every chase you escape.
- **Weapons.** Guns lie on the sidewalks, and in a few places in the valley, (yellow dots on the radar), with body armor (blue) and first-aid kits (green). They come back a minute after you take them. Knocked-out cops drop ammo.
- **Fighting.** Hitting or shooting people raises your stars if a cop sees it; hurting a cop always does. From two stars, officers on foot draw pistols and shoot back. Armor soaks damage before health.
- **Vehicles.** Sedans, taxis, vans, box trucks, stretch limos, the Flamingo GT sports car and motorbikes all drive differently: trucks are slow and heavy and shove traffic aside, the sports car and the bike are quick, and a hard crash throws you off the bike. A bike and a sports car are parked next to where you start.
- **Crash damage.** Every knock leaves its mark where it landed, on your car and on whatever you hit: the body is pressed in (deeper and wider the harder the hit), paint is scraped dull and then down to bare metal, glass cracks and then falls out, lamps go dark (smashed headlights light the road less), a battered nose loses its bumper and the radiator starts to steam. Traffic, parked cars and cruisers dent the same way. Tune it in `DAMAGE` in `src/config.js`.
- **Chop-shop orders.** Scrap pages you with a car he wants and it shows up pink on the radar with an arrow over it. Steal it, lose any stars, and park it on the pink marker outside Scrap's Chop Shop. Less damage means more cash. Rare cars (the sports car and the limo) pay the most, and every third order is a police cruiser. Any other stolen car parked there is sold for scrap.
- **Taxi fares.** Sit in a taxi and someone hails you (gold on the radar). Stop next to them, then stop on the gold marker at their destination. A quick, smooth ride earns a tip; fares in a row pay more. Passengers bail if you pick up stars.
- **The map.** Downtown sits in the middle of a much bigger place: Palm Promenade, the beach and the pier to the south, the steep streets of Vista Heights to the north, Port Sunset's docks to one side and the Dustlands desert to the other. Cars follow the hills, get air over crests and ramps, and stall if you drive them into the sea. Hold Tab for the map.
- **The valley.** Four roads climb north through the hills behind Vista Heights and drop into a second town, about as big as everything south of it:
  - **Palmview**: a neighborhood of houses with driveways, picket fences, pools and parked cars.
  - **Flamingo Park**: a big city park with a promenade, a pond with flamingos and a dock, a bandstand, a fountain plaza and lawns. All of it is open ground, so you can drive anywhere in it.
  - **Coral Plaza**: a mall with a car park, open-air shops round a plaza, and an indoor hall with a glass roof, a department store and a food court. Walk in through the doorways, or drive through the glass and down the concourse.
  - **Marlin Bay**: a marina with four piers of moored boats, a fuel dock, a seaplane dock, a slipway, a yacht club and a helipad on the bluff. The big boats are scenery; the speedboats and jet skis tied up in the free berths are yours to take (see Boats and helicopters).
  - **Golden Acres**: farmland. A drive-through barn, silos, a wind pump, a greenhouse, cows in a paddock, corn, wheat, an orchard, a pumpkin patch, a hay field, an old barn and a dirt airstrip with a hangar.
  - **Fort Pelican**: a fenced military base with a guarded gate, barracks, headquarters, a motor pool (the trucks can be taken), a firing range, a runway, three open hangars, a control tower and two helipads. Being inside earns three stars after a few seconds.
- **Things that break.** In the valley, shop windows shatter when shot, punched or driven into. The tall glass of the mall's entrances, the department store and the food court gives way to a car at speed, and so do the base's gate booms. Picket and rail fences, cafe tables, kiosks, clothes racks, planters, hay bales, crates and cones all break under a car. Everything is put back once you are far away.
- **Gun shops** (orange G on the radar). Bullseye Guns is across the street from where you start, and there is a second one on the strip behind Coral Plaza. Walk up to a gun on the counter and press E to buy it, or buy ammo if you already own it. They sell body armor too.
- **The Sunset Loop and Highway 6.** An elevated highway rings downtown, two lanes each way, with fast traffic on it. Ramps go up from the south and east sides of the ring road (the on-ramp is just past the middle crossing, the exit just before it), and Highway 6 runs west off the Loop and comes down onto the desert road. Streets carry on underneath. Cruisers chase you up the ramps and new ones join on the highway itself.
- **The skyline.** Thirteen towers stand in the middle of downtown, up to the 148 m Sunset Tower. Their windows and rooftop neon come on at dusk.
- **Walk-in buildings** (white dots on the radar). Twelve places have an open door: the 24/7 Mart by the start, four diners, Pawsum's Pawn, the arcade, the motel, the laundromat, Sunset General, Sunset PD and the Sunset Tower lobby. Press E at the counter: food heals, the pawn shop sells armor and ammo, the motel lets you sleep until dusk or dawn, the laundromat changes your look (drops your stars if no cop is watching), the police desk takes a bribe, the hospital patches you up. Hold a gun on whoever is behind a shop counter for a couple of seconds to empty the till (two stars). The lift in the Sunset Tower goes to the roof, unless you are wanted. Prices and hold-up numbers are in `INDOORS` in `src/config.js`.
- **Races** (blue R on the radar). Stop in the blue ring, wait for GO, hit every gold gate. Six time trials, one of them on foot along the boardwalk, with gold, silver and bronze times.
- **Stunt jumps** (orange J). Fourteen ramps and crests, three of them in the valley (over the park promenade into the pond, off the hay ramp at the farm, and over the fence into Fort Pelican). Leave the ground there and fly far enough to tick it off; land the pier jump on the barge for a bonus. Any long jump pays a little.
- **Golden tins.** Forty of them hidden around the map. They show on the radar only when you are close.
- **Pizza run** (orange P, outside Pizza Pier). Four deliveries against the clock; faster drops tip better and four hot pies pay a bonus.
- **Speed cameras** (white S). Pass one above its limit and it pays for every km/h over.
- **Car bowling** (red B, in the port). One run-up at ten giant pins.
- **Bounty hunts** (blue W, in the kerb lane outside Sunset PD). Stop a car in the ring and Officer Dale radios in a wanted driver,
  marked with an arrow. Ram the car (or shoot it) until the driver gives up; each catch pays more than the last and puts 50 seconds
  back on the clock. The shift ends when the clock runs out or one gets away. Ramming a wanted car is never a crime.
- **Demolition derby** (purple D, the west paddock at Golden Acres). Three rivals come at you inside the ring; wreck them all
  before they wreck you. Each win adds a rival next time, up to six. More than six seconds outside the ring or out of your car and you are out.
- **Smash spree** (green M, Coral Plaza car park). The mall is put back together, then you have a minute to break as much of it
  as you can; glass pays best, and the alarm goes off after a dozen. Medals at 15, 30 and 45.
- **Gun range** (yellow T, the field east of the old barn at Golden Acres). On foot: 45 seconds of pop-up targets at 15, 25 and
  38 m. The range lends you a pistol if you have no gun, and nobody reports shots while the clock runs. Medals at 8, 15 and 22 hits.
- **Spray 'n' Scram** (mint C, two blocks south-west of the start). Stop a car in the ring: for $250 it is repaired and repainted,
  and if no cop can see you go in, your stars are gone.
- **Story mode.** The title screen offers **Story mode** beside **Free roam** (and the pause menu can switch it on or off). Eight
  jobs for Big Sal, Scrap, Tiff and Officer Dale, each started by stepping into the green ring beside whoever has work (green pin
  on the radar): fetch Sal's limo, a timed parts run round the port, run a van off the road, a checkpoint dash up to the lookout
  and the valley, a smash-and-grab at Coral Plaza, a shoot-out with the Possum Posse at the old barn, an army truck out of Fort
  Pelican, and the Sunset Tower job. People talk in a box at the bottom of the screen (E for the next line, Enter to skip the lot).
  Fail and you can hold Y to try again from the start of the job; hold X to give one up. Free roam's activities stay open between jobs.
  In story mode you are always Rocco.
- **Your cash and guns are saved** in the browser between sessions, in both modes, along with story progress. "Start over" on
  the title screen wipes them.
- **Wasted** (out of health) bills you and wakes you outside Sunset General (red cross on the radar). You keep your guns.
- **Nabbed** fines you and lets you out of Sunset PD (blue badge). The cops keep your guns.

## Boats and helicopters

Both are ordinary vehicles: walk up, press E, and the same damage, theft and multiplayer rules apply as for a car.

- **Boats** (speedboat, jet ski, police boat) wait in the free berths at Marlin Bay, off the end of the beach pier and along
  Port Sunset's quay. W/S throttle, A/D helm, Space hard astern. A beach slows a boat and slides it back; a quay wall or a
  pier is a crash. A wrecked boat burns, then sinks. You can sail about 200 m past the edge of the map before the sea turns you back.
- **Helicopters** (Dragonfly, police chopper, army Pelican) sit on the pads: Marlin Bay's bluff, Fort Pelican's two, and two
  painted on the port quay. The rotor takes three seconds to spin up; then Space lifts off. It hovers by itself, flares
  before it touches down, and can land on any roof (you can't get out up there: no stairs). Flying into a building hurts;
  ditching in the sea or losing the engine wrecks it.
- **The law**: stealing a police boat or chopper, or anything of the army's, puts stars on you at once. From three stars
  (two if you are afloat or in the air) a police helicopter circles over you; while it can see you the cops never lose you,
  so get under a bridge or indoors, or shoot it down. At night it carries a searchlight. On the water, patrol boats come
  after you and bust you if you stop. Cruisers wait at the nearest street until you come ashore.
- Each craft has a home slot (`src/vehicles/fleet.js`) and comes back there once it is stolen, wrecked or lost and you are far away.

## Playing together

**Switched off for now** (`NET.enabled` in `src/config.js`): the menu is hidden and the game connects to nothing. It comes back
once the relay in `relay/` runs on Cloudflare and its address is in `NET.relay`. `?mp` in the address switches it on for one page.
The rest of this section describes how it works when it is on.

The title menu has a name, a room code and **Join room**. Everyone who joins the same code is in the same city: you see each
other walk, drive and shoot, and you can hurt each other. Each player's own game stays in charge of their own body, their own
cars and their own health, and tells the others about them 20 times a second; the others play that back a moment (0.11 s) later.
A car belongs to whoever drove it last. Street traffic, pedestrians and the AI police are not shared yet: every screen has its own.

How the players reach each other (`src/net/transport.js`):

- **relay**: a small server on Cloudflare passes everything along (`relay/`, with its own README for setting it up). Nobody's
  computer hosts: each player sends only their own snapshots and receives the others'. This is the normal way, used whenever
  `NET.relay` holds the relay's address. If the line drops, the game rejoins the room by itself.
- **room**: the live room of a Claude page, when the game is published as one with the `room` capability (topic `ev` open to
  everyone it is shared with). Used when the relay cannot be reached from that page.
- **tabs**: windows of one browser on one computer (`?tabs` forces it). For trying multiplayer alone, and the last fallback.
- **direct**: browser to browser (WebRTC, through the vendored PeerJS), with the first player in a room hosting it and passing
  everything along. That costs the host's computer and connection, so it is only used when the address asks for it
  (`?direct`, or `?peer=host:port` for a PeerJS server of your own).

### Cops vs Robbers

With two or more players in a room, the pause menu (Esc) shows two sides, CRITTERS and TIN BOTS. Pick one (anyone who does not
is put on the smaller side), and the host picks 4, 6 or 10 minute halves and starts the match.

- Two halves. CRITTERS rob first while TIN BOTS police; at half time the sides swap.
- **Robbers** earn by mugging people, driving through things that break, holding up stores (the big one: the cops hear the alarm
  and see where), selling Scrap his cars and anything else that pays. That money is only *carried*. It counts once you stand in
  a green stash ring ($ on the radar) for 3 seconds.
- Carrying $3,000 or more makes a robber **hot**: the cops see them on the radar wherever they are. Otherwise cops see robbers
  within 90 m, and robbers see cops within 160 m.
- **Cops** start at Sunset PD with a pistol, a shotgun and a cruiser (the blue C on the radar). They bust a robber by taking
  their health to zero, or by holding C next to one who is on foot for 1.5 seconds.
- A busted robber loses everything they carry, and the cops' team *recovers* it. Robbers are back after 8 seconds at a safehouse
  far from the cops, cops after 12 seconds at the station; both get 5 seconds in which they cannot be hurt.
- No friendly fire. The AI police stay out of it.
- **Winning:** the team that stashed more over its half as robbers. Recovered money breaks a tie.

The host's game keeps the clock, the sides and the score; every player's own game decides what happens to that player. All the
numbers are in `MATCH` in `src/config.js`.

## Code layout

Each system lives in its own small file, so a change usually touches one place.

```
index.html, css/style.css   page, HUD markup and styling (css/activities.css: activity panel, banner, big map; css/story.css:
                            the story buttons and the talking box)
src/main.js                 boot, game loop, and the rules that connect systems (what is a crime, crashes)
src/config.js               every tunable number: car handling (CAR), aiming (AIM), weapons, police, traffic, day length,
                            hills and jumps (RIDE), activity pay and medal rules (ACTIVITIES), story pay and gunmen (STORY), what it takes to break things
                            (SMASH), the base's alarm (BASE), gun shop prices (INDOORS.guns)
src/core/                   engine (renderer + post), physics (Rapier), input, audio (synthesised), utils
src/world/                  city (the downtown scene), materials, sky (day/night), batching, landmarks (hospital, police station),
                            map (the whole coast as data: heights, land types, roads), terrain (height of the ground anywhere),
                            ground (builds the land and roads), districts + props (everything outside downtown),
                            ride (cars on slopes, jumps, water), roads (road lookups), world (ties the land to the game),
                            highway (the Sunset Loop, Highway 6 and their ramps: routes, lanes, decks, piers, signs),
                            skyline (downtown's towers), interiors (the buildings you can walk into and what you can do there),
                            north (the valley: its land, the shared building kit, and the order its districts are built in),
                            park, mall, marina, farm, base (one file per valley district; Palmview is in north),
                            places (things that break: glass, fences, props, gate booms; the base's alarm; roofs the camera stays under)
src/activities/             activities (start rings, one-at-a-time), kit (markers, panel, banner, save), races, stunts, tins,
                            pizza, traps (speed cameras), bowling, bounty, derby, spree (the mall), range, spray, bigmap (hold Tab)
src/story/                  story (the mission runner: start rings, the people who give jobs, steps, pass/fail/retry, the menu
                            buttons), missions (the eight jobs as data: read its header for the step vocabulary), dialogue (the
                            talking box and who can speak), gunmen (armed goons), wallet (cash and guns saved between sessions)
src/vehicles/               damage (dents, scuffs, cracked glass, dead lamps, torn-off bumpers: see the notes at its top),
                            vehicle (handling, rider seat), carModel (stand-in shapes + the wheel batch), vehicleModels (loads the
                            Blender models from assets/vehicles/ and swaps them in), aiDriver (traffic + pursuit), traffic,
                            highwayTraffic (drivers and cruisers on the elevated roads),
                            boats (how a boat moves, its wake), helis (how a helicopter flies, lands and crashes), fleet (where
                            boats and helicopters are kept and put back), craftModels + loft (their models, built in code)
src/characters/             rig (the body everyone shares), models (Critters + Tin Bots, who walks the streets, the walk cycle),
                            bigheads (the Big Head builder: heads, hair, hats, faces, clothes), bigheadLooks (what a Big Head can
                            look like: the named three and the dice for everyone else), pedestrians
src/player/                 player (on foot, in/out of cars), camera
src/police/                 police (stars, cruisers, officers on foot), airSea (the police helicopter, its searchlight, patrol boats)
src/missions/               jobs (chop-shop orders, taxi fares, their markers and radar blips), outlaws (crooks' cars: runaways
                            you run down, rivals that come after you; used by the story, the bounty hunts and the derby)
src/combat/                 combat (Rocco's weapons, aim, punch), hits (damage rules), copGuns (cops shoot back),
                            pickups, gunfx (tracers, muzzle flash), weaponModels (loads assets/weapons/*.gltf.json),
                            sightView (the gun seen down its sights: each model's sight line, paws, recoil and sway)
assets/weapons/             Flynn's guns as self-contained glTF (.gltf.json), converted from GrappleStrikeGuns.fbx
assets/vehicles/            the eight vehicles built in Blender (.gltf.json) + their shared texture atlas (atlas_*.png).
                            Sources, .blend files and .glb copies: /mnt/project-files/models/vehicles/
src/ui/                     hud, weaponHud (ammo, armor, crosshair, scope), minimap, whoPicker ("Play as" on the menus),
                            lobby (name, room code and player list for playing together)
src/net/                    net (my snapshots out, everyone else's in, shots and hits between players), transport (room,
                            direct, tabs: three ways to carry the same messages), remote (another player on this screen),
                            ghostCar (another player's car on this screen), match (Cops vs Robbers: the rules, the bar at the
                            top, the lobby on the pause menu, the final score)
src/fx/                     effects (tyre marks, smoke, sparks), carLights, debris (shards and torn-off parts), wake (foam on the sea)
dev/damage-lab.html         a bench for the crash damage: vehicles on a plain floor, dented from the console (not part of the game)
dev/craft-lab.html          a bench for the boats and helicopters, e.g. ?types=heli,speedboat&sea&rider=raccoon
dev/cast-lab.html           a bench for the characters: a line-up of any cast members, e.g. ?kinds=sal,dale,tiff,bighead*9
vendor/                     three.js r160, Rapier 2D and PeerJS 1.5.5, vendored so the game needs no build and no CDN
```

Tuning the feel of the game almost always means editing `src/config.js`.

Add `?test` to the URL to stop the game loop and drive frames by hand from the console
(`__fta.advance(1/60)`), which is how the automated playtests run. `?test&room=CODE&name=Ann&auto&tabs` also joins a room
straight away, so two pages in one browser can play each other; a test moves both forward a few frames at a time.

## Credits

Built with [three.js](https://threejs.org) (MIT), [Rapier](https://rapier.rs) (Apache-2.0) and [PeerJS](https://peerjs.com) (MIT).
All art, sound and code are original to this project. The weapon models are Flynn's own.
