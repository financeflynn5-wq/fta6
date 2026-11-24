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
| E, then Space | In a flying helicopter: jump out, then open your parachute (A D steer it, S flares for a soft landing; W dives while you fall) |
| Shift | Sprint |
| Left click | Punch / slash / shoot (hold for the SMG). Keep clicking with your fists up: every third punch in a row is a haymaker |
| Right click (hold) | With fists or the knife: block. With a gun: aim down its own sights; the sniper looks through its scope (mouse wheel: 4× / 8×) |
| [ and ] | Mouse sensitivity down / up (remembered) |
| 1 to 6 / mouse wheel | Fists (1 again swaps to the knife once you have one), pistol, SMG, shotgun, burst rifle, sniper |
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
- **How they are built and move.** Everyone stands on one jointed body (`src/characters/rig.js`): hips, knees and ankles, a chest
  that twists against the hips, shoulders, elbows and hands. A family adds its head and clothes, and the whole character is then
  welded into three to five skinned meshes (`weld.js`), so a crowd costs a third of the draw calls it used to. One function,
  `animateCharacter` in `animate.js`, moves them all: knees fold as a leg swings through, feet stay level and planted, the body
  leans into a run and into a turn, shoulders swing against the hips, the head stays level and looks about, eyes blink, googly
  pupils and tails and antennas lag behind the body. Citizens ease round corners and glance at you as you pass.
  Guns and knives go in `userData.hands[0]` (the right hand). Code that poses an arm or leg itself (a gun held up, a punch,
  sitting on a bike) just sets the shoulder or hip after `animateCharacter` as before; to fold the elbow or knee too it leaves
  `arm.userData.bend` / `leg.userData.bend` (radians) each frame, or calls `poseJoints` for a whole seated pose.
- **Play as.** The title and pause menus let you be Rocco, Big Sal, Tiff or a freshly rolled Big Head (click Random again for another).
  The swap happens on the spot and keeps your guns and cash; the choice is remembered.
- **Driving.** Steering alone never breaks the tyres loose: the car turns as tight as its grip allows at that speed and no tighter. Hold the handbrake and steer to swing the tail round; let go and the tyres bite again within half a second, keeping most of the speed.
- **Aiming.** Hold right mouse and you look through Rocco's eyes, down the sights of the gun in his hands: the pistol's notch and post (with night-sight dots), the SMG's red dot, the bead on the shotgun's rib and the burst rifle's optic. Shots go where the sights point, which is always the middle of the screen. The gun kicks, its slide or pump cycles, and it trails the hand a little when you turn. The aim lands on whoever is nearly dead ahead when the gun comes up, and a lit aiming mark brightens over someone you can hit. The sniper keeps its full scope.
- **Fist fights and knives.** A swing steps you toward whoever is in front of you. Punches land as a combination, the third one is a
  haymaker that puts them on the floor, and holding right mouse blocks most of what comes back from the front. Take three punches
  in a row without landing one and the next one floors you. The knife ($150 at Bullseye Guns, one lies in the alley south of the
  start, and anyone who pulls one on you drops it) cuts deeper and faster. Punch a citizen and some of them square up instead of running.
  Everyone who fights you on foot is one system, `src/combat/brawlers.js`, tuned by `MELEE` and `BRAWL` in `src/config.js`.
- **No flickering surfaces.** Two surfaces closer together than the depth buffer can tell apart flicker ("z-fighting"), and it
  gets worse with distance. Three things keep it away. The picture starts as far in front of the camera as the surroundings
  allow (`VIEW` in config, `nearPlane` in `src/world/world.js`): 30 cm on the street, up to 5 m from a helicopter with clear air
  around it, which sharpens far-off depth about fifteen times. Window glass and sign boards are drawn a touch nearer than the
  wall they sit on (`PROUD` in `src/world/materials.js`). And nothing is built level with something else: leave a couple of
  centimetres, or let one thing stand proud. `dev/flicker/` scans the whole map for offenders.
- **Hit reactions.** Nobody spins on the spot any more. A punch rocks them back a step, a shove or a slow car sits them down, a fast
  car throws them up the road and over, and then they sit up and climb back to their feet. Rocco does the same when he is floored.
  It lives in `animateCharacter` and its helpers in `src/characters/animate.js`; `peds.launch` and `peds.stagger` start one.
