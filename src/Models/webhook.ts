export type WebhookType = "discord" | "custom";
export type WebhookStatus = "active" | "inactive";
export type Webhook = {
    user_id: number;
    type: WebhookType;
    value: string;
    template: string;
    status: WebhookStatus;
    created_at: string;
    updated_at: string;
}

export type WebhookExecuteParams = {
    payer: string; // email
    amount: number | string;
    expiry_date?: string; // mail
    bcc_to?: string; // mail
    reserve_date?: string; // reservations
    reserve_title?: string; // reservations
}

export const fillableColumns = [
    'user_id',
    'type',
    'value',
    'template',
    'status',
    'created_at',
    'updated_at',
]