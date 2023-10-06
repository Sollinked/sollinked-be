import dotenv from 'dotenv';
import moment from 'moment';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env')});
import crypto from "crypto";
import DB from './src/DB';
import { Connection, GetProgramAccountsFilter, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, clusterApiUrl, sendAndConfirmRawTransaction, sendAndConfirmTransaction } from '@solana/web3.js';
import dayjs, { OpUnitType } from 'dayjs';
import _ from 'lodash';
import { loadOrGenerateKeypair, loadPublicKeysFromFile } from './src/Helpers';
import { v4 as uuidv4 } from 'uuid'; 
import { WrapperConnection } from './src/ReadAPI';
import { base58, base64 } from 'ethers/lib/utils';
import { createTransferCompressedNftInstruction } from './src/NFT/Transfer';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import axios from 'axios';
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

export function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(true);
        }, ms);
    });
}

/**
 * Returns the number with 'en' locale settings, ie 1,000
 * @param x number
 * @param minDecimal number
 * @param maxDecimal number
 */
 export function toLocaleDecimal(x: string | number, minDecimal: number, maxDecimal: number) {
    x = Number(x);
    return x.toLocaleString('en', {
        minimumFractionDigits: minDecimal,
        maximumFractionDigits: maxDecimal,
    });
}

/**
 * Runs the function if it's a function, returns the result or undefined
 * @param fn
 * @param args
 */
export const runIfFunction = (fn: any, ...args: any): any | undefined => {
    if(typeof(fn) == 'function'){
        return fn(...args);
    }

    return undefined;
}

/**
 * Returns the ellipsized version of string
 * @param x string
 * @param leftCharLength number
 * @param rightCharLength number
 */
export function ellipsizeThis(x: string, leftCharLength: number, rightCharLength: number) {
    if(!x) {
        return x;
    }

    let totalLength = leftCharLength + rightCharLength;

    if(totalLength >= x.length) {
        return x;
    }

    return x.substring(0, leftCharLength) + "..." + x.substring(x.length - rightCharLength, x.length);
}

/**
 * Returns the new object that has no reference to the old object to avoid mutations.
 * @param obj
 */
