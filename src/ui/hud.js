// Everything drawn on top of the game: cash, stars, health, speedo, prompts and toasts.
import { PLAYER } from '../config.js';

const $ = (id) => document.getElementById(id);

export function createHud(game) {
  const el = { hud: $('hud'), money: $('money'), stars: $('stars'), health: $('healthBar'), stamina: $('staminaBar'), speedo: $('speedo'), kmh: $('kmh'), carBar: $('carBar'), carName: $('carName'), prompt: $('prompt'), toasts: $('toasts'), siren: $('sirenFx'), hurt: $('hurtFx'), clock: $('clock'), job: $('job') };
  el.stars.innerHTML = '<span>★</span>'.repeat(5);
  const starEls = [...el.stars.children];
  let shownMoney = 0, lastPrompt = '', hurtT = 0, lastKmh = -1, lastClock = '', lastJob = '', jobT = 0;

  const hud = {
    show(v) { el.hud.hidden = !v; },
    setStars(n, pop = false) {
      starEls.forEach((s, i) => { const on = i < n; if (on && !s.classList.contains('on') && pop) { s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); } s.classList.toggle('on', on); if (!on) s.classList.remove('pop'); });
      if (!n) el.stars.classList.remove('search');
    },
    setSearching(v) { el.stars.classList.toggle('search', v); },
    toast(text, cls = 'info') {
      const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = text; el.toasts.appendChild(d);
      while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
      setTimeout(() => d.remove(), 2400);
    },
    hurt() { hurtT = 1; },
    moneyPop() { el.money.classList.add('pop'); setTimeout(() => el.money.classList.remove('pop'), 160); },
    update(dt, t) {
      const p = game.player, car = p.vehicle, police = game.police;
      // cash counts up instead of jumping
      if (shownMoney !== game.money) { const d = game.money - shownMoney; shownMoney += Math.abs(d) < 3 ? d : d * Math.min(1, dt * 8); el.money.textContent = '$' + Math.round(shownMoney).toLocaleString('en-US'); }
      el.health.style.width = (p.health / PLAYER.health * 100) + '%';
      el.stamina.style.width = (p.stamina / PLAYER.stamina * 100) + '%';
      el.stamina.parentElement.style.opacity = p.stamina < PLAYER.stamina - .05 ? 1 : 0;
      el.speedo.hidden = !car;
      if (car) {
        const k = Math.round(car.speed * 3.6); if (k !== lastKmh) { el.kmh.textContent = k; lastKmh = k; }
        el.carBar.style.width = (car.health / car.stats.health * 100) + '%'; el.carName.textContent = car.wrecked ? 'TOTALED' : car.stats.name;
      }
      let prompt = '';
      if (!game.over) {
        if (car) prompt = car.wrecked ? '<kbd>E</kbd> Bail out, it\'s dead' : (car.speed < 1 && police.stars === 0 && game.hints.exit-- > 0 ? '<kbd>E</kbd> Get out' : '');
        else if (p.nearCar) prompt = p.nearCar.stolen ? '<kbd>E</kbd> Get back in' : `<kbd>E</kbd> ${p.nearCar.driver ? 'Carjack' : 'Steal'} this ${p.nearCar.stats.name.toLowerCase()}`;
      }
      if (prompt !== lastPrompt) { el.prompt.innerHTML = prompt; el.prompt.hidden = !prompt; lastPrompt = prompt; }
      // red/blue wash at the screen edges while the cops are on you
      const heat = police.stars > 0 && !police.searching ? Math.min(.75, .25 + game.police.sirenLevel() * .5) : 0;
      el.siren.style.opacity = heat; if (heat) el.siren.classList.toggle('alt', Math.floor(t * 4) % 2 === 0);
      hurtT = Math.max(0, hurtT - dt * 1.5); el.hurt.style.opacity = Math.max(hurtT, p.health < 30 ? .5 + Math.sin(t * 6) * .2 : 0);
      // the job panel: what you're working on and what it pays (refreshed a few times a second)
      if ((jobT -= dt) <= 0) {
        jobT = .2;
        const html = game.over ? '' : game.jobs.lines().map(([tag, text, cash]) => `<div class="${tag === 'FARE' ? 'gold' : ''}"><b>${tag}</b><span>${text}</span>${cash ? `<em>${cash}</em>` : ''}</div>`).join('');
        if (html !== lastJob) { el.job.innerHTML = html; el.job.hidden = !html; lastJob = html; }
      }
      const c = game.env.label(); if (c !== lastClock) { el.clock.textContent = c; lastClock = c; }
    },
  };
  return hud;
}
