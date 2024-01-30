import { simpleParser } from 'mailparser';
import { TipLink } from '@tiplink/api';
import { deleteEmailForwarder, getEmailByMessageId, getImap, mapAttachments, sendEmail } from '../../../src/Mail';
import * as controller from '../../../src/Controllers/mailController';
import * as userController from '../../Controllers/userController';
import * as userTierController from '../../Controllers/userTierController';
import { clawbackSOLFrom, getExcludeEmailDomains, getMailCredentials, sendTokensTo } from '../../../utils';
import moment from 'moment';
import { USDC_ADDRESS, USDC_DECIMALS } from '../../Constants';
import { ProcessedMail } from '../../Models/mail';
import Connection, { ImapMessage } from 'imap';
import DB from '../../DB';

const processEmailToUser = async({
    domain,
    toEmailMatch,
    returnToEmail,
    messageId,
    subject,
    unreadCallback,
}: {
    domain: string;
    toEmailMatch: string[];
    returnToEmail: string;
    messageId: string;
    subject?: string;
    unreadCallback: () => void;
}) => {            
    // only get emails to this domain and ignore noreply
    let toEmails = toEmailMatch.filter(x => x.includes(domain) && !x.includes("noreply"));
    if(toEmails.length === 0) {
        return;
    }
    let toEmail = toEmails[0];
    let username = toEmail.replace(`@${domain}`, "");
                                    
    let users = await userController.find({ username });
    if(!users || users.length === 0){

        // check for email uuid
        let uuidEmail = toEmail;
        let uuid = uuidEmail.replace(`@${domain}`, "");
        let mails = await controller.find({ bcc_to_email: uuidEmail });

        // has uuid
        if(mails && mails.length > 0) {
            let mail = mails[0];
            let originalSender = mail.from_email.toLowerCase();
        
            // check if the responder actually responded to the original sender
            let toEmails = toEmailMatch.filter(x => x.toLowerCase() === originalSender);

            // send the email on behalf of the user
            // might have cc or other to's
            // already have uuid so it must be sent to this uuid
            // so we just need to check if toEmails.length is 0 (not sent to original sender)
            // to send on behalf of the user
            if(toEmailMatch.length >= 1 && toEmails.length === 0) {
                let db = new DB();
                await db.log('ProcessEmails', 'processEmailToUser', `Sending on behalf of ${mail.to_email}`);
                try {
                    let { subject, textAsHtml, text, attachments: parserAttachments } = await getEmailByMessageId(messageId) as any;
                    let attachments = mapAttachments(parserAttachments);
    
                    await sendEmail({
                        to: mail.from_email,
                        subject: `${subject ?? "No Subject"}`,
                        text,
                        textAsHtml,
                        attachments,
                        replyTo: mail.to_email,
                        from: mail.to_email,
                        references: mail.message_id,
                        inReplyTo: mail.message_id,
                    });
                }

                catch(e: any) {
                    let db = new DB();
                    await db.log('ProcessEmails', 'processEmailToUser', `PE5: ${e.name}`);
                    unreadCallback();
                    return;
                }
            }

            // sent to user from own email
            else if(toEmails.length === 0) {
                let db = new DB();
                await db.log('ProcessEmails', 'processEmailToUser', `Cant find email original sender, aborting\noriginal sender: ${originalSender}\ntoEmailMatch: ${toEmailMatch.join(",")}`);
                return;
            }

            // mark the mail as responded
            await controller.update(mail.key, { has_responded: true, responded_at: moment().utc().format('YYYY-MM-DDTHH:mm:ssZ') });

            // process completed, dont need the bcc forwarder anymore
            await deleteEmailForwarder(uuid);
            await autoClaimFromMail(mail);
            return;
        }

        let db = new DB();
        await db.log('ProcessEmails', 'processEmailToUser', `Cant find user: ${username}`);
        
        return;
    }

    let excludeEmailDomains = getExcludeEmailDomains();
    for(const domain of excludeEmailDomains) {
        if(returnToEmail.includes(domain)) {
            //dont process these domains
            return;
        }
    }
    
    // we process emails here
    const tiplink = await TipLink.create();

    let fromUsers = await userController.find({ email_address: returnToEmail });

    // save from, to, messageId and tiplink url to db
    await controller.create({
        user_id: users[0].id,
        from_user_id: fromUsers?.[0]?.id ?? null,
        from_email: returnToEmail,
        to_email: toEmail,
        message_id: messageId,
        tiplink_url: tiplink.url.toString(),
        tiplink_public_key: tiplink.keypair.publicKey.toBase58(),
    });

    // need to include guide to deposit?
    let returnText = `Please deposit USDC (Solana) to the Solana Address below for a guaranteed audience\n${tiplink.keypair.publicKey.toBase58()}.\nPlease deposit by ${moment().add(2, 'd').utc().format('YYYY-MM-DD HH:mm:ss')} UTC, deposits after this date will not be processed.`;
    let userTiers = await userTierController.find({ user_id: users[0].id });
    if(userTiers && userTiers.length > 0){
        returnText += "\n\nThey will reply in:";

        userTiers.forEach((tier, index) => {
            if(tier.respond_days === 0) {
                returnText += `\n${index + 1}. 12 hours for ${parseFloat(tier.value_usd).toFixed(2)} USDC`;
                return;
            }

            returnText += `\n${index + 1}. ${tier.respond_days} days for ${parseFloat(tier.value_usd).toFixed(2)} USDC`;
        });

        returnText += "\n\nFunds will be returned if they did not reply.";
    }
    
    await sendEmail({
        to: returnToEmail,
        subject: subject ?? "Re:",
        text: returnText,
        inReplyTo: messageId, // have to set this to reply to message in a thread
        references: messageId, // have to set this to reply to message in a thread
    });
}

