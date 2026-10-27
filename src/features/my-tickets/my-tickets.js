import { getStoredMembers } from '../../storage/member-storage.js';
import { getPetReservableCount, getSchoolTickets, getTicketReservableCount, getSchoolTicketValidityLabel, getSchoolTicketState } from '../../services/school-ticket.js';

const PROFILE_IMAGE_BY_PET_ID = {
  'pet-bori': 'assets/images/defaultProfile_dog.svg',
};

function getPetImage(pet) {
  return PROFILE_IMAGE_BY_PET_ID[pet.id] ?? 'assets/images/defaultProfile_dog.svg';
}

function getSchoolReservableCount(pet) {
  return getPetReservableCount(pet);
}

function createTicketCard(pet, ticket) {
  const remaining = getTicketReservableCount(ticket);
  const { state, label } = getSchoolTicketState(ticket);

  return `
    <button class="ticket-card surface-card" type="button" data-action="open-ticket-history" data-entity-id="${pet.id}" data-ticket-id="${ticket.id}" data-state="${state}">
      <p class="ticket-card__state">${label}</p>
      <h4 class="ticket-card__name">${ticket.name}</h4>
      <div class="ticket-card__metadata">
        <p class="ticket-card__meta">잔여 : ${remaining}회</p>
        <p class="ticket-card__validity">${getSchoolTicketValidityLabel(ticket)}</p>
      </div>
      <span class="ticket-card__chevron" aria-hidden="true">›</span>
    </button>
  `;
}

export function createMyTickets(root) {
  const petList = root.querySelector('[data-field="pet-list"]');
  const businessList = root.querySelector('[data-field="business-list"]');
  const emptyMessage = root.querySelector('[data-field="empty-message"]');
  const [guardian] = getStoredMembers();
  const pets = guardian?.pets ?? [];
  let selectedPetId = pets[0]?.id ?? null;
  let isBusinessExpanded = false;

  function render() {
    const selectedPet = pets.find((pet) => pet.id === selectedPetId);

    emptyMessage.hidden = pets.length > 0;
    petList.innerHTML = pets.map((pet) => {
      const isSelected = pet.id === selectedPetId;

      return `
        <button class="my-tickets-pet-selector__item surface-card${isSelected ? ' surface-card--selected my-tickets-pet-selector__item--selected' : ''}" type="button" data-action="select-pet" data-entity-id="${pet.id}" role="radio" aria-checked="${isSelected}">
          <span class="my-tickets-pet-selector__check" aria-hidden="true"></span>
          <img class="my-tickets-pet-selector__image" src="${getPetImage(pet)}" alt="" />
          <strong class="my-tickets-pet-selector__name">${pet.petName}</strong>
        </button>
      `;
    }).join('');

    businessList.innerHTML = selectedPet ? `
      <section class="my-tickets-business" data-entity-id="dialdog-kindergarten" data-state="${isBusinessExpanded ? 'expanded' : 'collapsed'}">
        <button class="my-tickets-business__toggle" type="button" data-action="toggle-business" aria-expanded="${isBusinessExpanded}" aria-controls="dialdog-ticket-list">
        <h3 class="my-tickets-business__name">다이얼독 유치원</h3>
        <p class="my-tickets-business__remaining"><strong>${getSchoolReservableCount(selectedPet)}회 남음</strong></p>
        <img class="my-tickets-business__chevron" src="assets/icons/iconDropdown.svg" alt="" aria-hidden="true" />
        </button>
        <div class="my-tickets-business__tickets" id="dialdog-ticket-list" ${isBusinessExpanded ? '' : 'hidden'}>
          ${getSchoolTickets(selectedPet).map((ticket) => createTicketCard(selectedPet, ticket)).join('')}
        </div>
      </section>
    ` : '';
  }

  root.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');

    if (actionTarget?.dataset.action === 'go-back') {
      window.location.assign('./more.html');
    }

    if (actionTarget?.dataset.action === 'select-pet') {
      selectedPetId = actionTarget.dataset.entityId;
      isBusinessExpanded = false;
      render();
    }

    if (actionTarget?.dataset.action === 'toggle-business') {
      isBusinessExpanded = !isBusinessExpanded;
      render();
    }

    if (actionTarget?.dataset.action === 'open-ticket-history') {
      window.location.assign(`./ticket-history.html?petId=${encodeURIComponent(actionTarget.dataset.entityId)}&ticketId=${encodeURIComponent(actionTarget.dataset.ticketId)}`);
    }
  });

  render();
}
