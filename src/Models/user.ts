import { ProcessedMail } from "./mail";
import { UserReservation } from "./userReservation";
import { UserReservationSetting } from "./userReservationSetting";
import { UserTier } from "./userTier";

export type User = {
    id: number;
    address: string;
    username: string;
    calendar_advance_days: number;
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
    mails?: ProcessedMail[];
    reservations?: UserReservation[];
    reservationSettings?: UserReservationSetting[];
}

export const fillableColumns = [
    'address',
    'username',
    'display_name',
    'profile_picture',
    'email_address',
    'facebook',
    'twitter',
    'twitch',
    'instagram',
    'tiktok',
    'youtube',
    'calendar_advance_days',
];