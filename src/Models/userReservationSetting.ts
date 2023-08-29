export type UserReservationSetting = {
    id: number;
    user_id: number;
    day: number;
    hour: number;
    reservation_price: string;
}

export const fillableColumns = [
    'user_id',
    'day',
    'hour',
    'reservation_price',
];