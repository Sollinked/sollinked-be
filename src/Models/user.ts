import { Mail } from "./mail";
import { UserTier } from "./userTier";

export type User = {
    id: number;
    address: string;
    username: string;
    display_name?: string;
    profile_picture?: string;
    email_address?: string;
    facebook?: string;
    twitter?: string;
    twitch?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    tiers?: UserTier[];
    mails?: Mail[];
}

export const fillableColumns = [
    'address',
    'username',
    'display_name',
    'email_address',
    'facebook',
    'twitter',
    'twitch',
    'instagram',
    'tiktok',
    'youtube',
];