export const cloneObj = <T = any>(obj: {[key: string]: any}) => {
    return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * @returns string
 */
export const getRandomColor = () => {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

export const getRandomNumber = (min: number, max: number, isInteger = false) => {
    let rand = min + (Math.random() * (max - min));
    if(isInteger) {
        rand = Math.round(rand);
    }

    else {
        // to 3 decimals
        rand = Math.floor(rand * 1000) / 1000;
    }

    return rand;
}

export const getRandomChance = () => {
    return getRandomNumber(0, 100);
}

export const getRandomNumberAsString = (min: number, max: number, isInteger = false) => {
    return getRandomNumber(min, max, isInteger).toString();
}

export const getRandomChanceAsString = () => {
    return getRandomNumberAsString(0, 100);
}

export const getUTCMoment = () => {
    return moment().utc();
}

export const getUTCDatetime = () => {
    return getUTCMoment().format('YYYY-MM-DD HH:mm:ss');
}

export const getUTCDate = () => {
    return getUTCMoment().format('YYYY-MM-DD');
}

export const isProduction = () => {
    return process.env.ENVIRONMENT === "production" || !process.env.ENVIRONMENT;
}

export const getDbConfig = () => {
    const DB_USER = process.env.DB_USER ?? "";
    const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
    const DB_HOST = process.env.DB_HOST ?? "";
    const DB_PORT = process.env.DB_PORT ?? "5432";
    const DB_NAME = process.env.DB_NAME ?? "";

    return {
        user: DB_USER,
        password: DB_PASSWORD,
        host: DB_HOST,
        port: parseInt(DB_PORT),
        database: DB_NAME,
    };
}

export const getRPCEndpoint = (): string => {
    return process.env.RPC_URL? process.env.RPC_URL : clusterApiUrl("devnet");
}

export const getAdminAccount = () => {
    return Keypair.fromSecretKey(base58.decode(process.env.SECRET_KEY!));
}

export const _getAdminAccount = (): Keypair => {
    return loadOrGenerateKeypair("Admin");
}

export //get associated token accounts that stores the SPL tokens
const getTokenAccounts = async(connection: Connection, address: string) => {
  try {
    const filters: GetProgramAccountsFilter[] = [
        {
          dataSize: 165,    //size of account (bytes), this is a constant
        },
        {
          memcmp: {
            offset: 32,     //location of our query in the account (bytes)
            bytes: address,  //our search criteria, a base58 encoded string
          },            
        }];

    const accounts = await connection.getParsedProgramAccounts(
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), //Associated Tokens Program
        {filters: filters}
    );

    /* accounts.forEach((account, i) => {
        //Parse the account data
        const parsedAccountInfo:any = account.account.data;
        const mintAddress:string = parsedAccountInfo["parsed"]["info"]["mint"];
        const tokenBalance: number = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
        //Log results
        console.log(`Token Account No. ${i + 1}: ${account.pubkey.toString()}`);
        console.log(`--Token Mint: ${mintAddress}`);
        console.log(`--Token Balance: ${tokenBalance}`);
    }); */
    return accounts;
  }

  catch {
    return [];
  }
};

export const getInsertQuery = (columns: string[], values: any[][], table: string, returnId: boolean = false, schema: string = "public") => {
    let columnString = columns.join(",");
    let valueString = "";

    for(let value of values) {
        valueString +=  "(";
        for(let content of value) {
            if(typeof content === "string") {
                valueString += `'${content}'`;

            }

            else {
                valueString += `${content}`;
            }

            valueString += ",";
        }
        //remove last comma
        valueString = valueString.substring(0, valueString.length - 1);
        valueString += "),";
    }

    //remove last comma
    valueString = valueString.substring(0, valueString.length - 1);

    let query = `INSERT INTO ${schema}.${table} (${columnString}) VALUES ${valueString}`;
    if(returnId) {
        query += ' RETURNING id';
    }
    query += ';';
    return query;
}

export const getHash = (string: string): string => {
    const hash = crypto.createHash('md5').update(string).digest("hex")
    return hash;
}

/**
 * Generate crypto safe random number
 * @date 2022-10-01
 * @param { number } min
 * @param { number } max
 * @returns { number }
 */
export const getRandomIntInclusive = (min: number, max: number): number => {
    const randomBuffer = new Uint32Array(1);
    crypto.webcrypto.getRandomValues(randomBuffer);

    let randomNumber = randomBuffer[0] / (0xffffffff + 1);

    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(randomNumber * (max - min + 1)) + min;
}

export const generateRandomNumberChar = (min: number, max: number): string => {
    const charLength = getRandomIntInclusive(min, max)
    let numStr = '';

    for (let index = 0; index < charLength; index++) {
        numStr += index === 0 ? getRandomIntInclusive(1, 9).toString() : getRandomIntInclusive(0, 9).toString();
    }
    return numStr;
}

// check if the uuid is valid as sanitization
export const isValidUUID = (uuid: string) => {
    return (uuid.match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)?.length ?? 0) > 0;
}

export const isCurrentUserAdmin = async(discord_id: string) => {
    let db = new DB();
    let query = `select count(*) as admin_count from admins where discord_id = '${discord_id}'`;
    let result = await db.executeQueryForSingleResult<{ admin_count: number }>(query);
    return result !== undefined && result.admin_count > 0;
}


/**
 * Use to construct postgres insert, where, select columns / values query
 * @param { {
    [key : string]: any
} } params
 * @param { * } parm2
 * @param { * } parm3
 */
