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
| E | Steal a car / get out |
| Space | Handbrake |
| Shift | Sprint |
| Left click | Punch / shoot (hold for the SMG) |
| Right click (hold) | Aim over the shoulder; the sniper looks through its scope (mouse wheel: 4× / 8×) |
| [ and ] | Mouse sensitivity down / up (remembered) |
| 1 to 6 / mouse wheel | Fists, pistol, SMG, shotgun, burst rifle, sniper |
| R | Reload |
| H | Horn |
| T | Skip to night / day |
| Q | Graphics: high / fast |
| M | Mute |
| F11 | Full screen (also on the title and pause menus) |
| Esc | Pause |

## How the game works

- **Driving.** Steering alone never breaks the tyres loose: the car turns as tight as its grip allows at that speed and no tighter. Hold the handbrake and steer to swing the tail round; let go and the tyres bite again within half a second, keeping most of the speed.
- **Aiming.** Hold right mouse and the camera drops over Rocco's shoulder. Shots go exactly down the crosshair, anywhere inside its four arms (they open with spread). It turns red over someone you can hit, and lands on whoever is nearly dead ahead when the gun comes up.
- **Steal a car.** Parked cars may set off an alarm. Taking one with a driver in it always gets you a star.
- **Stars.** More trouble means more stars, and more (and angrier) cruisers. Officers jump out if you stop.
- **Lose them.** Break line of sight until the stars stop flashing. You get paid for every chase you escape.
- **Weapons.** Guns lie on the sidewalks (yellow dots on the radar), with body armor (blue) and first-aid kits (green). They come back a minute after you take them. Knocked-out cops drop ammo.
- **Fighting.** Hitting or shooting people raises your stars if a cop sees it; hurting a cop always does. From two stars, officers on foot draw pistols and shoot back. Armor soaks damage before health.
- **Vehicles.** Sedans, taxis, vans, box trucks, stretch limos, the Flamingo GT sports car and motorbikes all drive differently: trucks are slow and heavy and shove traffic aside, the sports car and the bike are quick, and a hard crash throws you off the bike. A bike and a sports car are parked next to where you start.
- **Chop-shop orders.** Scrap pages you with a car he wants and it shows up pink on the radar with an arrow over it. Steal it, lose any stars, and park it on the pink marker outside Scrap's Chop Shop. Less damage means more cash. Rare cars (the sports car and the limo) pay the most, and every third order is a police cruiser. Any other stolen car parked there is sold for scrap.
- **Taxi fares.** Sit in a taxi and someone hails you (gold on the radar). Stop next to them, then stop on the gold marker at their destination. A quick, smooth ride earns a tip; fares in a row pay more. Passengers bail if you pick up stars.
- **Wasted** (out of health) bills you and wakes you outside Sunset General (red cross on the radar). You keep your guns.
- **Nabbed** fines you and lets you out of Sunset PD (blue badge). The cops keep your guns.

## Code layout

Each system lives in its own small file, so a change usually touches one place.

```
index.html, css/style.css   page, HUD markup and styling
src/main.js                 boot, game loop, and the rules that connect systems (what is a crime, crashes)
src/config.js               every tunable number: car handling (CAR), aiming (AIM), weapons, police, traffic, day length
src/core/                   engine (renderer + post), physics (Rapier), input, audio (synthesised), utils
src/world/                  city (the Sunset Coast scene), materials, sky (day/night), batching, landmarks (hospital, police station)
src/vehicles/               vehicle (handling, rider seat), carModel (shapes for every vehicle type), aiDriver (traffic + pursuit), traffic
src/characters/             models (Critters + Tin Bots), pedestrians
src/player/                 player (on foot, in/out of cars), camera
src/police/                 police (stars, cruisers, officers on foot)
src/missions/               jobs (chop-shop orders, taxi fares, their markers and radar blips)
src/combat/                 combat (Rocco's weapons, aim, punch), hits (damage rules), copGuns (cops shoot back),
                            pickups, gunfx (tracers, muzzle flash), weaponModels (loads assets/weapons/*.gltf.json)
assets/weapons/             Flynn's guns as self-contained glTF (.gltf.json), converted from GrappleStrikeGuns.fbx
src/ui/                     hud, weaponHud (ammo, armor, crosshair, scope), minimap
src/fx/                     effects (tyre marks, smoke, sparks), carLights
vendor/                     three.js r160 and Rapier 2D, vendored so the game works offline
```

Tuning the feel of the game almost always means editing `src/config.js`.

Add `?test` to the URL to stop the game loop and drive frames by hand from the console
(`__fta.advance(1/60)`), which is how the automated playtests run.

## Credits

Built with [three.js](https://threejs.org) (MIT) and [Rapier](https://rapier.rs) (Apache-2.0).
All art, sound and code are original to this project. The weapon models are Flynn's own.
