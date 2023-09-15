import { ProcessedMail } from "./mail";
import { UserGithubSetting } from "./userGithubSetting";
import { ProcessedUserReservation, UserReservation } from "./userReservation";
import { ProcessedUserReservationSetting, UserReservationSetting } from "./userReservationSetting";
import { UserTier } from "./userTier";
import { Webhook } from "./webhook";

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
    reservations?: ProcessedUserReservation[];
    reservationSettings?: ProcessedUserReservationSetting[];
    webhooks?: Webhook[];
    githubSettings?: UserGithubSetting[];
}

export type PublicUser = {
    id: number;
    username: string;
    display_name: string;
    profile_picture?: string;
    facebook: string;
    instagram: string;
    twitter: string;
    twitch: string;
    tiktok: string;
    youtube: string;
    calendar_advance_days: number;
    tiers?: UserTier[];
}

export const fillableColumns = [
    'id',
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