export const formatDBParamsToStr = (params : {
    [key : string]: any
}, options?: {
    separator?: string;
    valueOnly?: boolean;
    prepend?: string; 
    shouldLower?: boolean;
    isSearch?: boolean;
}) => {
    let stringParams: string[] = [];
    let separator = options?.separator ?? ", ";
    let valueOnly = options?.valueOnly ?? false;
    let prepend = options?.prepend ?? "";
    let shouldLower = options?.shouldLower ?? false;
    let isSearch = options?.isSearch ?? false;

    _.map(params, (p, k) => {
        const isString = typeof p === 'string';
        const value = isString ? `'${p.replace(/'/g, "''")}'` : p;

        if(isString && shouldLower) {
            if (valueOnly) {
                stringParams.push(`lower(${prepend? prepend + "." : ""}${value})`);
            } else {
                stringParams.push(`lower(${prepend? prepend + "." : ""}${k}) = lower(${value})`);
            }
        }

        else if(Array.isArray(p)) {
            let arrayVal = "'{}'";
            if(p.length > 0) {
                arrayVal = `'${JSON.stringify(p).replace(/^\[/, '{"').replace(/]$/, '"}').replace(",", '","')}'`;
            }
            if (valueOnly) {
                stringParams.push(`${prepend? prepend + "." : ""}${arrayVal}`);
            }
            
            else if(isSearch) {
                stringParams.push(`${prepend? prepend + "." : ""}${k} = ANY(${arrayVal})`);
            }
            
            else {
                stringParams.push(`${prepend? prepend + "." : ""}${k} = ${arrayVal}`);
            }
        }

        else {
            if (valueOnly) {
                stringParams.push(`${prepend? prepend + "." : ""}${value}`);
            } else {
                stringParams.push(`${prepend? prepend + "." : ""}${k} = ${value}`);
            }
        }
    })

    return _.join(stringParams, separator);
}

/*
* Use to construct postgres where params with custom condition like 'LIKE', '>', '<', etc
* @param {[key: string]: { cond: string, value: any }} params
*/
export const customDBWhereParams = (params : { field: string, cond: string, value: any }[]) => {
   const stringParams: string[] = [];
   _.map(params, (wp) => {
        const value = typeof wp.value === 'string' ? `'${wp.value}'` : wp.value;
        stringParams.push(`${wp.field} ${wp.cond} ${value}`)
   });

   return _.join(stringParams, ' AND ');
}

/**
 * Convert bigint inside obj into string (faciliate JSON.stringify)
 * @param { any } obj
 */
export const convertBigIntToString = (obj : any) => {
    if (typeof obj === 'object') {
        for (let key in obj) {
            if (typeof obj[key] === 'bigint') {
                obj[key] = obj[key].toString();
            } else if (typeof obj[key] === 'object') {
                obj[key] = convertBigIntToString(obj[key]);
            }
        }
    }

    return obj;
}

// https://stackoverflow.com/questions/1109061/insert-on-duplicate-update-in-postgresql
/**
 * Postgres upsert function
 * @param { string } table
 * @param { {[key: string]: any} } updateField
 * @param { {[key: string]: any} } insertField
 * @param { {[key: string]: any} } searchField
 * @returns { string }
 */
export const getUpsertQuery = (table: string, updateField: {[key: string]: any}, insertField: {[key: string]: any}, searchField: {[key: string]: any}): string => {
    // UPDATE table SET field='C', field2='Z' WHERE id=3;
    // INSERT INTO table (id, field, field2)
    //     SELECT 3, 'C', 'Z'
    //     WHERE NOT EXISTS (SELECT 1 FROM table WHERE id=3);

    const updateValue = formatDBParamsToStr(updateField);
    const searchValue = formatDBParamsToStr(searchField, { separator: ' AND ' });
    const insertColumn = _.join(Object.keys(insertField));
    const insertValue = formatDBParamsToStr(insertField, { valueOnly: true });

    const query = `
        UPDATE ${table} SET ${updateValue} WHERE ${searchValue};
        INSERT INTO ${table} (${insertColumn})
            SELECT ${insertValue}
            WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE ${searchValue});
    `;

    return query;
}

