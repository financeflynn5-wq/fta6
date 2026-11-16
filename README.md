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
| Right click (hold) | Aim over the shoulder; the sniper zooms |
| 1 to 6 / mouse wheel | Fists, pistol, SMG, shotgun, burst rifle, sniper |
| R | Reload |
| H | Horn |
| T | Skip to night / day |
| Q | Graphics: high / fast |
| M | Mute |
| Esc | Pause |

## How the game works

- **Steal a car.** Parked cars may set off an alarm. Taking one with a driver in it always gets you a star.
- **Stars.** More trouble means more stars, and more (and angrier) cruisers. Officers jump out if you stop.
- **Lose them.** Break line of sight until the stars stop flashing. You get paid for every chase you escape.
- **Weapons.** Guns lie on the sidewalks (yellow dots on the radar), with body armor (blue) and first-aid kits (green). They come back a minute after you take them. Knocked-out cops drop ammo.
- **Fighting.** Hitting or shooting people raises your stars if a cop sees it; hurting a cop always does. From two stars, officers on foot draw pistols and shoot back. Armor soaks damage before health.
- **Wasted** (out of health) bills you and wakes you outside Sunset General (red cross on the radar). You keep your guns.
- **Nabbed** fines you and lets you out of Sunset PD (blue badge). The cops keep your guns.

## Code layout

Each system lives in its own small file, so a change usually touches one place.

```
index.html, css/style.css   page, HUD markup and styling
src/main.js                 boot, game loop, and the rules that connect systems (what is a crime, crashes)
src/config.js               every tunable number: car handling, police, traffic, day length
src/core/                   engine (renderer + post), physics (Rapier), input, audio (synthesised), utils
src/world/                  city (the Sunset Coast scene), materials, sky (day/night), batching, landmarks (hospital, police station)
src/vehicles/               vehicle (handling), carModel, aiDriver (traffic + pursuit), traffic
src/characters/             models (Critters + Tin Bots), pedestrians
src/player/                 player (on foot, in/out of cars), camera
src/police/                 police (stars, cruisers, officers on foot)
src/combat/                 combat (Rocco's weapons, aim, punch), hits (damage rules), copGuns (cops shoot back),
                            pickups, gunfx (tracers, muzzle flash), weaponModels (loads assets/weapons/*.glb)
assets/weapons/             Flynn's guns as .glb (barrel along +Z, grip down -Y); converted from GrappleStrikeGuns.fbx
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
