import { PublicKey } from "@solana/web3.js";

export type NftMintDetails = {
    mintTo: PublicKey;
    whichCollection: string; // load which keypair
    name: string;
    symbol: string;
    uri: string;
}

export type MetaplexTrait = {
    trait_type: string;
    value: string;
}

export type MetaplexProperties = {
    files: {
        uri: string;
        type: string;
        cdn?: boolean;
    }[];
    category: string;
}

export type MetaplexStandard = {
    name: string;
    symbol: string;
    description: string;
    image: string;
    animation_url?: string;
    external_url?: string;
    attributes: MetaplexTrait[];
    properties?: MetaplexProperties;
}