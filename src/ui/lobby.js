// "Play together" on the title menu: a name, a room code and a button. Everyone who joins the same code is in
// the same city. Also the list of who is here (top left of the screen) and "Leave the room" on the pause menu.
// A link with ?room=CODE fills the code in, so an invite is just a link.
import { NET } from '../config.js';

const $ = (id) => document.getElementById(id);
const read = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* fine */ } };

export function createLobby(game, play) {
  const net = game.net, nameIn = $('mpName'), roomIn = $('mpRoom'), btn = $('mpBtn'), note = $('mpNote'), list = $('mpList'), status = $('mpStatus'), leave = $('mpLeave');
  const q = new URLSearchParams(location.search);
  // switched off (config.js NET.enabled): the menu stays hidden and nothing here can start a connection
  if (!NET.enabled && !q.has('mp')) return { join() { }, refresh() { }, off: true };
  $('mp').hidden = false; $('mpKey').hidden = false;
  nameIn.value = (q.get('name') || read('fta6.name')).slice(0, 14);
  roomIn.value = (q.get('room') || read('fta6.room') || 'SUNSET').slice(0, 12).toUpperCase();
  const who = () => nameIn.value.trim() || 'Player ' + (10 + Math.floor(Math.random() * 90));

  async function join() {
    if (net.active) { play(); return; }
    btn.disabled = true; btn.textContent = 'Joining…';
    try {
      const name = who(); nameIn.value = name;
      await net.join(roomIn.value, name);
      write('fta6.name', name); write('fta6.room', roomIn.value.toUpperCase());
      play(); game.hud.toast(`ROOM ${net.room.toUpperCase()}: PRESS ESC FOR COPS VS ROBBERS`, 'info');
    } catch (e) { note.textContent = 'Could not join: ' + (e?.message || e); }
    btn.disabled = false; refresh();
  }
  btn.addEventListener('click', join);
  for (const el of [nameIn, roomIn]) el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Enter') join(); });
  leave.addEventListener('click', () => net.leave());

  function refresh() {
    const on = net.active;
    btn.textContent = on ? 'Back to the room' : 'Join room'; nameIn.disabled = roomIn.disabled = on;
    note.textContent = !on ? 'Pick a room code and tell your friends. Everyone who joins the same code plays in the same city. Once you are in, press Esc to set up Cops vs Robbers.'
      : net.kind === 'tabs' ? 'You are in, but only on this computer' + (net.note ? ' (' + net.note + ')' : '') + '. Open the game in a second window and join the same code to try it.'
        : net.kind === 'direct' && net.host ? 'You are hosting this room. Friends who open the game and join the same code will appear. If you close the game, the room closes.'
          : 'You are in. Friends who join the same code will appear.';
    list.hidden = !on; status.hidden = leave.hidden = !on;
    list.textContent = ''; if (!on) return;
    const head = document.createElement('b'); head.textContent = `ROOM ${net.room.toUpperCase()}`; list.append(head);
    const row = (name, color) => { const s = document.createElement('span'), dot = document.createElement('i'); if (color) dot.style.background = color; s.append(dot, name); list.append(s); };
    const m = game.match; row(net.name + ' (you)', m?.on && m.team >= 0 ? m.teams[m.team].color : undefined);
    for (const r of net.remotes.values()) row(r.name, r.marker.color);
    status.textContent = `Room ${net.room.toUpperCase()}: ${net.count} ${net.count === 1 ? 'player' : 'players'}. The city keeps going while this menu is open.`;
  }
  net.onChange(refresh);
  btn.disabled = false; refresh();
  if (q.get('room') && q.has('auto')) join();          // ?room=CODE&auto: straight in (the playtests use this)
  return { join, refresh };
}
