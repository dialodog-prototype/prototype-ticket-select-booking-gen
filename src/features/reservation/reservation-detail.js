import { cancelSchoolReservations } from '../../services/school-reservation.js';
import { showAlert } from '../../components/alert-dialog.js';
import { getSchoolTicket, getSchoolTicketRoundLabel } from '../../services/school-ticket.js';
import { getStoredMembers } from '../../storage/member-storage.js';
import { getSchoolReservationData } from '../../storage/school-reservation-storage.js';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function getTodayKey() {
  const today = new Date();

  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
}

function formatDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return `${month}월 ${day}일 (${WEEKDAY_LABELS[date.getDay()]})`;
}

function getTicketRoundLabel(reservation, schoolReservationList, petsById) {
  const pet = petsById.get(reservation.petId);
  const ticket = pet ? getSchoolTicket(pet, reservation.ticketId) : null;

  return getSchoolTicketRoundLabel(reservation, schoolReservationList, ticket);
}

export function createReservationDetail(root) {
  const requestedDate = new URLSearchParams(window.location.search).get('date');
  const state = {
    dateKey: /^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? '') ? requestedDate : getTodayKey(),
    selectedReservationIds: new Set(),
    isSelecting: false,
  };
  const dateLabel = root.querySelector('[data-field="reservation-date"]');
  const selectionAction = root.querySelector('[data-field="selection-action"]');
  const cancellationNotice = root.querySelector('[data-field="cancellation-notice"]');
  const petList = root.querySelector('[data-field="reservation-pet-list"]');
  const emptyMessage = root.querySelector('[data-field="empty-message"]');
  const cancellationFooter = root.querySelector('[data-field="cancellation-footer"]');
  const cancellationButton = root.querySelector('[data-action="cancel-reservations"]');

  function getReservations() {
    const { schoolReservationList } = getSchoolReservationData();

    return schoolReservationList.filter((reservation) => (
      reservation.status === '예약' && reservation.date === state.dateKey
    ));
  }

  function isCancellable() {
    return state.dateKey > getTodayKey();
  }

  function render() {
    const reservations = getReservations();
    const { schoolReservationList } = getSchoolReservationData();
    const petsById = new Map(getStoredMembers().flatMap((member) => member.pets).map((pet) => [pet.id, pet]));
    const cancellable = isCancellable();
    const reservationIds = new Set(reservations.map((reservation) => reservation.id));

    state.selectedReservationIds = new Set(
      [...state.selectedReservationIds].filter((reservationId) => reservationIds.has(reservationId)),
    );
    dateLabel.textContent = formatDate(state.dateKey);
    const canCancelReservations = cancellable && reservations.length > 0;

    cancellationNotice.hidden = !canCancelReservations;
    cancellationFooter.hidden = !canCancelReservations;
    const isSelecting = canCancelReservations && state.isSelecting;
    cancellationButton.dataset.state = isSelecting ? 'selecting' : 'idle';
    selectionAction.hidden = !isSelecting;
    emptyMessage.hidden = reservations.length > 0;

    selectionAction.textContent = state.selectedReservationIds.size === reservations.length ? '전체 해제' : '전체 선택';
    cancellationButton.disabled = isSelecting && state.selectedReservationIds.size === 0;
    petList.innerHTML = reservations.map((reservation) => {
      const isSelected = state.selectedReservationIds.has(reservation.id);
      const ticketRoundLabel = getTicketRoundLabel(reservation, schoolReservationList, petsById);
      const pet = petsById.get(reservation.petId);
      const petDetails = [pet?.breed, pet?.weight].filter(Boolean).join(' / ');

      // Business-created reservations may have no ticketId: show '미등록' in the ticket row dd.
      // The customer app still requires a selected ticket when creating a reservation.
      return `
        <article class="reservation-pet-card surface-card${isSelected ? ' surface-card--selected' : ''}">
          <div class="reservation-pet-card__profile">
            <img class="reservation-pet-card__image" src="assets/images/defaultProfile_dog.svg" width="52" height="52" alt="" />
            <div class="reservation-pet-card__content">
              <h3 class="reservation-pet-card__name">${reservation.petName}</h3>
              ${petDetails ? `<p class="reservation-pet-card__details">${petDetails}</p>` : ''}
            </div>
          </div>
          <div class="reservation-pet-card__usage"${isSelecting ? ' hidden' : ''}>
            <p class="reservation-pet-card__usage-title">이용권 정보</p>
            <dl class="reservation-pet-card__information">
              <div class="reservation-pet-card__row">
                <dt>이용권</dt>
                <dd>${reservation.ticketId ? (reservation.ticketName ?? '유치원 이용권') : '미등록'}</dd>
              </div>
              ${ticketRoundLabel ? `<div class="reservation-pet-card__row"><dt>이용 회차</dt><dd>${ticketRoundLabel}</dd></div>` : ''}
            </dl>
          </div>
          ${isSelecting ? `<button class="reservation-pet-card__selection" type="button" data-action="toggle-reservation" data-reservation-id="${reservation.id}" aria-label="${reservation.petName} 예약 선택" aria-pressed="${isSelected}"><span class="reservation-pet-card__check${isSelected ? ' reservation-pet-card__check--selected' : ''}" aria-hidden="true">${isSelected ? '✓' : ''}</span></button>` : ''}
        </article>
      `;
    }).join('');
  }

  root.addEventListener('click', async (event) => {
    const actionTarget = event.target.closest('[data-action]');

    if (!actionTarget) return;

    if (actionTarget.dataset.action === 'go-back') {
      window.location.assign(`index.html?date=${state.dateKey}`);
      return;
    }

    if (actionTarget.dataset.action === 'toggle-reservation') {
      if (!state.isSelecting || !isCancellable()) return;
      const { reservationId } = actionTarget.dataset;

      if (state.selectedReservationIds.has(reservationId)) state.selectedReservationIds.delete(reservationId);
      else state.selectedReservationIds.add(reservationId);

      render();
    }

    if (actionTarget.dataset.action === 'toggle-all-selection') {
      if (!state.isSelecting || !isCancellable()) return;
      const reservations = getReservations();

      state.selectedReservationIds = state.selectedReservationIds.size === reservations.length
        ? new Set()
        : new Set(reservations.map((reservation) => reservation.id));
      render();
    }

    if (actionTarget.dataset.action === 'cancel-reservations') {
      if (!isCancellable() || getReservations().length === 0) return;
      if (!state.isSelecting) {
        state.isSelecting = true;
        render();
        selectionAction.focus();
        return;
      }
      if (state.selectedReservationIds.size === 0) return;
      const reservationIds = [...state.selectedReservationIds];
      if (!await showAlert({ message: `${reservationIds.length}건의 예약을 취소할까요?`, cancelLabel: '취소', confirmLabel: '확인', danger: true })) return;

      const result = cancelSchoolReservations(reservationIds);

      if (!result.ok) await showAlert({ message: result.message });
      else window.location.assign('./index.html?reservationCancelled=true');

      render();
    }
  });

  render();
}
