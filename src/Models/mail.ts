export type Mail = {
    id: number;
    from: string;
    to: string;
    message_id: string;
    tiplink_url: string;
    tiplink_public_key: string;
}

export const fillableColumns = [
    'from_email',
    'to_email',
    'message_id',
    'tiplink_url',
    'tiplink_public_key',
];