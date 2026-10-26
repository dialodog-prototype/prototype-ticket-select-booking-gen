import { getStoredMembers } from '../../storage/member-storage.js';
import { getSchoolReservationData } from '../../storage/school-reservation-storage.js';
import { getSchoolTicket, getSchoolTickets, getSchoolTicketRoundLabel, getTicketReservableCount } from '../../services/school-ticket.js';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const START_DATE_POLICY_LABELS = {
  'issued-date': '지급일',
  'first-attendance': '등원일',
  'first-reservation': '첫 예약일',
};

function formatValidity(ticket) {
  if (ticket.unlimitedValidity) return '무제한';
  if (ticket.validity != null && ticket.unit) return `${ticket.validity}${ticket.unit}`;

  return ticket.validityDays != null ? `${ticket.validityDays}일` : '-';
}

function formatDate(dateKey, { includeWeekday = true } = {}) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '-';

  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '-';

  const dateLabel = `${year}년 ${month}월 ${day}일`;

  return includeWeekday ? `${dateLabel} (${WEEKDAY_LABELS[date.getDay()]})` : dateLabel;
}

function formatPrice(price) {
  return `${Number(price ?? 0).toLocaleString('ko-KR')}원`;
}

export function createTicketHistory(root) {
  const ticketName = root.querySelector('[data-field="ticket-name"]');
  const ticketMeta = root.querySelector('[data-field="ticket-meta"]');
  const availabilityNotice = root.querySelector('[data-field="availability-notice"]');
  const businessName = root.querySelector('[data-field="business-name"]');
  const issuedDate = root.querySelector('[data-field="issued-date"]');
  const startDate = root.querySelector('[data-field="start-date"]');
  const expiryDate = root.querySelector('[data-field="expiry-date"]');
  const reservationDateRange = root.querySelector('[data-field="reservation-date-range"]');
  const usageList = root.querySelector('[data-field="usage-list"]');
  const requestedPetId = new URLSearchParams(window.location.search).get('petId');
  const requestedTicketId = new URLSearchParams(window.location.search).get('ticketId');
  const [guardian] = getStoredMembers();
  const pet = guardian?.pets.find((item) => item.id === requestedPetId) ?? guardian?.pets[0];
  const ticket = pet
    ? getSchoolTicket(pet, requestedTicketId) ?? getSchoolTickets(pet)[0]
    : null;

  function render() {
    if (!pet || !ticket) {
      availabilityNotice.textContent = '이용권 정보를 찾을 수 없습니다.';
      usageList.innerHTML = '<p class="ticket-usage__empty empty-state">사용 내역이 없습니다.</p>';
      return;
    }

    const remaining = getTicketReservableCount(ticket);
    const ticketState = remaining > 0 ? '이용 중' : '횟수 소진';
    const startDateLabel = formatDate(ticket.startDate, { includeWeekday: false });
    const { schoolReservationList } = getSchoolReservationData();
    const usageHistory = schoolReservationList
      .filter((reservation) => (
        reservation.memberId === guardian.id
        && reservation.petId === pet.id
        && reservation.ticketId === ticket.id
      ))
      .sort((left, right) => right.date.localeCompare(left.date));

    availabilityNotice.textContent = `[${ticketState}] 예약 가능 ${remaining}회`;
    availabilityNotice.dataset.state = remaining <= 2 ? 'low' : 'available';
    businessName.textContent = ticket.businessName ?? '다이얼독 유치원';
    ticketName.textContent = ticket.name;
    ticketMeta.textContent = `${ticket.totalCount}회 / ${formatValidity(ticket)} / ${formatPrice(ticket.price)}`;

    issuedDate.textContent = formatDate(ticket.issuedDate, { includeWeekday: false });
    const startDatePolicy = START_DATE_POLICY_LABELS[ticket.startDatePolicy];
    startDate.textContent = startDatePolicy ? `${startDateLabel} (${startDatePolicy})` : startDateLabel;
    expiryDate.textContent = formatDate(ticket.expiryDate, { includeWeekday: false });
    reservationDateRange.textContent = ticket.reservationDateRule === 'expiry'
      ? '개시일 이후 ~ 만료일'
      : ticket.reservationDateRule === 'no-limit' ? '개시일 이후 ~ 제한 없음' : '-';

    usageList.innerHTML = usageHistory.length ? usageHistory.map((reservation) => {
      const roundLabel = getSchoolTicketRoundLabel(reservation, schoolReservationList, ticket, { includeTotal: false });

      return `
        <article class="ticket-usage-item surface-card" data-state="${reservation.status === '취소' ? 'cancelled' : 'confirmed'}">
          <strong class="ticket-usage-item__business">${reservation.businessName ?? businessName.textContent}</strong>
          <span class="ticket-usage-item__date">${formatDate(reservation.date)}</span>
          ${roundLabel ? `<span class="ticket-usage-item__round">${roundLabel}</span>` : ''}
          ${reservation.status === '취소' ? '<span class="ticket-usage-item__state">취소</span>' : ''}
        </article>
      `;
    }).join('') : '<p class="ticket-usage__empty empty-state">사용 내역이 없습니다.</p>';
  }

  root.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');

    if (actionTarget?.dataset.action === 'go-back') window.location.assign('./my-tickets.html');
  });

  render();
}
