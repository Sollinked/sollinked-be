export type UserReservationSetting = {
    id: number;
    user_id: number;
    day: number;
    hour: number;
    reservation_price: string;
}

export type ProcessedUserReservationSetting = {
    id: number;
    user_id: number;
    day: number;
    hour: number;
    reservation_price: number;
}

// day and hour are stored in utc form
export const fillableColumns = [
    'user_id',
    'day',
    'hour',
    'reservation_price',
];