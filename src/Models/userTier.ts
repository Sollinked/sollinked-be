export type UserTier = {
    id: number;
    user_id: number;
    value_usd: string;
    respond_days: number;
}

export const fillableColumns = [
    'user_id',
    'value_usd',
    'respond_days',
];