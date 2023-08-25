import { ProfileTier } from "./profileTier";

export type Profile = {
    id: number;
    address: string;
    username: string;
    email_address?: string;
    tiers?: ProfileTier[];
}

export const fillableColumns = [
    'address',
    'username',
    'email_address',
];