- **Whisper Woods.** The pine forest over High Meadows (north-west of the hills, a trail leaves the road by the KEEP OUT board).
  In the clearing in the middle is a camp, and the people who live there want you gone the moment they see you: seven of them,
  two with knives. Fight them all off for $500 and what they kept in the stash. They are back after a while. `CAMP` in config.
- **The Tipsy Possum.** The bar one block south of where you start (pink Y on the map). $20 buys a drink: +25 health and the room
  sways. Walk into one of the drinkers and he takes it personally, and half the bar takes his side. `BAR` in config.
- **Gangs.** The Neon Vipers (purple), the Scrap Kings (orange Tin Bots) and the Possum Posse (green) each hold two corners,
  marked V, K and P on the map. Come close and they tell you once to keep walking. Stay, walk into the middle of them, touch one
  or drive at them and the whole crew comes for you with fists, knives and a pistol or two. Run a crew off for $350; the corner
  is theirs again later. `GANGS` in config (add a corner by adding a `[x, z, name]` to a gang's `turf`).
- **Steal a car.** Parked cars may set off an alarm. Taking one with a driver in it always gets you a star.
- **Stars.** More trouble means more stars, and more (and angrier) cruisers. Officers jump out if you stop. A cruiser carries two officers and puts one out at a time: knock both down and the car is left empty (yours to take), and its replacement is a while coming. Numbers are in `POLICE` in `src/config.js` (`crew`, `nextOut`, `backup`, `footMax`).
- **Lose them.** Break line of sight until the stars stop flashing. You get paid for every chase you escape.
- **Weapons.** Guns lie on the sidewalks, and in a few places in the valley, (yellow dots on the radar), with body armor (blue) and first-aid kits (green). They come back a minute after you take them. Knocked-out cops drop ammo.
- **Fighting.** Hitting or shooting people raises your stars if a cop sees it; hurting a cop always does. From two stars, officers on foot draw pistols and shoot back. Armor soaks damage before health.
- **Vehicles.** Sedans, taxis, vans, box trucks, stretch limos, the Flamingo GT sports car and motorbikes all drive differently: trucks are slow and heavy and shove traffic aside, the sports car and the bike are quick, and a hard crash throws you off the bike. A bike and a sports car are parked next to where you start.
- **Mouse Bear Trucking.** The company's depot is the fenced yard just north of Port Sunset, where the port road meets the
  coast road (the bear in a cap on the radar and the map): a warehouse with loading docks and a billboard on the roof, trailers,
  a fuel island, the logo painted on the tarmac, and the Mouse Bear's head turning on a pole at the corner. Both gates stand open.
  Its teal box trucks, with the mascot on the sides and its ears on the cab, are always out in traffic (at least three near you,
  `MOUSEBEAR.onRoad` in `src/config.js`), and four wait in the yard to be taken; a truck you take comes back to its bay once you
  are far away. They drive like the box truck. The artwork is drawn by `dev/mousebear-art.py` into `assets/mousebear/` and
  `assets/vehicles/atlas_mousebear.png`.
- **Frostbite Peak** is the snow mountain off the west edge of the map (the white triangle on the big map). The only way on
  to it is the notch at the top of the West Pass, by car or on foot; the ice road climbs from there to the lodge and the radio
  mast on top, about 215 m up, and it is open in free roam too. Packed snow has less grip than tarmac and the blue sheets of ice
  have almost none: slow down before them, steer gently, and do not brake hard on them. Anything that leaves the ledge slides
  down the mountainside. All of it is tuned in `SNOW` in `src/config.js`: `grip`, `brake` and `drive` on ice, `packed` and
  `powder` for snow, the road's width (`halfWidth`, `pinch`) and how steep it climbs (`grade`), and how long the mission lets
  you stray (`offRoad`).
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
- **Upstairs** (gold dots with three bars on the radar). Eleven downtown buildings have stairs just inside the door and real rooms on every floor above, with real windows you can see in and out of: three apartment blocks (Sunset Arms by the start, Palm Court, Coral Heights), Flamingo Insurance, First Sunset Bank (the vault is upstairs), The Pink Pelican nightclub, Iron Possum Gym, Sunset Museum, and the upper floors of the motel (rooms and a penthouse), Sunset PD (squad room, cells and evidence) and Sunset General (ward, operating theatre). A door at the top of the stairs leads to the roof: every roof has a parachute and a plank to jump from.
  - **Things to find.** Press E to go through drawers, wardrobes, fridges, lockers, crates, suitcases and desks: cash, ammo, armor, a parachute, something to eat, or just odd socks. They fill up again after a few minutes. If somebody on that floor is close enough to see you, that is a star, unless a gun has them cowering first. Evidence shelves and deposit boxes are a crime whoever is watching.
  - **Safes.** Press E, then stand at the dial until it opens. House safes are quiet; office safes (two stars) and the bank vault (three stars) are not. The Sunset Diamond is in the museum's jewel room.
  - **Lucky cats.** Fourteen gold cats are hidden in these buildings. Each pays a little; all of them pays a lot. Found cats are remembered.
  - Numbers (refill times, safe times and pay, who notices) are in `INDOORS` in `src/config.js`.
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
- **Four more jobs** follow the tower: **Catch of the Day** (take Sal's boat off the beach pier and spear three golden marlin:
  ease up to them, look at one, left-click to throw; then bring the catch back), **The Marlin Bay Cup** (a boat race through
  buoy gates from Sunset Beach up the coast to the marina; first across the line or it does not count), **Dead Possum's Chest**
  (dig at three X's on Golden Acres, win the shoot-out when two cars of Possum Posse roll up, lose more of them on the road to
  Marlin Bay, sink five of their boats with the gun on your bow (hold left mouse; it locks on to whichever boat you look at),
  land at Port Sunset, and fly the chest to Rocco's Rock by helicopter) and **The Possum Grand** (the hotel the Posse is building
  in Port Sunset: up the ramps a floor at a time through the guards, crack the safe on the roof by pressing E as the needle
  crosses the green, four times, before the clock runs out; then you are trapped up there and the only way down is off the
  plank with a parachute). The long ones have checkpoints: after a fail, Y starts you from the last one.
- **The Frostbite Run** is a job on the side, from Dot, Mouse Bear's dispatcher, who stands by the gatehouse at the depot (Tiff
  sends you her way after the Possum Grand, and it is in the pause menu's list like the rest). Take the loaded truck from the first
  bay, drive it across town and over the West Pass, through the gate at the top of it, and up the ice road to the Frostbite
  Lodge on top of Frostbite Peak. The road is one narrow ledge wound round the mountain, with no rails: dirt, then packed snow,
  then sheets of blue ice. Going over the edge, or leaving the road for more than a few seconds, loses the load. Four
  checkpoints on the way up put you back in a fresh truck, and a truck delivered without a scratch pays a bonus.
- **Any mission, any time.** The pause menu lists all thirteen; click one and you are at whoever gives it. A mission picked that
  way pays as usual and leaves your place in the story where it was.
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
  before it touches down, and can land on any roof (step out and you are standing on the roof; walk off the edge and you fall).
  Flying into a building hurts; ditching in the sea or losing the engine wrecks it.
- **Skydiving**: E in a flying helicopter jumps out. You fall spread-eagle at about 27 m/s (hold W to dive faster, WASD to
  drift), and the helicopter comes down on its own. With a parachute, Space opens it at 5 m or more above whatever is below:
  A/D steer, W speeds up, S flares, and you can land on a roof. Without one you hit at full speed, which kills from any real
  height; only the sea breaks a fall (it still hurts). Parachute packs lie beside every helipad, and Bullseye Guns sells them
  for $250; you can carry three, each opens once, and they are saved with your cash. Tuning is `SKY` in `src/config.js`.
- **The law**: stealing a police boat or chopper, or anything of the army's, puts stars on you at once. From three stars
  (two if you are afloat or in the air) a police helicopter circles over you; while it can see you the cops never lose you,
  so put a tall building between you and it, get under a bridge, indoors or into the pines of Whisper Woods, outrun it
  (a sports car or a motorbike flat out is faster), or shoot it down. Once it has lost you it circles where you were last
  seen and has to come close to pick you up again; after a few seconds of nobody seeing you it gives up, and after about a
  minute over you it runs low on fuel, and the next one is a while coming (`POLICE_CRAFT` in `src/config.js`: `heliSight`,
  `heliSpot`, `heliGiveUp`, `heliStay`, `heliAgain`, `heliPace`). At night it carries a searchlight. On the water, patrol boats come
  after you and bust you if you stop. Cruisers wait at the nearest street until you come ashore.
- Each craft has a home slot (`src/vehicles/fleet.js`) and comes back there once it is stolen, wrecked or lost and you are far away.

## Sharks

Seven sharks patrol wherever the sea is deep enough to swim in, a fin and a line of foam above the water.

- **Swimming**: one that comes within about 55 m of you notices (a red blip on the radar, a two-note warning), circles for a few
  seconds, then charges. A bite costs 22 health and it takes a couple of seconds to come round again; up to three hunt at once.
  Get out of the water, or into a boat. Falling in from a helicopter or a wrecked boat counts as swimming.
- **Boats**: a moving boat is safe. Sit still for five seconds in deep water and one rams the hull; a jet ski may throw you off.
  Run a shark down at speed and it is the shark that gets hurt.
- **Fighting back**: they can be shot (150 health, $200 each) and a punch on the nose sends one away for a while.
- Tuning is `SHARK` in `src/config.js`; the code is `src/wildlife/sharks.js`.

## Sunset Zoo

On the coast road beside the lighthouse (gold Z on the radar): a walled zoo you can walk or drive into, with a snack bar and a
back gate to the lighthouse. Zebras, penguins, bears and lions live down the west side, giraffes, hippos, elephants and
gorillas down the east.

- **Fences break.** Wooden rails (zebras, giraffes) go down to any car; steel pipes (hippos, elephants) and iron bars (bears,
  lions, gorillas) need a real run-up and cost the car; the penguins' glass can be shot out. You can shoot between bars.
  Each enclosure also has a yellow keeper's gate: stand at it and press **E**.
- **Letting animals out is a crime** (two stars for the dangerous ones) and everyone in the zoo runs.
- **What they do once out**: lions, lionesses and bears hunt whoever is on foot, you included, and are faster than you can
  sprint; in a car they claw at it if you dawdle. Gorillas beat their chests, then punch anyone who stays within a few metres.
  Hippos bite anyone who comes close and head for the sea with the penguins. Elephants leave you alone unless you hurt one,
  then they charge, on foot or in a car, and will push their own fence over to get at you. Zebras and giraffes just run.
  Dangerous animals on the loose are red blips.
- **Cars**: a car bowls the smaller animals over (and takes a dent); an elephant or a hippo is like hitting a rock.
- **They can all be shot, punched or stabbed**, and whoever you hurt (and its pride) comes for you. Knocking out an animal that
  was doing no harm is a one-star crime.
- **Everything is put back** (animals, fences, gates) once you are about 240 m away.
- Tuning is `ZOO` in `src/config.js`: one line per animal (health, speeds, temper, damage) and the rules below it.

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
                            storeys (the floors above a walk-in building: stairs, upper floors, real windows, the roof),
                            rooms (which buildings have an upstairs and what stands on every floor), furniture (the pieces),
                            siteTower (the Possum Grand: a six-floor building site in Port Sunset you can climb, built from stacked decks),
                            north (the valley: its land, the shared building kit, and the order its districts are built in),
                            park, mall, marina, farm, base (one file per valley district; Palmview is in north),
                            places (things that break: glass, fences, props, gate booms; the base's alarm; roofs the camera stays under)
                            zoo (Sunset Zoo's wall, gates, paths and enclosures; who lives in them is src/wildlife/)
                            forest (Whisper Woods: the pines over High Meadows, the trail, the clearing and everything in the camp)
                            snowland (Frostbite Peak as numbers: the mountain's shape, the ice road, where it is icy),
                            snowpeak (the same, drawn: land, road, ice, pines, gate, lodge, falling snow; a far-away stand-in)
src/activities/             activities (start rings, one-at-a-time), kit (markers, panel, banner, save), races, stunts, tins,
                            pizza, traps (speed cameras), bowling, bounty, derby, spree (the mall), range, spray, bigmap (hold Tab)
src/story/                  story (the mission runner: start rings, the people who give jobs, steps, checkpoints, pass/fail/retry,
                            the menu buttons and the mission list), missions (the first eight jobs as data: read its header for the
                            step vocabulary), missions2 (the four after that, with their own little scenes: digging, the ambush,
                            the chase, the boat battle, the safe, the jump), missions3 (the Frostbite Run: the truck on the ice road), sea (what missions do on the water: the bow gun,
                            crooks in boats, fish and spears, the buoy race), dialogue (the
                            talking box and who can speak), gunmen (armed goons), wallet (cash and guns saved between sessions)
src/vehicles/               damage (dents, scuffs, cracked glass, dead lamps, torn-off bumpers: see the notes at its top),
                            vehicle (handling, rider seat), carModel (stand-in shapes + the wheel batch), vehicleModels (loads the
                            Blender models from assets/vehicles/ and swaps them in), aiDriver (traffic + pursuit), traffic,
                            highwayTraffic (drivers and cruisers on the elevated roads),
                            boats (how a boat moves, its wake), helis (how a helicopter flies, lands and crashes), fleet (where
                            boats and helicopters are kept and put back), craftModels + loft (their models, built in code)
src/characters/             rig (the jointed body everyone shares), critters (raccoons, possums, pigeons), bots (Tin Bots),
                            animate (how everybody moves), weld (a finished character becomes a few skinned meshes),
                            models (builds anyone by name, who walks the streets, hats and crowns),
                            bigheads (the Big Head builder: heads, hair, hats, faces, clothes), bigheadLooks (what a Big Head can
                            look like: the named three and the dice for everyone else), pedestrians
src/player/                 player (on foot, in/out of cars), camera, skydive (jumping out of a helicopter, free fall, the
                            parachute and its packs, standing on roofs)
src/police/                 police (stars, cruisers, officers on foot), airSea (the police helicopter, its searchlight, patrol boats)
src/missions/               jobs (chop-shop orders, taxi fares, their markers and radar blips), outlaws (crooks' cars: runaways
                            you run down, rivals that come after you; used by the story, the bounty hunts and the derby)
                            trouble (ties these to the game) with camp (the people in Whisper Woods), barfight (the drinkers
                            in The Tipsy Possum) and gangs (three gangs and their corners)
src/combat/                 combat (Rocco's weapons, aim, punches, the knife, blocking), hits (damage rules), copGuns (cops shoot back),
                            brawlers (everyone who fights you on foot: wind-ups, taking turns, knives, pistols, getting floored),
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
src/wildlife/               beasts (the animal models and how they move), sharks, zooLife (what each zoo animal does, at home
                            and loose), calls (their noises), wildlife (ties them to the game and to shots), ray
src/fx/                     effects (tyre marks, smoke, sparks), carLights, debris (shards and torn-off parts), wake (foam on the sea)
dev/damage-lab.html         a bench for the crash damage: vehicles on a plain floor, dented from the console (not part of the game)
dev/craft-lab.html          a bench for the boats and helicopters, e.g. ?types=heli,speedboat&sea&rider=raccoon
dev/cast-lab.html           a bench for the characters: a line-up of any cast members, e.g. ?kinds=sal,dale,tiff,bighead*9
                            (&pose=walk|run|flail|down|up, &strip lays one stride out along the row, &turn=1.57 shows them side on)
dev/flicker/                finds z-fighting (two surfaces flickering against each other) anywhere on the map: see its README
dev/zoo-lab.html            a bench for the animals: any of them in a row, in any pose, e.g. ?kinds=lion,bear,shark&who=raccoon
vendor/                     three.js r160, Rapier 2D and PeerJS 1.5.5, vendored so the game needs no build and no CDN
```

Tuning the feel of the game almost always means editing `src/config.js`.

Add `?test` to the URL to stop the game loop and drive frames by hand from the console
(`__fta.advance(1/60)`), which is how the automated playtests run. `?test&room=CODE&name=Ann&auto&tabs` also joins a room
straight away, so two pages in one browser can play each other; a test moves both forward a few frames at a time.

## Credits

Built with [three.js](https://threejs.org) (MIT), [Rapier](https://rapier.rs) (Apache-2.0) and [PeerJS](https://peerjs.com) (MIT).
All art, sound and code are original to this project. The weapon models are Flynn's own.