type mimeTypes = 'video' | 'image';
export const checkAllowedMime = (mime: string, checkTypes: mimeTypes[]): boolean => {
    const allowed = {
        'video': ['video/mp4', 'video/mpeg', 'video/quicktime'],
        'image': ['image/jpeg', 'image/jpg', 'image/gif', 'image/png', 'image/webp']
    }

    let valid = false;
    _.map(checkTypes, (type) => {
        if (!valid) {
            valid = allowed[type].includes(mime);
        }
    });

    return valid;
}

export const getPeriod = (period: 'monthly' | 'weekly' | 'daily') => {
    const dayParam = {
        'monthly': 'month',
        'weekly': 'week',
        'daily': 'day'
    }

    return { start: dayjs().startOf(dayParam[period] as OpUnitType).format('YYYY-MM-DD HH:mm:ss'), end: dayjs().endOf(dayParam[period] as OpUnitType).format('YYYY-MM-DD HH:mm:ss') };
}

/**
 * Get server port from env
 * @param { string } url
 */
export const getServerPort = () => {
    return process.env.SERVER_PORT;
}

/**
 * Get server port from env
 * @param { string } url
 */
export const getBeDomain = () => {
    return process.env.BE_DOMAIN;
}

/**
 * Get server port from env
 * @param { string } url
 */
export const getDappDomain = () => {
    return process.env.DAPP_DOMAIN;
}

export const generateNftUri = () => {
    let uuid = uuidv4();
    let uri = getDappDomain() + `/metadata/${uuid}.json`;
    return { uuid, uri };
}

export const getCollectionMint = (whichCollection: string) => {
  let { [`${whichCollection}Mint`]: collectionMint, [`${whichCollection}MetadataAccount`]:collectionMetadataAccount, [`${whichCollection}MasterEditionAccount`]:collectionMasterEditionAccount} = loadPublicKeysFromFile();
  return {
    collectionMasterEditionAccount,
    collectionMetadataAccount,
    collectionMint,
  };
}

export const getContentPassCollectionAddress = () => {
    return process.env.UNDERDOG_CONTENT_COLLECTION_ADDRESS!;
}

export const getNonPublicKeyPlayerAccount = (account: string) => {
    return loadOrGenerateKeypair(account, '.user_keys');
}

export const getPlayerPublicKey = (isPublicKey: boolean, account: string) => {
    return isPublicKey? new PublicKey(account) : loadOrGenerateKeypair(account, '.user_keys').publicKey;
}

export const getAddressNftDetails = async(isPublicKey: boolean, account: string) => {
    // load the env variables and store the cluster RPC url
    const CLUSTER_URL = getRPCEndpoint();

    // create a new rpc connection, using the ReadApi wrapper
    const connection = new WrapperConnection(CLUSTER_URL, "confirmed");
    let publicKey = getPlayerPublicKey(isPublicKey, account);
    const result = await connection.getAssetsByOwner({ ownerAddress: publicKey.toBase58() });

    // let rawMonsters = result.items.filter(x => x.grouping[0].group_value === getMonsterCollectionAddress());

    return result;
}

export const getAddressSOLBalance = async(isPublicKey: boolean, account: string) => {
    // load the env variables and store the cluster RPC url
    const CLUSTER_URL = getRPCEndpoint();

    // create a new rpc connection, using the ReadApi wrapper
    const connection = new WrapperConnection(CLUSTER_URL, "confirmed");
    let publicKey = getPlayerPublicKey(isPublicKey, account);

    const result = await connection.getBalance(publicKey);
    return result / 1000000000;
}

