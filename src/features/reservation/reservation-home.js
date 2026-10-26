import { getSchoolReservationData } from '../../storage/school-reservation-storage.js';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function isSameDay(firstDate, secondDate) {
  return toDateKey(firstDate) === toDateKey(secondDate);
}

function formatSelectedDate(date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`;
}

function formatMonth(date) {
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function createReservationHome(root) {
  const today = new Date();
  const state = {
    displayedMonth: new Date(today.getFullYear(), today.getMonth(), 1),
    selectedDate: today,
  };

  const monthLabel = root.querySelector('[data-field="month-label"]');
  const daysContainer = root.querySelector('[data-field="calendar-days"]');
  const selectedDateLabel = root.querySelector('[data-field="selected-date"]');
  const emptyMessage = root.querySelector('[data-field="empty-message"]');
  const reservationList = root.querySelector('[data-field="reservation-list"]');
  const cancellationToast = root.querySelector('[data-field="reservation-cancellation-toast"]');

  function showCancellationToast() {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get('reservationCancelled') !== 'true') return;

    cancellationToast.hidden = false;
    window.setTimeout(() => {
      cancellationToast.hidden = true;
    }, 3000);

    searchParams.delete('reservationCancelled');
    const query = searchParams.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }

  function renderReservationSummary() {
    const selectedDateKey = toDateKey(state.selectedDate);
    const { schoolReservationList } = getSchoolReservationData();
    const reservations = schoolReservationList.filter((reservation) => (
      reservation.status === '예약' && reservation.date === selectedDateKey
    ));

    emptyMessage.hidden = reservations.length > 0;
    reservationList.innerHTML = reservations.length > 0 ? `
      <a class="reservation-card" href="reservation-detail.html?date=${selectedDateKey}">
        <div class="reservation-card__heading">
          <span class="reservation-card__category" aria-hidden="true">
            <img src="assets/icons/iconSchool.svg" width="24" height="24" alt="">
          </span>
          <div class="reservation-card__info">
            <p class="reservation-card__category-label">유치원 예약</p>
            <p class="reservation-card__title">다이얼독 유치원</p>
          </div>
          <span class="reservation-card__chevron" aria-hidden="true">›</span>
        </div>
        <div class="reservation-card__counts">
          <p class="reservation-card__count">${reservations.length}마리</p>
        </div>
      </a>
    ` : '';
  }

  function renderCalendar() {
    const { displayedMonth, selectedDate } = state;
    const { schoolReservationList } = getSchoolReservationData();
    const reservedDateKeys = new Set(schoolReservationList.filter((reservation) => (
      reservation.status === '예약'
    )).map((reservation) => reservation.date));
    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    monthLabel.textContent = formatMonth(displayedMonth);
    selectedDateLabel.textContent = formatSelectedDate(selectedDate);
    renderReservationSummary();
    daysContainer.innerHTML = '';

    for (let blankIndex = 0; blankIndex < firstWeekday; blankIndex += 1) {
      const blankCell = document.createElement('span');
      blankCell.className = 'calendar__empty-cell';
      blankCell.setAttribute('aria-hidden', 'true');
      daysContainer.append(blankCell);
    }

    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(year, month, day);
      const dateButton = document.createElement('button');
      const isSelected = isSameDay(date, selectedDate);
      const dateKey = toDateKey(date);
      const hasReservation = reservedDateKeys.has(dateKey);

      dateButton.className = 'calendar__day';
      dateButton.type = 'button';
      dateButton.dataset.action = 'select-date';
      dateButton.dataset.date = dateKey;
      dateButton.setAttribute('role', 'gridcell');
      dateButton.setAttribute('aria-label', `${formatSelectedDate(date)}${hasReservation ? ', 예약 있음' : ''}`);
      dateButton.setAttribute('aria-selected', String(isSelected));
      dateButton.innerHTML = `<span class="calendar__day-number">${day}</span>${hasReservation ? '<span class="calendar__reservation-dot" aria-hidden="true"></span>' : ''}`;

      if (isSelected) {
        dateButton.classList.add('calendar__day--selected');
      }

      if (isSameDay(date, today)) {
        dateButton.classList.add('calendar__day--today');
      }

      daysContainer.append(dateButton);
    }
  }

  root.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');

    if (!actionTarget) {
      return;
    }

    if (actionTarget.dataset.action === 'previous-month') {
      state.displayedMonth = new Date(state.displayedMonth.getFullYear(), state.displayedMonth.getMonth() - 1, 1);
      renderCalendar();
    }

    if (actionTarget.dataset.action === 'next-month') {
      state.displayedMonth = new Date(state.displayedMonth.getFullYear(), state.displayedMonth.getMonth() + 1, 1);
      renderCalendar();
    }

    if (actionTarget.dataset.action === 'select-date') {
      const [year, month, day] = actionTarget.dataset.date.split('-').map(Number);
      state.selectedDate = new Date(year, month - 1, day);
      renderCalendar();
    }
  });

  renderCalendar();
  showCancellationToast();
}