// user responded to email, bcc variant
const processEmailResponse = async({
    domain,
    toEmailMatch,
    bccEmailMatch,
}: {
    domain: string;
    toEmailMatch: string[];
    bccEmailMatch: string[];
}) => {           
    // only get emails to this domain
    let bccEmails = bccEmailMatch.filter(x => x.includes(domain));
    if(bccEmails.length === 0) {
        return;
    }

    // find bcc to our domain
    let bccToEmail = bccEmails[0];
    let mails = await controller.find({ bcc_to_email: bccToEmail });
    if(!mails || mails.length === 0){
        let db = new DB();
        await db.log('ProcessEmails', 'processEmailResponse', `Cant find bcc email: ${bccToEmail}`);
        return;
    }

    let bcc_username = bccToEmail.replace(`@${domain}`, "");
    let originalSender = mails[0].from_email.toLowerCase();

    // check if the responder actually responded to the original sender
    let toEmails = toEmailMatch.filter(x => x.toLowerCase() === originalSender);
    if(toEmails.length === 0) {
        let db = new DB();
        await db.log('ProcessEmails', 'processEmailResponse', `Cant find email original sender, aborting\noriginal sender: ${originalSender}`);
        return;
    }

    // mark the mail as responded and claimed
    await controller.update(mails[0].key, { has_responded: true, responded_at: moment().utc().format('YYYY-MM-DDTHH:mm:ssZ') });

    // process completed, dont need the bcc forwarder anymore
    await deleteEmailForwarder(bcc_username);
    await autoClaimFromMail(mails[0]);
}
    
