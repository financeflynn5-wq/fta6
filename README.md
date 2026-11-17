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
| Space | Handbrake |
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
| M | Mute |
| F11 | Full screen (also on the title and pause menus) |
| Esc | Pause |

## How the game works

- **The cast.** Three families share the streets: Critters (raccoons, possums, pigeon cops), Tin Bots, and Big Heads, goofy humans
  with giant heads and loud outfits. Every Big Head is rolled from skin tones, head shapes, hair, hats, eyewear, mustaches and
  clothes, so no two match. Big Sal runs the motel, Tiff minds the arcade and Officer Dale sits at the police desk. Their heads
  bobble when they run and snap back when they are hit, and that head is a much bigger target for a headshot (they are a little tougher to make up for it).
- **Play as.** The title and pause menus let you be Rocco, Big Sal, Tiff or a freshly rolled Big Head (click Random again for another).
  The swap happens on the spot and keeps your guns and cash; the choice is remembered.
- **Driving.** Steering alone never breaks the tyres loose: the car turns as tight as its grip allows at that speed and no tighter. Hold the handbrake and steer to swing the tail round; let go and the tyres bite again within half a second, keeping most of the speed.
- **Aiming.** Hold right mouse and you look through Rocco's eyes, down the sights of the gun in his hands: the pistol's notch and post (with night-sight dots), the SMG's red dot, the bead on the shotgun's rib and the burst rifle's optic. Shots go where the sights point, which is always the middle of the screen. The gun kicks, its slide or pump cycles, and it trails the hand a little when you turn. The aim lands on whoever is nearly dead ahead when the gun comes up, and a lit aiming mark brightens over someone you can hit. The sniper keeps its full scope.
- **Steal a car.** Parked cars may set off an alarm. Taking one with a driver in it always gets you a star.
- **Stars.** More trouble means more stars, and more (and angrier) cruisers. Officers jump out if you stop.
- **Lose them.** Break line of sight until the stars stop flashing. You get paid for every chase you escape.
- **Weapons.** Guns lie on the sidewalks (yellow dots on the radar), with body armor (blue) and first-aid kits (green). They come back a minute after you take them. Knocked-out cops drop ammo.
- **Fighting.** Hitting or shooting people raises your stars if a cop sees it; hurting a cop always does. From two stars, officers on foot draw pistols and shoot back. Armor soaks damage before health.
- **Vehicles.** Sedans, taxis, vans, box trucks, stretch limos, the Flamingo GT sports car and motorbikes all drive differently: trucks are slow and heavy and shove traffic aside, the sports car and the bike are quick, and a hard crash throws you off the bike. A bike and a sports car are parked next to where you start.
- **Crash damage.** Every knock leaves its mark where it landed, on your car and on whatever you hit: the body is pressed in (deeper and wider the harder the hit), paint is scraped dull and then down to bare metal, glass cracks and then falls out, lamps go dark (smashed headlights light the road less), a battered nose loses its bumper and the radiator starts to steam. Traffic, parked cars and cruisers dent the same way. Tune it in `DAMAGE` in `src/config.js`.
- **Chop-shop orders.** Scrap pages you with a car he wants and it shows up pink on the radar with an arrow over it. Steal it, lose any stars, and park it on the pink marker outside Scrap's Chop Shop. Less damage means more cash. Rare cars (the sports car and the limo) pay the most, and every third order is a police cruiser. Any other stolen car parked there is sold for scrap.
- **Taxi fares.** Sit in a taxi and someone hails you (gold on the radar). Stop next to them, then stop on the gold marker at their destination. A quick, smooth ride earns a tip; fares in a row pay more. Passengers bail if you pick up stars.
- **The map.** Downtown sits in the middle of a much bigger place: Palm Promenade, the beach and the pier to the south, the steep streets of Vista Heights to the north, Port Sunset's docks to one side and the Dustlands desert to the other. Cars follow the hills, get air over crests and ramps, and stall if you drive them into the sea. Hold Tab for the map.
- **The Sunset Loop and Highway 6.** An elevated highway rings downtown, two lanes each way, with fast traffic on it. Ramps go up from the south and east sides of the ring road (the on-ramp is just past the middle crossing, the exit just before it), and Highway 6 runs west off the Loop and comes down onto the desert road. Streets carry on underneath. Cruisers chase you up the ramps and new ones join on the highway itself.
- **The skyline.** Thirteen towers stand in the middle of downtown, up to the 148 m Sunset Tower. Their windows and rooftop neon come on at dusk.
- **Walk-in buildings** (white dots on the radar). Twelve places have an open door: the 24/7 Mart by the start, four diners, Pawsum's Pawn, the arcade, the motel, the laundromat, Sunset General, Sunset PD and the Sunset Tower lobby. Press E at the counter: food heals, the pawn shop sells armor and ammo, the motel lets you sleep until dusk or dawn, the laundromat changes your look (drops your stars if no cop is watching), the police desk takes a bribe, the hospital patches you up. Hold a gun on whoever is behind a shop counter for a couple of seconds to empty the till (two stars). The lift in the Sunset Tower goes to the roof, unless you are wanted. Prices and hold-up numbers are in `INDOORS` in `src/config.js`.
- **Races** (blue R on the radar). Stop in the blue ring, wait for GO, hit every gold gate. Six time trials, one of them on foot along the boardwalk, with gold, silver and bronze times.
- **Stunt jumps** (orange J). Eleven ramps and crests. Leave the ground there and fly far enough to tick it off; land the pier jump on the barge for a bonus. Any long jump pays a little.
- **Golden tins.** Forty of them hidden around the map. They show on the radar only when you are close.
- **Pizza run** (orange P, outside Pizza Pier). Four deliveries against the clock; faster drops tip better and four hot pies pay a bonus.
- **Speed cameras** (white S). Pass one above its limit and it pays for every km/h over.
- **Car bowling** (red B, in the port). One run-up at ten giant pins.
- **Wasted** (out of health) bills you and wakes you outside Sunset General (red cross on the radar). You keep your guns.
- **Nabbed** fines you and lets you out of Sunset PD (blue badge). The cops keep your guns.

