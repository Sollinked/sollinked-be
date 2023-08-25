export type ProfileTier = {
    id: number;
    profile_id: number;
    value_usd: number;
    respond_days: number;
}

export const fillableColumns = [
    'profile_id',
    'value_usd',
    'respond_days',
];