export const sendSOLTo = async(isPublicKey: boolean, account: string, amount: number) => {
    // load the env variables and store the cluster RPC url
    const CLUSTER_URL = getRPCEndpoint();

    // create a new rpc connection, using the ReadApi wrapper
    const connection = new WrapperConnection(CLUSTER_URL, "confirmed");
    let publicKey = getPlayerPublicKey(isPublicKey, account);

    let lamports = Math.round(amount * 1000000000);

    let adminAccount = getAdminAccount();
    let transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: adminAccount.publicKey,
            toPubkey: publicKey,
            lamports,
        })
    );
    // Send and confirm transaction
    // Note: feePayer is by default the first signer, or payer, if the parameter is not set
    let txSignature = await connection.sendTransaction(transaction, [adminAccount]);

    return txSignature;
}

export const sendTokensTo = async(sendTo: string, token: string, tokenDecimals: number, amount: number) => {
    // load the env variables and store the cluster RPC url
    const CLUSTER_URL = getRPCEndpoint();

    // create a new rpc connection, using the ReadApi wrapper
    const connection = new WrapperConnection(CLUSTER_URL, "confirmed");
    let adminAccount = getAdminAccount();

    const mintToken = new PublicKey(token);
    const recipientAddress = new PublicKey(sendTo);

    const transactionInstructions: TransactionInstruction[] = [];

    // get the sender's token account
    const associatedTokenFrom = await getAssociatedTokenAddress(
      mintToken,
      adminAccount.publicKey
    );

    const fromAccount = await getAccount(connection, associatedTokenFrom);
    let {
        associatedTokenTo,
        transaction: createTransaction,
    } = await getOrCreateAssociatedAccount(mintToken, adminAccount.publicKey, recipientAddress);

    if(createTransaction) {
        transactionInstructions.push(createTransaction);
    }

    // the actual instructions
    transactionInstructions.push(
      createTransferInstruction(
        fromAccount.address, // source
        associatedTokenTo, // dest
        adminAccount.publicKey,
        Math.round(amount * tokenDecimals),
      )
    );

    // send the transactions
    const transaction = new Transaction().add(...transactionInstructions);
    // Send and confirm transaction
    // Note: feePayer is by default the first signer, or payer, if the parameter is not set
    const signature = await connection.sendTransaction(transaction, [adminAccount]);
    return signature;
}

// return associatedTokenAddress and transaction
// if associatedTokenAddress exists, transaction is null
export const getOrCreateAssociatedAccount = async(mintToken: PublicKey, payer: PublicKey, recipient: PublicKey) => {
    const connection = new Connection(getRPCEndpoint());

    // get the recipient's token account
    const associatedTokenTo = await getAssociatedTokenAddress(
        mintToken,
        recipient
    );

    let transaction = null;

    // if recipient doesn't have token account
    // create token account for recipient
    if (!(await connection.getAccountInfo(associatedTokenTo))) {
        transaction =
            createAssociatedTokenAccountInstruction(
                payer,
                associatedTokenTo,
                recipient,
                mintToken
            );
    }

    return {
        associatedTokenTo,
        transaction,
    };
}

// non public key account
export const clawbackSOLFrom = async(account: string) => {
    // load the env variables and store the cluster RPC url
    const CLUSTER_URL = getRPCEndpoint();

    // create a new rpc connection, using the ReadApi wrapper
    const connection = new WrapperConnection(CLUSTER_URL, "confirmed");
    let playerAccount = getNonPublicKeyPlayerAccount(account);

    let solBalance = await getAddressSOLBalance(false, account);

    // leave 0.001 SOL
    let clawbackBalance = solBalance - 0.001;

    if(clawbackBalance <= 0) {
        console.log('balance too low to clawback');
        return "";
    }

    let lamports = Math.round(clawbackBalance * 1000000000);

    let adminAccount = getAdminAccount();
    let transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: playerAccount.publicKey,
            toPubkey: adminAccount.publicKey,
            lamports,
        })
    );
    // Send and confirm transaction
    // Note: feePayer is by default the first signer, or payer, if the parameter is not set

    let txSignature = await connection.sendTransaction(transaction, [playerAccount]);

    console.log('SOL Clawback: ' + txSignature);
    return txSignature;
}

