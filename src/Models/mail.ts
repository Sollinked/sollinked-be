export type Mail = {
    key: number;
    user_id: number;
    from_email: string;
    to_email: string;
    message_id: string;
    tiplink_url: string;
    tiplink_public_key: string;
    is_processed: boolean;
    has_responded: boolean;
    created_at: string;
    processed_at?: string;
    value_usd?: number;
    expiry_date?: string;
    tier_name?: string;
}

export const fillableColumns = [
    'id',
    'user_id',
    'from_email',
    'to_email',
    'message_id',
    'tiplink_url',
    'tiplink_public_key',
    'is_processed',
    'has_responded',
    'created_at',
    'processed_at',
];