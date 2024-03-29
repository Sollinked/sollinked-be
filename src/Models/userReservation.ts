export type UserReservation= {
    id: number;
    date: string;
    user_id: number;
    reservation_price?: string;
    reserve_email?: string;
    reserved_at?: string;
    reserve_title?: string;
    tiplink_url?: string;
    tiplink_public_key?: string;
    value_usd?: string;
    status: number;
    uuid?: string;
}

export type ProcessedUserReservation= {
    id: number;
    date: string;
    user_id: number;
    reservation_price?: number;
    reserve_email?: string;
    reserved_at?: string;
    reserve_title?: string;
    tiplink_url?: string;
    tiplink_public_key?: string;
    value_usd?: number;
    status: number;
    uuid?: string;
}

export const fillableColumns = [
    'user_id',
    'date',
    'reservation_price',
    'reserve_email',
    'reserved_at',
    'reserve_title',
    'tiplink_url',
    'tiplink_public_key',
    'value_usd',
    'status',
    'uuid',
];