export const transferCNfts = async(nft_ids: string[], nonPublicKeyAccount: string, to: string) => {
    if(nft_ids.length === 0){
        return true;
    }

    const endpoint = getRPCEndpoint(); //Replace with your RPC Endpoint
    const connection = new WrapperConnection(endpoint);

    let nonPublicKeyAccountKeypair = getNonPublicKeyPlayerAccount(nonPublicKeyAccount);

    let tries = 0;
    // 10 tries
    // sometimes it doesn't recognize the nft
    while(tries < 10) {
        try {
            let tx = new Transaction();
        
            for(const nft_id of nft_ids) {
                let ix = await createTransferCompressedNftInstruction(new PublicKey(to), new PublicKey(nft_id));
                tx.add(ix);
            }

            await connection.sendTransaction(tx, [nonPublicKeyAccountKeypair]);
            break;
        }

        catch {
            tries++;
            await sleep(5000);
        }
    }

    if(tries >=  3) {
        throw Error ("Unable to send cNFT");
    }

    /* let res = await axios.post(
        "https://api.shyft.to/sol/v1/nft/compressed/transfer_many", 
        {
          "network": "mainnet-beta",
          "nft_addresses": nft_ids,
          "from_address": nonPublicKeyAccountKeypair.publicKey.toBase58(),
          "to_address": to,
        }, 
        { 
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "ZsCmQGJe2iK77mzH"
          },
        }
    ); */

    /* for(const encoded_transaction of res.data.result.encoded_transactions) {
        console.log(encoded_transaction);
        let recoveredTransaction = Transaction.from(Buffer.from(encoded_transaction, 'base64'));
        recoveredTransaction.feePayer = nonPublicKeyAccountKeypair.publicKey;
        recoveredTransaction.partialSign(nonPublicKeyAccountKeypair);
        const txnSignature = await connection.sendRawTransaction(recoveredTransaction.serialize());
        console.log(`Transfer cNFT signature: ${txnSignature}`);
    } */

    return true;
}

export const getTx = async(txHash: string) => {
    const endpoint = getRPCEndpoint(); //Replace with your RPC Endpoint
    const connection = new WrapperConnection(endpoint);

    let tx = await connection.getTransaction(txHash, { maxSupportedTransactionVersion: 0 });
    return tx;
}

export const getTokensTransferredToUser = async(txHash: string, toAddress: string, token: string) => {
    let now = moment().add(-2, 'minute');
    let txDetails = await getTx(txHash);
    if(!txDetails || !txDetails.blockTime || !txDetails.meta) {
        throw new Error("No Tx Details");
    }

    let {
        blockTime,
        meta: {
            preTokenBalances,
            postTokenBalances,
        }
    } = txDetails;

    if(!preTokenBalances || !postTokenBalances) {
        throw new Error("Cant find token balance");
    }

    let txMoment = moment(blockTime * 1000);
    if(txMoment.isBefore(now)) {
        console.log('Old Tx detected');
        throw Error("Old Tx");
    }

    let preBalanceArray = preTokenBalances.filter(x => x.mint === token && x.owner === toAddress);
    let preBalance = preBalanceArray[0]?.uiTokenAmount.uiAmount ?? 0;

    let postBalanceArray = postTokenBalances.filter(x => x.mint === token && x.owner === toAddress);
    let postBalance = postBalanceArray[0]?.uiTokenAmount.uiAmount ?? 0;

    let valueUsd = postBalance - preBalance;
    return valueUsd;
}

export const verifySignature = (address: string, signature: string, message: string) => { 
    return nacl
            .sign
            .detached
            .verify(
                new TextEncoder().encode(message),
                base64.decode(signature),
                bs58.decode(address)
            );
}

export const getProfilePictureLink = (filename?: string) => {
    if(!filename) {
        return undefined;
    }
    return getBeDomain() + "/profile_picture/" + filename;
}

/*
 *  Mail functions
 */