## Code layout

Each system lives in its own small file, so a change usually touches one place.

```
index.html, css/style.css   page, HUD markup and styling (css/activities.css: activity panel, banner, big map)
src/main.js                 boot, game loop, and the rules that connect systems (what is a crime, crashes)
src/config.js               every tunable number: car handling (CAR), aiming (AIM), weapons, police, traffic, day length,
                            hills and jumps (RIDE), activity pay and medal rules (ACTIVITIES)
src/core/                   engine (renderer + post), physics (Rapier), input, audio (synthesised), utils
src/world/                  city (the downtown scene), materials, sky (day/night), batching, landmarks (hospital, police station),
                            map (the whole coast as data: heights, land types, roads), terrain (height of the ground anywhere),
                            ground (builds the land and roads), districts + props (everything outside downtown),
                            ride (cars on slopes, jumps, water), roads (road lookups), world (ties the land to the game),
                            highway (the Sunset Loop, Highway 6 and their ramps: routes, lanes, decks, piers, signs),
                            skyline (downtown's towers), interiors (the buildings you can walk into and what you can do there)
src/activities/             activities (start rings, one-at-a-time), kit (markers, panel, banner, save), races, stunts, tins,
                            pizza, traps (speed cameras), bowling, bigmap (hold Tab)
src/vehicles/               damage (dents, scuffs, cracked glass, dead lamps, torn-off bumpers: see the notes at its top),
                            vehicle (handling, rider seat), carModel (stand-in shapes + the wheel batch), vehicleModels (loads the
                            Blender models from assets/vehicles/ and swaps them in), aiDriver (traffic + pursuit), traffic,
                            highwayTraffic (drivers and cruisers on the elevated roads)
src/characters/             rig (the body everyone shares), models (Critters + Tin Bots, who walks the streets, the walk cycle),
                            bigheads (the Big Head builder: heads, hair, hats, faces, clothes), bigheadLooks (what a Big Head can
                            look like: the named three and the dice for everyone else), pedestrians
src/player/                 player (on foot, in/out of cars), camera
src/police/                 police (stars, cruisers, officers on foot)
src/missions/               jobs (chop-shop orders, taxi fares, their markers and radar blips)
src/combat/                 combat (Rocco's weapons, aim, punch), hits (damage rules), copGuns (cops shoot back),
                            pickups, gunfx (tracers, muzzle flash), weaponModels (loads assets/weapons/*.gltf.json),
                            sightView (the gun seen down its sights: each model's sight line, paws, recoil and sway)
assets/weapons/             Flynn's guns as self-contained glTF (.gltf.json), converted from GrappleStrikeGuns.fbx
assets/vehicles/            the eight vehicles built in Blender (.gltf.json) + their shared texture atlas (atlas_*.png).
                            Sources, .blend files and .glb copies: /mnt/project-files/models/vehicles/
src/ui/                     hud, weaponHud (ammo, armor, crosshair, scope), minimap, whoPicker ("Play as" on the menus)
src/fx/                     effects (tyre marks, smoke, sparks), carLights, debris (shards and torn-off parts)
dev/damage-lab.html         a bench for the crash damage: vehicles on a plain floor, dented from the console (not part of the game)
dev/cast-lab.html           a bench for the characters: a line-up of any cast members, e.g. ?kinds=sal,dale,tiff,bighead*9
vendor/                     three.js r160 and Rapier 2D, vendored so the game works offline
```

Tuning the feel of the game almost always means editing `src/config.js`.

Add `?test` to the URL to stop the game loop and drive frames by hand from the console
(`__fta.advance(1/60)`), which is how the automated playtests run.

## Credits

Built with [three.js](https://threejs.org) (MIT) and [Rapier](https://rapier.rs) (Apache-2.0).
All art, sound and code are original to this project. The weapon models are Flynn's own.
