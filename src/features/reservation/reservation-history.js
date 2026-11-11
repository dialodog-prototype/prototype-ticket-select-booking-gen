import { getStoredMembers } from '../../storage/member-storage.js';
import { getSchoolReservationData } from '../../storage/school-reservation-storage.js';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatReservationDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return `${String(year).slice(2)}. ${month}. ${day}(${WEEKDAY_LABELS[date.getDay()]}) 예약`;
}

function formatPetReservationDates(reservations) {
  const createdAt = new Date(reservations[0].createdAt);
  const dateKey = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}-${createdAt.getDate()}`;

  return formatReservationDate(dateKey);
}

function getStatusInfo(status) {
  return status === '취소'
    ? { label: '예약 취소', state: 'cancelled' }
    : { label: '예약 확정', state: 'confirmed' };
}

function getPetGroupStatusInfo(reservations) {
  const isCancelled = reservations.every((reservation) => reservation.status === '취소');

  return getStatusInfo(isCancelled ? '취소' : '예약');
}

export function createReservationHistory(root) {
  const groupsContainer = root.querySelector('[data-field="reservation-groups"]');
  const emptyMessage = root.querySelector('[data-field="empty-message"]');

  function render() {
    const [guardian] = getStoredMembers();
    const { schoolReservationList } = getSchoolReservationData();
    const reservations = schoolReservationList
      .filter((reservation) => reservation.memberId === guardian?.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const groups = new Map();

    reservations.forEach((reservation) => {
      const reservationGroupId = reservation.createdAt;
      const group = groups.get(reservationGroupId) ?? {
        id: reservationGroupId,
        reservations: [],
      };

      group.reservations.push(reservation);
      groups.set(reservationGroupId, group);
    });

    emptyMessage.hidden = reservations.length > 0;
    groupsContainer.innerHTML = [...groups.values()]
      .map((group) => `
      <section class="reservation-group" data-action="open-reservation-detail" data-entity-id="${group.id}" tabindex="0" role="button" aria-label="예약 상세 보기">
        ${createPetGroups(group.reservations)}
      </section>
    `).join('');
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="go-back"]')) window.location.assign('./more.html');

    const reservationGroup = event.target.closest('[data-action="open-reservation-detail"]');

    if (reservationGroup) {
      window.location.assign(`./reservation-history-detail.html?createdAt=${encodeURIComponent(reservationGroup.dataset.entityId)}`);
    }
  });

  root.addEventListener('keydown', (event) => {
    const reservationGroup = event.target.closest('[data-action="open-reservation-detail"]');

    if (reservationGroup && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      reservationGroup.click();
    }
  });

  render();
}

function createPetGroups(reservations) {
  const petGroups = new Map();

  reservations.forEach((reservation) => {
    const petGroupId = reservation.petId ?? reservation.petName;
    const petGroup = petGroups.get(petGroupId) ?? { id: petGroupId, reservations: [] };

    petGroup.reservations.push(reservation);
    petGroups.set(petGroupId, petGroup);
  });

  return [...petGroups.values()].map((petGroup) => {
    const { label, state } = getPetGroupStatusInfo(petGroup.reservations);
    const pet = petGroup.reservations[0];

    return `
      <section class="reservation-pet-group reservation-pet-group--${state}" data-entity-id="${petGroup.id}" aria-label="${label}">
        <h2 class="reservation-pet-group__title">${label}</h2>
        <div class="reservation-pet-group__list">
          <article class="reservation-summary-item" data-entity-id="${petGroup.id}">
            <img class="reservation-summary-item__avatar" src="assets/images/defaultProfile_dog.svg" alt="" />
            <div class="reservation-summary-item__content">
              <p class="reservation-summary-item__date">${formatPetReservationDates(petGroup.reservations)}</p>
              <p class="reservation-summary-item__type">다이얼독 유치원</p>
              <strong class="reservation-summary-item__pet-name">${pet.petName}</strong>
            </div>
          </article>
        </div>
      </section>
    `;
  }).join('');
}