export const processEmails = async() => {
    const imap = getImap();
    const credentials = getMailCredentials();

    try {
        imap.once('ready', () => {
            // on ready
            imap.openBox('INBOX', false, () => {
                // open inbox
                imap.search([
                    'UNSEEN'
                ], async(err, results) => {
                    try {
                        const f = imap.fetch(results, { bodies: '' });
                        f.on('message', async msg => {

                            let uid = 0;
                            msg.once('attributes', attrs => {
                                uid = attrs.uid;
                                imap.addFlags(uid, ['\\Seen'], () => {
                                    // do nothing
                                });
                            });

                            msg.on('body', stream => {
                                simpleParser(stream as any, async(err, parsed) => {
                                    const { from, to, subject, textAsHtml, text, messageId, bcc } = parsed;
    
                                    if(!from) {
                                        return;
                                    }
    
                                    if(!to) {
                                        return;
                                    }
    
                                    if(!messageId) {
                                        return;
                                    }
    
                                    let fromEmailMatch = from.text.match(/[\w-\+\.]+@([\w-]+\.)+[\w-]{2,10}/g);
                                    if(!fromEmailMatch || fromEmailMatch.length === 0){
                                        return;
                                    }
    
                                    let toText = Array.isArray(to)? to.map(x => x.text).join(", ") : to.text;
    
                                    let toEmailMatch = toText.match(/[\w-\+\.]+@([\w-]+\.)+[\w-]{2,10}/g);
                                    if(!toEmailMatch || toEmailMatch.length === 0){
                                        return;
                                    }
    
                                    let returnToEmail = fromEmailMatch[0];

                                    await processEmailToUser({
                                        domain: credentials.domain,
                                        toEmailMatch,
                                        returnToEmail,
                                        messageId,
                                        subject,
                                        unreadCallback: () => {
                                            imap.delFlags(uid, ['\\Seen'], () => {
                                                // do nothing
                                            });
                                        }
                                    });

                                    if(!bcc) {
                                        return;
                                    }
    
                                    let bccText = Array.isArray(bcc)? bcc.map(x => x.text).join(", ") : bcc.text;
    
                                    let bccEmailMatch = bccText.match(/[\w-\+\.]+@([\w-]+\.)+[\w-]{2,10}/g);
                                    if(!bccEmailMatch || bccEmailMatch.length === 0){
                                        return;
                                    }
                                    
                                    await processEmailResponse({
                                        domain: credentials.domain,
                                        toEmailMatch,
                                        bccEmailMatch,
                                    });
                                })
                            })
                        });
    
                        f.once('error', async e => {
                            let db = new DB();
                            await db.log('ProcessEmails', 'processEmails', `PE1: ${e.toString()}`);
                        });
    
                        f.once('end', () => {
                            // fetched all messages
                            //imap.end();
                        });
                    }

                    catch(e: any) {
                        if(!e.message.includes("Nothing to fetch")) {
                            let db = new DB();
                            await db.log('ProcessEmails', 'processEmails', `PE2: ${e.message}`);
                        }
                        imap.end();
                    }
                })
            });
        });

        imap.once('error', async(err: any) => {
            let db = new DB();
            await db.log('ProcessEmails', 'processEmails', `PE3: ${err.toString()}`);
        });

        imap.once('end', () => {
            // console.log('connection ended');
        });

        imap.connect();
    }

    catch (e: any){
        let db = new DB();
        await db.log('ProcessEmails', 'processEmails', `PE4: ${e.toString()}`)
    }
}

const CHECK_BALANCE_COUNT = 3;
export const processUnclaimedRespondedEmails = async() => {
    let mails = await controller.find({ has_responded: true, is_claimed: false, }, { unexpiredOnly: true, checkBalanceCount: CHECK_BALANCE_COUNT });
    if(!mails) {
        return;
    }

    for(const mail of mails) {
        await autoClaimFromMail(mail);
    }
}

const autoClaimFromMail = async(mail: ProcessedMail) => {
    let user = await userController.find({ id: mail.user_id });
    if(!user)  {
        let db = new DB();
        await db.log('ProcessEmails', 'autoClaimFromMail', `Missing user`);
        return;
    }

    if(!mail.value_usd) {
        let db = new DB();
        await db.log('ProcessEmails', 'autoClaimFromMail', `Mail has 0 value`);
        return;
    }

    let retries  = 0;
    let tiplink = await TipLink.fromUrl(new URL(mail.tiplink_url));
    while(retries < 3) {
        try {
            await sendTokensTo(user[0].address, USDC_ADDRESS, USDC_DECIMALS, mail.value_usd, tiplink.keypair);

            let db = new DB();
            await db.log('ProcessEmails', 'autoClaimFromMail', `Sent ${mail.value_usd} USDC to ${user[0].username} (${user[0].address})`);

            break;
        }

        catch(e: any) {
            let db = new DB();
            await db.log('ProcessEmails', 'autoClaimFromMail', e.toString());
            retries++;
        }
    }

    // errored
    if(retries >= 3) {
        if(mail.claim_balance_verify_count < CHECK_BALANCE_COUNT) {
            await controller.update(mail.key, { claim_balance_verify_count: mail.claim_balance_verify_count + 1 });
        }

        let db = new DB();
        await db.log('ProcessEmails', 'autoClaimFromMail', `Unable to auto claim: ${tiplink.url}`);
        
        return;
    }

    retries = 0;
    while(retries < 3) {
        try {
            await clawbackSOLFrom(tiplink.keypair);
            break;
        }

        catch(e: any) {
            let db = new DB();
            await db.log('ProcessEmails', 'autoClaimFromMail', e.toString());
            retries++;
        }
    }
    if(retries >= 3) {
        let db = new DB();
        await db.log('ProcessEmails', 'autoClaimFromMail', `Unable to clawback from: ${tiplink.url}`);
        return;
    }


    // mark the mail as responded and claimed
    await controller.update(mail.key, { is_claimed: true });
}