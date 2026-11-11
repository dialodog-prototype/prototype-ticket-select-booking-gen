import { getStoredMembers } from '../../storage/member-storage.js';
import { showAlert } from '../../components/alert-dialog.js';
import { getSchoolReservationData } from '../../storage/school-reservation-storage.js';
import {
  getSelectedPetAvailability,
} from '../../services/reservation-availability.js';
import {
  getAvailableSchoolTickets,
  getDefaultSchoolTicket,
  getSchoolTicket,
  getSchoolTicketValidityLabel,
  getTicketReservableCount,
} from '../../services/school-ticket.js';
import {
  applyPastSchoolReservationAttendance,
  createSchoolReservations,
} from '../../services/school-reservation.js';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function formatMonth(date) {
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function createReservationForm(root, { onClose } = {}) {
  applyPastSchoolReservationAttendance();
  const guardian = getStoredMembers().find((member) => member.guardianName === '김민지');
  const { schoolReservationList } = getSchoolReservationData();
  const pets = guardian?.pets ?? [];
  const today = new Date();
  const state = {
    displayedMonth: new Date(today.getFullYear(), today.getMonth(), 1),
    selectedPetIds: new Set(),
    selectedTicketIdsByPetId: new Map(),
    activeTicketPetId: null,
    pendingTicketId: null,
    selectedDates: new Set(),
  };

  const petList = root.querySelector('[data-field="pet-list"]');
  const monthLabel = root.querySelector('[data-field="reservation-month-label"]');
  const daysContainer = root.querySelector('[data-field="reservation-calendar-days"]');
  const selectedDateCount = root.querySelector('[data-field="selected-date-count"]');
  const remainingCount = root.querySelector('[data-field="remaining-count"]');
  const submitButton = root.querySelector('[data-action="submit-reservation"]');
  const notice = root.querySelector('.reservation-form__notice');
  const footer = root.querySelector('.reservation-form__footer');
  const ticketSelectionSheet = root.querySelector('.ticket-selection-sheet');
  const ticketSheetTitle = root.querySelector('[data-field="ticket-sheet-title"]');
  const ticketOptions = root.querySelector('[data-field="ticket-options"]');
  const confirmTicketButton = root.querySelector('[data-action="confirm-ticket-selection"]');
  const dateSection = root.querySelector('[data-field="date-section"]');

  notice.hidden = pets.length <= 1;

  function hasSelectedTicketForEveryPet() {
    return state.selectedPetIds.size > 0
      && [...state.selectedPetIds].every((petId) => state.selectedTicketIdsByPetId.has(petId));
  }

  function getRemainingLimit() {
    const selectedPets = pets.filter((pet) => state.selectedPetIds.has(pet.id));
    const selectedTickets = selectedPets.map((pet) => (
      getSchoolTicket(pet, state.selectedTicketIdsByPetId.get(pet.id))
    ));

    return selectedTickets.length > 0 && selectedTickets.every(Boolean)
      ? Math.min(...selectedPets.map((pet) => {
        const ticket = getSchoolTicket(pet, state.selectedTicketIdsByPetId.get(pet.id));

        return Math.max(0, getTicketReservableCount(ticket) - state.selectedDates.size);
      }))
      : 0;
  }

  function getSelectedTicketAvailability() {
    const selectedPets = pets.filter((pet) => state.selectedPetIds.has(pet.id));
    const selectedTickets = selectedPets.map((pet) => (
      getSchoolTicket(pet, state.selectedTicketIdsByPetId.get(pet.id))
    ));

    return selectedTickets.length > 0 && selectedTickets.every(Boolean)
      ? Math.min(...selectedTickets.map(getTicketReservableCount))
      : 0;
  }

  function renderSummary() {
    const remaining = getSelectedTicketAvailability();
    selectedDateCount.textContent = `${state.selectedDates.size}회`;
    remainingCount.textContent = `${remaining}회`;
    submitButton.disabled = state.selectedPetIds.size === 0
      || !hasSelectedTicketForEveryPet()
      || state.selectedDates.size === 0;
    footer.hidden = state.selectedPetIds.size === 0;
  }

  function renderPets() {
    petList.innerHTML = getPetsSorted().map((pet) => {
      const isSelected = state.selectedPetIds.has(pet.id);
      const defaultTicket = getDefaultSchoolTicket(pet);
      const disabled = !defaultTicket;
      const selectedTicket = getSchoolTicket(pet, state.selectedTicketIdsByPetId.get(pet.id))
        ?? defaultTicket;

      return `
        <article class="pet-selector__item surface-card${isSelected ? ' surface-card--selected pet-selector__item--selected' : ''}" ${disabled ? 'data-state="disabled"' : ''}>
          <button class="pet-selector__pet-button" type="button" data-action="toggle-pet" data-pet-id="${pet.id}" ${disabled ? 'disabled' : ''} role="checkbox" aria-checked="${isSelected}">
          <span class="pet-selector__check" aria-hidden="true">${isSelected ? '✓' : ''}</span>
          <span class="pet-selector__name">${pet.petName}</span>
          </button>
            <button class="pet-selector__ticket" type="button" data-action="open-ticket-selection" data-pet-id="${pet.id}" ${disabled ? 'disabled' : ''}>
              ${disabled ? '<span>사용 가능한 이용권이 없습니다.</span>' : `
              <span class="pet-selector__ticket-value">${selectedTicket ? selectedTicket.name : '이용권을 선택해주세요'}</span>
              <span class="pet-selector__ticket-count">${getTicketReservableCount(selectedTicket)}회 남음</span>
              <span class="pet-selector__ticket-chevron" aria-hidden="true">›</span>
              `}
            </button>
        </article>
      `;
    }).join('');
  }

  function getPetsSorted() {
    return [...pets].sort((left, right) => left.petName.localeCompare(right.petName, 'ko-KR'));
  }

  function renderTicketOptions() {
    const pet = pets.find((item) => item.id === state.activeTicketPetId);

    if (!pet) return;

    const selectedTicketId = state.pendingTicketId;
    ticketSheetTitle.textContent = '이용권 선택';
    confirmTicketButton.disabled = selectedTicketId === state.selectedTicketIdsByPetId.get(pet.id)
      || !getAvailableSchoolTickets(pet).some((ticket) => ticket.id === selectedTicketId);
    ticketOptions.innerHTML = getAvailableSchoolTickets(pet).map((ticket) => {
      const isSelected = ticket.id === selectedTicketId;
      const remaining = getTicketReservableCount(ticket);
      const validityLabel = getSchoolTicketValidityLabel(ticket).replace(/^(만료일|유효기간) : /, '기간 : ');

      return `
        <button class="ticket-selection-sheet__option${isSelected ? ' ticket-selection-sheet__option--selected' : ''}" type="button" data-action="select-ticket" data-ticket-id="${ticket.id}" aria-pressed="${isSelected}">
          <span class="ticket-selection-sheet__check${isSelected ? ' ticket-selection-sheet__check--selected' : ''}" aria-hidden="true">${isSelected ? '✓' : ''}</span>
          <span class="ticket-selection-sheet__info">
            <span>${ticket.name}</span>
            <span class="ticket-selection-sheet__details">예약가능 : ${remaining}회 · ${validityLabel}</span>
          </span>
        </button>
      `;
    }).join('');
  }

  function getDateStatus(dateKey) {
    const todayKey = toDateKey(today);

    if (dateKey <= todayKey) {
      return 'unavailable';
    }

    if (!hasSelectedTicketForEveryPet()) {
      return 'unavailable';
    }

    if (state.selectedDates.has(dateKey)) {
      return 'selected';
    }

    return getSelectedPetAvailability(pets, schoolReservationList, state.selectedPetIds, dateKey).status;
  }

  function renderCalendar() {
    const { displayedMonth } = state;
    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const canSelectDate = hasSelectedTicketForEveryPet();

    monthLabel.textContent = formatMonth(displayedMonth);
    root.querySelector('[data-action="previous-reservation-month"]').disabled = displayedMonth <= new Date(today.getFullYear(), today.getMonth(), 1);
    dateSection.dataset.state = canSelectDate ? 'ready' : 'locked';
    daysContainer.innerHTML = '';

    for (let index = 0; index < firstWeekday; index += 1) {
      const blankCell = document.createElement('span');
      blankCell.className = 'calendar__empty-cell';
      blankCell.setAttribute('aria-hidden', 'true');
      daysContainer.append(blankCell);
    }

    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(year, month, day);
      const dateKey = toDateKey(date);
      const status = getDateStatus(dateKey);
      const isDisabled = status === 'unavailable' || status === 'full';
      const dateButton = document.createElement('button');

      dateButton.className = `calendar__day calendar__day--${status}`;
      dateButton.type = 'button';
      dateButton.dataset.action = 'toggle-reservation-date';
      dateButton.dataset.date = dateKey;
      dateButton.disabled = isDisabled;
      dateButton.setAttribute('role', 'gridcell');
      dateButton.setAttribute('aria-label', `${month + 1}월 ${day}일 (${WEEKDAY_LABELS[date.getDay()]})${status === 'full' ? ', 정원 마감' : ''}`);
      dateButton.innerHTML = `<span class="calendar__day-number">${day}</span>${status === 'full' ? '<span class="calendar__day-note">정원마감</span>' : ''}`;
      daysContainer.append(dateButton);
    }
  }

  function render() {
    renderPets();
    renderCalendar();
    renderSummary();
  }

  root.addEventListener('click', async (event) => {
    const actionTarget = event.target.closest('[data-action]');

    if (!actionTarget) return;

    if (actionTarget.dataset.action === 'close-reservation-form') {
      onClose?.();
      return;
    }

    if (actionTarget.dataset.action === 'toggle-pet') {
      const { petId } = actionTarget.dataset;

      if (state.selectedPetIds.has(petId)) {
        state.selectedPetIds.delete(petId);
        state.selectedTicketIdsByPetId.delete(petId);
      } else {
        const pet = pets.find((item) => item.id === petId);
        const defaultTicket = getDefaultSchoolTicket(pet);

        state.selectedPetIds.add(petId);
        if (defaultTicket) state.selectedTicketIdsByPetId.set(petId, defaultTicket.id);
      }
      state.selectedDates.clear();
      render();
    }

    if (actionTarget.dataset.action === 'open-ticket-selection') {
      const { petId } = actionTarget.dataset;
      const pet = pets.find((item) => item.id === petId);

      if (!pet || !getDefaultSchoolTicket(pet)) return;

      if (!state.selectedPetIds.has(petId)) {
        const defaultTicket = getDefaultSchoolTicket(pet);

        state.selectedPetIds.add(petId);
        if (defaultTicket) state.selectedTicketIdsByPetId.set(petId, defaultTicket.id);
        state.selectedDates.clear();
        render();
      }

      state.activeTicketPetId = petId;
      state.pendingTicketId = state.selectedTicketIdsByPetId.get(petId);
      renderTicketOptions();
      ticketSelectionSheet.hidden = false;
      ticketSelectionSheet.dataset.state = 'visible';
    }

    if (actionTarget.dataset.action === 'close-ticket-selection') {
      state.pendingTicketId = null;
      ticketSelectionSheet.hidden = true;
      ticketSelectionSheet.dataset.state = 'hidden';
    }

    if (actionTarget.dataset.action === 'select-ticket') {
      state.pendingTicketId = actionTarget.dataset.ticketId;
      renderTicketOptions();
    }

    if (actionTarget.dataset.action === 'confirm-ticket-selection') {
      const pet = pets.find((item) => item.id === state.activeTicketPetId);
      const selectedTicketId = state.pendingTicketId;

      if (!pet || !getAvailableSchoolTickets(pet).some((ticket) => ticket.id === selectedTicketId)) return;

      const previousTicketId = state.selectedTicketIdsByPetId.get(state.activeTicketPetId);

      state.selectedTicketIdsByPetId.set(state.activeTicketPetId, selectedTicketId);
      if (previousTicketId && previousTicketId !== selectedTicketId) state.selectedDates.clear();
      state.pendingTicketId = null;
      render();
      ticketSelectionSheet.hidden = true;
      ticketSelectionSheet.dataset.state = 'hidden';
    }

    if (actionTarget.dataset.action === 'previous-reservation-month') {
      if (state.displayedMonth <= new Date(today.getFullYear(), today.getMonth(), 1)) return;
      state.displayedMonth = new Date(state.displayedMonth.getFullYear(), state.displayedMonth.getMonth() - 1, 1);
      renderCalendar();
    }

    if (actionTarget.dataset.action === 'next-reservation-month') {
      state.displayedMonth = new Date(state.displayedMonth.getFullYear(), state.displayedMonth.getMonth() + 1, 1);
      renderCalendar();
    }

    if (actionTarget.dataset.action === 'toggle-reservation-date') {
      const { date } = actionTarget.dataset;

      if (state.selectedDates.has(date)) {
        state.selectedDates.delete(date);
      } else if (getRemainingLimit() > 0) {
        state.selectedDates.add(date);
      }

      render();
    }

    if (actionTarget.dataset.action === 'submit-reservation') {
      const result = createSchoolReservations({
        memberId: guardian?.id,
        petIds: [...state.selectedPetIds],
        ticketIdsByPetId: Object.fromEntries(state.selectedTicketIdsByPetId),
        dateKeys: [...state.selectedDates],
      });

      if (!result.ok) {
        await showAlert({ message: result.message });
        render();
        return;
      }

      const reservationCreatedAt = result.reservations[0]?.createdAt;

      window.location.assign(`./reservation-history-detail.html?createdAt=${encodeURIComponent(reservationCreatedAt)}&reservationCompleted=true`);
    }
  });

  render();
}
