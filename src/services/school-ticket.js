function getLegacySchoolTicket(pet) {
  const reservableCount = Number(pet.totalReservableCountByType?.school ?? 0);

  return {
    id: `legacy-school-ticket-${pet.id}`,
    name: pet.ticketName ?? '유치원 이용권',
    reservableCount,
    ...pet.schoolTicket,
  };
}

export function getSchoolTickets(pet) {
  return Array.isArray(pet.schoolTickets)
    ? pet.schoolTickets
    : [getLegacySchoolTicket(pet)];
}

function getDateSortValue(dateValue) {
  const timestamp = Date.parse(dateValue ?? '');

  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function getValiditySortValue(ticket) {
  const validityDays = Number(ticket.validityDays);

  return Number.isFinite(validityDays) ? validityDays : Number.POSITIVE_INFINITY;
}

export function getDefaultSchoolTicket(pet) {
  return getSchoolTickets(pet)
    .filter((ticket) => getTicketReservableCount(ticket) > 0)
    .sort((left, right) => {
      const stateDifference = Number(Boolean(left.expiryDate)) - Number(Boolean(right.expiryDate));

      if (stateDifference !== 0) return -stateDifference;

      const leftExpiryDate = getDateSortValue(left.expiryDate);
      const rightExpiryDate = getDateSortValue(right.expiryDate);

      if (leftExpiryDate < rightExpiryDate) return -1;
      if (leftExpiryDate > rightExpiryDate) return 1;

      return getValiditySortValue(left) - getValiditySortValue(right);
    })[0] ?? null;
}

export function getTicketReservableCount(ticket) {
  return Math.max(0, Number(ticket?.reservableCount ?? 0));
}

function getDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function getSchoolTicketDates(ticket, { firstReservationDate, firstAttendanceDate } = {}) {
  const startDate = ticket.startDate || {
    'issued-date': ticket.issuedDate,
    'first-reservation': firstReservationDate,
    'first-attendance': firstAttendanceDate,
  }[ticket.startDatePolicy] || null;

  if (ticket.unlimitedValidity) return { startDate, expiryDate: null };
  if (ticket.expiryDate) return { startDate, expiryDate: ticket.expiryDate };

  const validityDays = Number(ticket.validityDays ?? (ticket.unit === '주' ? ticket.validity * 7 : ticket.validity));
  if (!startDate || !Number.isInteger(validityDays) || validityDays <= 0) return { startDate, expiryDate: null };

  const [year, month, day] = startDate.split('-').map(Number);
  const expiryDate = new Date(year, month - 1, day);
  // The start date counts as day one of the validity period.
  expiryDate.setDate(expiryDate.getDate() + validityDays - 1);
  return { startDate, expiryDate: getDateKey(expiryDate) };
}

export function getSchoolTicketState(ticket, today = new Date()) {
  const todayKey = getDateKey(today);
  if (ticket.hasOnlyCancelledReservations) return { state: 'upcoming', label: '사용 전' };
  if (!ticket.unlimitedValidity && ticket.expiryDate && ticket.expiryDate < todayKey) return { state: 'expired', label: '만료' };
  if (getTicketReservableCount(ticket) === 0) return { state: 'exhausted', label: '횟수 소진' };
  if (!ticket.startDate) return { state: 'upcoming', label: '사용 전' };
  return { state: 'active', label: '사용 중' };
}

export function getSchoolTicketLifecycle(ticket, reservations) {
  const activeReservations = reservations.filter((reservation) => reservation.status !== '취소');
  // First reservation means the creation date, not the scheduled booking date.
  const firstCreatedAt = reservations.map((reservation) => reservation.createdAt).filter(Boolean).sort()[0];
  const firstReservationDate = firstCreatedAt ? getDateKey(new Date(firstCreatedAt)) : null;
  // A first-attendance ticket records its scheduled booking date even before that date arrives.
  const firstAttendanceDate = activeReservations
    .map((reservation) => reservation.bookingDate ?? reservation.date)
    .filter(Boolean)
    .sort()[0];
  const dates = getSchoolTicketDates(ticket, { firstReservationDate, firstAttendanceDate });

  return {
    ...ticket,
    ...dates,
    // Cancellation preserves the original dates; cancelling every reservation resets only the state.
    hasOnlyCancelledReservations: reservations.length > 0 && activeReservations.length === 0,
  };
}

export function getSchoolTicketValidityLabel(ticket, today = new Date()) {
  if (ticket.unlimitedValidity) return '유효기간 : 무제한';

  if (typeof ticket.expiryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ticket.expiryDate)) {
    const [year, month, day] = ticket.expiryDate.split('-').map(Number);
    const expiryDate = new Date(Date.UTC(year, month - 1, day));

    if (expiryDate.getUTCFullYear() === year && expiryDate.getUTCMonth() === month - 1 && expiryDate.getUTCDate() === day) {
      const todayTimestamp = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const remainingDays = Math.max(0, Math.round((expiryDate.getTime() - todayTimestamp) / 86400000));

      return `만료일 : ${remainingDays}일 남음`;
    }
  }

  if (ticket.validity != null && ticket.unit) return `유효기간 : ${ticket.validity}${ticket.unit}`;
  if (ticket.validityDays != null) return `유효기간 : ${ticket.validityDays}일`;

  return '유효기간 : -';
}

export function getSchoolTicket(pet, ticketId) {
  return getSchoolTickets(pet).find((ticket) => ticket.id === ticketId) ?? null;
}

export function getSchoolTicketRoundLabel(reservation, schoolReservationList, ticket, { includeTotal = true } = {}) {
  if (!reservation.ticketId || reservation.status === '취소') return null;

  const ticketReservations = schoolReservationList
    .filter((item) => item.status === '예약' && item.petId === reservation.petId && item.ticketId === reservation.ticketId)
    .sort((left, right) => (
      left.date.localeCompare(right.date)
      || left.createdAt.localeCompare(right.createdAt)
      || left.id.localeCompare(right.id)
    ));
  const round = ticketReservations.findIndex((item) => item.id === reservation.id) + 1;
  if (!includeTotal) return round > 0 ? `${round}회차` : null;

  const totalCount = Number(
    reservation.ticketTotalCount
    ?? reservation.ticketSnapshot?.totalCount
    ?? ticket?.totalCount,
  );

  return round > 0 && Number.isFinite(totalCount) && totalCount > 0
    ? `${round}/${totalCount}회차`
    : null;
}

export function getPetReservableCount(pet) {
  return getSchoolTickets(pet)
    .reduce((total, ticket) => total + getTicketReservableCount(ticket), 0);
}