export const getMailCredentials = () => {
    return {
        cpanel: process.env.EMAIL_CPANEL!,
        auth: process.env.EMAIL_AUTH!,
        domain: process.env.EMAIL_DOMAIN!,
        host: process.env.EMAIL_HOST!,
        user: process.env.EMAIL_ADDRESS!,
        pass: process.env.EMAIL_PASSWORD!,
        name: process.env.EMAIL_NAME!,
        bcc: process.env.EMAIL_BCC!,
    }
}

// Github
export const getGithubCredentials = () => {
    return {
        key: process.env.GITHUB_KEY!,
        email: process.env.GITHUB_EMAIL!,
        name: process.env.GITHUB_NAME!,
    };
}

// Sphere
export const getSphereKey = () => {
    return process.env.SPHERE_SECRET!;
}

export const getSphereWalletId = () => {
    return process.env.SPHERE_WALLET_ID!;
}

// Underdog
export const getUnderdogKey = () => {
    return {
        apiKey: process.env.UNDERDOG_API_KEY!,
        baseUrl: process.env.UNDERDOG_BASE_URL!,
    };
}
export const getUnderdogContentPassDetails = () => {
    return {
        projectId: process.env.UNDERDOG_CONTENT_PASS_PROJECT_ID!,
        name: process.env.UNDERDOG_CONTENT_PASS_NAME!,
        symbol: process.env.UNDERDOG_CONTENT_PASS_SYMBOL!,
    };
}

export const createContentPass = async({
    image,
    attributes,
    receiverAddress,
}: {
    image: string; // base64 or url
    attributes: {
        [key: string]: string;
    },
    receiverAddress: string;
}) => {
    let {
        projectId,
        name,
        symbol,
    } = getUnderdogContentPassDetails();

    let createRes = await createUnderdogNFT({
        projectId,
        name,
        symbol,
        image,
        attributes,
        receiverAddress,
    });

    return createRes;
}

export const createUnderdogNFT = async({
    projectId,
    name,
    symbol,
    image,
    attributes,
    receiverAddress,
}: {
    projectId: number | string;
    name: string;
    symbol: string;
    image: string; // base64 or url
    attributes: {
        [key: string]: string;
    },
    receiverAddress: string;
}) => {
    let {apiKey, baseUrl} = getUnderdogKey();
    try {
        let createRes = await axios.post(`${baseUrl}/projects/${projectId}/nfts`, {
            name,
            symbol,
            description: `Content pass to be used in Sollinked`,
            delegated: true,
            image,
            attributes,
            receiverAddress,
        },
        {
            headers: {
            'Authorization': `Bearer ${apiKey}` 
            }
        });

        /**
         *  {
                "transactionId": "486ed473-21db-43b6-8734-e3d0abd1b9e6",
                "nftId": 3,
                "projectId": 1
            }
         */
        if(!createRes.data || !createRes.data.nftId) {
            return;
        }

        let nftId = createRes.data.nftId;
        let retries = 0;
        let mintAddress = "";

        while(retries < 10) {
            let details = await getUnderdogNft(projectId, nftId);
            if(!details || !details.mintAddress) {
                retries++;
                continue;
            }
            
            mintAddress = details.mintAddress;
            break;
        }

        return {
            mintAddress,
            nftId,
        };
    }

    catch(e) {
        console.log(e);
        return;
    }
}

export const getUnderdogNft = async(projectId: number | string, nftId: number | string) => {
    let {apiKey, baseUrl} = getUnderdogKey();
    try {
        let mintRes = await axios.get<{
            "id": number;
            "mintAddress": string;
            "status": string; // "confirmed"
            "ownerAddress": string;
            "name": string;
            "symbol": string;
            "description": string;
            "image": string; // url
          }>(`${baseUrl}/projects/${projectId}/nfts/${nftId}`,
        {
            headers: {
            'Authorization': `Bearer ${apiKey}` 
            }
        });

        if(!mintRes.data || !mintRes.data.mintAddress) {
            return;
        }

        return mintRes.data;
    }

    catch {
        return;
    }
}