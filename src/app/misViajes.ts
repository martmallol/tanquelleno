/**
 * Controlador de "Mis viajes": lista los viajes guardados en localStorage,
 * permite abrirlos (los carga como viaje activo y va al resultado) o borrarlos.
 */

import { tripStore, type SavedTrip } from './tripStore';
import { qs, escapeHtml } from './dom';

export function initMisViajes(): void {
  const list = qs('[data-saved]');
  render();

  list.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const del = target.closest<HTMLElement>('[data-delete]');
    if (del) {
      e.stopPropagation();
      tripStore.removeSaved(del.dataset.delete!);
      render();
      return;
    }
    const card = target.closest<HTMLElement>('[data-open]');
    if (card) {
      const loaded = tripStore.loadSaved(card.dataset.open!);
      if (loaded) window.location.href = 'resultado.html';
    }
  });

  function render(): void {
    const saved = tripStore.listSaved();
    if (saved.length === 0) {
      list.innerHTML = `
        <div class="saved-empty">
          <div class="saved-empty-title">Todavía no guardaste ningún viaje</div>
          <p class="saved-empty-text">Cuando calcules un viaje, tocá <strong>Guardar</strong> en el resultado y va a aparecer acá.</p>
        </div>`;
      return;
    }
    list.innerHTML = saved.map(card).join('');
  }
}

function card(s: SavedTrip): string {
  const when = new Date(s.savedAt).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `
    <div class="saved-card" data-open="${s.id}" role="button" tabindex="0">
      <div class="saved-card-main">
        <div class="saved-card-title">${escapeHtml(s.title)}</div>
        <div class="saved-card-sub">${escapeHtml(s.subtitle)}</div>
        <div class="saved-card-date">guardado el ${escapeHtml(when)}</div>
      </div>
      <button class="saved-card-del" data-delete="${s.id}" aria-label="Borrar viaje" title="Borrar">✕</button>
    </div>`;
}
