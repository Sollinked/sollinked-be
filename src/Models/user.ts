import { UserTier } from "./userTier";

export type User = {
    id: number;
    address: string;
    username: string;
    email_address?: string;
    tiers?: UserTier[];
}

export const fillableColumns = [
    'address',
    'username',
    'email_address',
];