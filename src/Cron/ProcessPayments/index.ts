import * as mailController from '../../Controllers/mailController';
import * as userController from '../../Controllers/userController';
import * as userTierController from '../../Controllers/userTierController';
import * as webhookController from '../../Controllers/webhookController';
import * as clientio from 'socket.io-client';
import moment from 'moment';
import { createEmailForwarder, deleteAttachments, getEmailByMessageId, mapAttachments, sendEmail } from '../../Mail';
import { BALANCE_ERROR_NUMBER, getAddressUSDCBalance } from '../../Token';
import { v4 as uuidv4 } from 'uuid';
import { getMailCredentials, getServerPort, sendSOLTo } from '../../../utils';
import DB from '../../DB';
import { ProcessedMail } from '../../Models/mail';
import { UserTier } from '../../Models/userTier';
import { User } from '../../Models/user';

const port = getServerPort();
let socket = clientio.connect(`ws://localhost:${port}`);
const notifyPayer = (tiplink_public_key: string) => {
    // notify payer
    if(!tiplink_public_key) {
        return;
    }

    if(!socket.connected) {
        return;
    }

    if(tiplink_public_key && socket.connected) {
        // socket connected
        socket.emit('update_mail_payment_status', { tiplink_public_key, isPaid: true });
    }
}

const internalSendEmail = async({
    user, 
    mail, 
    tier, 
    tokenBalance,
    uuid,
    domain,
    bcc_to_email,
}: {
    user: User;
    mail: ProcessedMail;
    tier?: UserTier; // when it's auction, then there's no tier
    tokenBalance: number;
    uuid: string;
    domain: string;
    bcc_to_email: string;
}) => {
    let { from, subject, textAsHtml, text, attachments: parserAttachments } = await getEmailByMessageId(mail.message_id) as any;
    let attachments = mapAttachments(parserAttachments);

    let processed_at = moment().format('YYYY-MM-DDTHH:mm:ssZ');
    let expiry_date: string = "";
    let utc_expiry_date: string = "";

    if(!tier || tier.respond_days === 0) {
        // add 12 hours instead
        expiry_date = moment().add(7, 'd').format('YYYY-MM-DDTHH:mm:ssZ');
        utc_expiry_date = moment().utc().add(7, 'd').format('YYYY-MM-DD HH:mm');
    }

    else {
        expiry_date = moment().add(tier.respond_days, 'd').format('YYYY-MM-DDTHH:mm:ssZ');
        utc_expiry_date = moment().utc().add(tier.respond_days, 'd').format('YYYY-MM-DD HH:mm');
    }

    let sent_message_id = await sendEmail({
        to: user.email_address!,
        subject: `${subject ?? "No Subject"}`,
        text: `Paid: ${tokenBalance} USDC\nExpiry Date: ${utc_expiry_date} UTC\nSender: ${from}\n\n${text}`,
        textAsHtml: `<p>Paid: ${tokenBalance} USDC</p><p>Expiry Date: ${utc_expiry_date} UTC</p><p>Sender: ${from}</p><br>${textAsHtml}`,
        attachments,
        replyTo: `${uuid}@${domain}`
    });

    // receipt
    await sendEmail({
        to: from,
        subject: subject ?? "Re:",
        text: `Email has been sent to ${user.username}. You will be refunded if they don't reply by ${utc_expiry_date} UTC.`,
        inReplyTo: mail.message_id, // have to set this to reply to message in a thread
        references: mail.message_id, // have to set this to reply to message in a thread
    });

    // create a forwarder for responses
    // delete this forwarder once done
    await createEmailForwarder(uuid);

    // update the mail to contain the necessary info
    await mailController.update(mail.key, { 
        processed_at,
        expiry_date,
        value_usd: tokenBalance,
        is_processed: true,
        bcc_to_email,
        sent_message_id,
        subject: subject ?? "No Subject"
    });

    // delete attachments
    deleteAttachments(attachments);

    await webhookController.executeByUserId(mail.user_id, {
        payer: mail.from_email,
        amount: tokenBalance,
        expiry_date: utc_expiry_date + " UTC",
        bcc_to: bcc_to_email,
    });

    // notify
    notifyPayer(mail.tiplink_public_key);
}
const internalSendAuctionEmail = async({
    user, 
    mail, 
    tokenBalance,
    uuid,
    domain,
    bcc_to_email,
}: {
    user: User;
    mail: ProcessedMail;
    tokenBalance: number;
    uuid: string;
    domain: string;
    bcc_to_email: string;
}) => {
    let split = mail.message?.split("|")[0];

    let processed_at = moment().format('YYYY-MM-DDTHH:mm:ssZ');
    let expiry_date: string = moment().add(7, 'd').format('YYYY-MM-DDTHH:mm:ssZ');
    let utc_expiry_date: string =  moment().utc().add(7, 'd').format('YYYY-MM-DD HH:mm');
    let sent_message_id = "";

    // from email
    if(split === "bid_from_email") {
        let message_id = split[1];
        let { from, subject, textAsHtml, text, attachments: parserAttachments } = await getEmailByMessageId(message_id) as any;
        let attachments = mapAttachments(parserAttachments);

        sent_message_id = await sendEmail({
            to: user.email_address!,
            subject: `${subject ?? "No Subject"}`,
            text: `Paid: ${tokenBalance} USDC\nExpiry Date: ${utc_expiry_date} UTC\nSender: ${from}\n\n${text}`,
            textAsHtml: `<p>Paid: ${tokenBalance} USDC</p><p>Expiry Date: ${utc_expiry_date} UTC</p><p>Sender: ${from}</p><br>${textAsHtml}`,
            attachments,
            replyTo: `${uuid}@${domain}`
        });
    }

    // from site
    else {
        sent_message_id = await sendEmail({
            to: user.email_address!,
            subject: `${mail.subject ?? "No Subject"}`,
            text: `Paid: ${tokenBalance} USDC\nExpiry Date: ${utc_expiry_date} UTC\nSender: ${mail.from_email}\n\n${mail.message}`,
            textAsHtml: `<p>Paid: ${tokenBalance} USDC</p><p>Expiry Date: ${utc_expiry_date} UTC</p><p>Sender: ${mail.from_email}</p><br>${mail.message}`,
            // attachments,
            replyTo: `${uuid}@${domain}`
        });
    }

    // receipt
    await sendEmail({
        to: mail.from_email,
        subject: mail.subject ?? "Re:",
        text: `Email has been sent to ${user.username}. You will be refunded if they don't reply by ${utc_expiry_date} UTC.`,
        inReplyTo: mail.message_id, // have to set this to reply to message in a thread
        references: mail.message_id, // have to set this to reply to message in a thread
    });

    // create a forwarder for responses
    // delete this forwarder once done
    await createEmailForwarder(uuid);

    // update the mail to contain the necessary info
    await mailController.update(mail.key, { 
        processed_at,
        expiry_date,
        value_usd: tokenBalance,
        is_processed: true,
        bcc_to_email,
        sent_message_id,
        subject: mail.subject ?? "No Subject"
    });

    // delete attachments
    // deleteAttachments(attachments);

    await webhookController.executeByUserId(mail.user_id, {
        payer: mail.from_email,
        amount: tokenBalance,
        expiry_date: utc_expiry_date + " UTC",
        bcc_to: bcc_to_email,
    });

    // notify
    notifyPayer(mail.tiplink_public_key);
}

// and auctions
export const processPaymentsAndAuctionWinners = async() => {
    let credentials = getMailCredentials();
    let createdAfter = moment().add(-2, 'd').format('YYYY-MM-DD')
    let mails = await mailController.find({
        is_processed: false,
    }, {
        createdAfter,
        onlyFromSMTP: true, // and auctions
    });

    // no mails
    if(!mails) {
        await DB.log('ProcessPayments', 'processPaymentsAndAuctionWinners', 'No unprocessed mails');
        return;
    }

    for(const [index, mail] of mails.entries()) {
        let uuid = uuidv4();
        let bcc_to_email = `${uuid}@${credentials.domain}`;
        let tokenBalance = await getAddressUSDCBalance(mail.tiplink_public_key);

        // errored
        if(tokenBalance === null || tokenBalance === BALANCE_ERROR_NUMBER) {
            continue;
        }

        if(tokenBalance === 0) {
            continue;
        }

        let user = await userController.view(mail.user_id);
        let tiers = await userTierController.find({ user_id: mail.user_id });

        if(!user) {
            await DB.log('ProcessPayments', 'processPaymentsAndAuctionWinners', 'No user');
            continue;
        }

        if(!user.email_address) {
            await DB.log('ProcessPayments', 'processPaymentsAndAuctionWinners', `No email address: ${user.id}`);
            continue;
        }

        // auction email
        if(mail.is_auction) {
            // send email if it won an auction, dont care about tiers
            await internalSendAuctionEmail({
                user,
                mail,
                tokenBalance,
                uuid,
                domain: credentials.domain,
                bcc_to_email,
            });
            continue;
        }

        if(!tiers) {
            await DB.log('ProcessPayments', 'processPaymentsAndAuctionWinners', `No tier: ${user.id}`);
            /* // user didn't set tiers, all emails are eligible
            let { from, subject, textAsHtml, text, attachments: parserAttachments } = await getEmailByMessageId(mail.message_id) as any;
            let attachments = mapAttachments(parserAttachments);

            await sendEmail({
                to: user.email_address,
                subject: subject ?? `Email from ${from}`,
                text: `${text}\n\n\n-------------------\nSollinked BCC Email Address: ${bcc_to_email ?? ""}\n\nOR\n\nClick this link to reply: mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}`,
                textAsHtml: `${textAsHtml}\n\n\n<p>-------------------</p>\n<p>Sollinked BCC Email Address: ${bcc_to_email ?? ""}</p>\n\n<p>OR</p>\n\n<p>Click this link to reply: <a href="mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}">Reply</a></p>`,
                attachments,
            }); */
            continue;
        }

        // process tiers
        // tiers are ordered by value_usd descending
        for(const [index, tier] of tiers.entries()) {
            if(tokenBalance < parseFloat(tier.value_usd)) {
                continue;
            }

            await internalSendEmail({
                user,
                mail,
                tier,
                tokenBalance,
                uuid,
                domain: credentials.domain,
                bcc_to_email,
            });
            // dont process the rest of the tiers
            break;
        }
    } 
}

export const processFromSitePayments = async() => {
    let credentials = getMailCredentials();
    let createdAfter = moment().add(-1, 'h').format('YYYY-MM-DD')
    let mails = await mailController.find({
        is_processed: false,
    }, {
        createdAfter,
        onlyFromSite: true,
    });

    // no mails
    if(!mails) {
        
        await DB.log('ProcessPayments', 'processFromSitePayments', 'No unprocessed mails');
        return;
    }

    for(const [index, mail] of mails.entries()) {
        let uuid = uuidv4();
        let bcc_to_email = `${uuid}@${credentials.domain}`;
    
        let tokenBalance = await getAddressUSDCBalance(mail.tiplink_public_key);

        // errored
        if(tokenBalance === null || tokenBalance === BALANCE_ERROR_NUMBER) {
            continue;
        }

        if(tokenBalance === 0) {
            continue;
        }

        let user = await userController.view(mail.user_id);
        let tiers = await userTierController.find({ user_id: mail.user_id });

        if(!user) {
            
            await DB.log('ProcessPayments', 'processFromSitePayments', 'No user');
            continue;
        }
        
        if(!user.email_address) {
            
            await DB.log('ProcessPayments', 'processFromSitePayments', `No email address: ${user.id}`);
            continue;
        }

        if(!tiers) {
            
            await DB.log('ProcessPayments', 'processFromSitePayments', `No tier: ${user.id}`);
            /* // user didn't set tiers, all emails are eligible
            let { from, subject, textAsHtml, text, attachments: parserAttachments } = await getEmailByMessageId(mail.message_id) as any;
            let attachments = mapAttachments(parserAttachments);

            await sendEmail({
                to: user.email_address,
                subject: subject ?? `Email from ${from}`,
                text: `${text}\n\n\n-------------------\nSollinked BCC Email Address: ${bcc_to_email ?? ""}\n\nOR\n\nClick this link to reply: mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}`,
                textAsHtml: `${textAsHtml}\n\n\n<p>-------------------</p>\n<p>Sollinked BCC Email Address: ${bcc_to_email ?? ""}</p>\n\n<p>OR</p>\n\n<p>Click this link to reply: <a href="mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}">Reply</a></p>`,
                attachments,
            }); */
            continue;
        }

        // process tiers
        // tiers are ordered by value_usd descending
        for(const [index, tier] of tiers.entries()) {
            if(tokenBalance < parseFloat(tier.value_usd)) {
                continue;
            }

            let processed_at = moment().format('YYYY-MM-DDTHH:mm:ssZ');
            let expiry_date = moment().add(tier.respond_days, 'd').format('YYYY-MM-DDTHH:mm:ssZ');
            let utc_expiry_date = moment().utc().add(tier.respond_days, 'd').format('YYYY-MM-DD HH:mm');

            if(tier.respond_days === 0) {
                // add 12 hours instead
                expiry_date = moment().add(12, 'h').format('YYYY-MM-DDTHH:mm:ssZ');
            }

            let sent_message_id = await sendEmail({
                to: user.email_address,
                subject: `${mail.subject ?? "No Subject"}`,
                text: `Paid: ${tokenBalance} USDC\nExpiry Date: ${utc_expiry_date} UTC\nSender: ${mail.from_email}\n\n${mail.message}`,
                textAsHtml: `<p>Paid: ${tokenBalance} USDC</p><p>Expiry Date: ${utc_expiry_date} UTC</p><p>Sender: ${mail.from_email}</p><br>${mail.message}`,
                replyTo: `${uuid}@${credentials.domain}`
            });
            
            // receipt
            await sendEmail({
                to: mail.from_email,
                subject: mail.subject ?? "Re:",
                text: `Email has been sent to ${user.username}. You will be refunded if they don't reply by ${utc_expiry_date} UTC.`,
                inReplyTo: mail.message_id, // have to set this to reply to message in a thread
                references: mail.message_id, // have to set this to reply to message in a thread
            });

            // create a forwarder for responses
            // delete this forwarder once done
            await createEmailForwarder(uuid);

            // update the mail to contain the necessary info
            await mailController.update(mail.key, { 
                processed_at,
                expiry_date,
                value_usd: tokenBalance,
                is_processed: true,
                bcc_to_email,
                sent_message_id,
                subject: mail.subject ?? "No Subject"
            });

            await webhookController.executeByUserId(mail.user_id, {
                payer: mail.from_email,
                amount: tokenBalance,
                expiry_date: utc_expiry_date + " UTC",
                bcc_to: bcc_to_email,
            });

            // notify
            notifyPayer(mail.tiplink_public_key);

            // dont process the rest of the tiers
            break;
        }
    } 
}

export const processMailsWithNoResponse = async() => {
    let mails = await mailController.getExpired();
    if(!mails) {
        
        await DB.log('ProcessPayments', 'processMailsWithNoResponse', `No expired mails`);
        return;
    }

    for(const [index, mail] of mails.entries()) {
        const { user_id, from_email, to_email, tiplink_url, tiplink_public_key, message_id, sent_message_id, subject, is_from_site } = mail;
        let usdcBalance = await getAddressUSDCBalance(tiplink_public_key);

        // errored
        if(usdcBalance === null || usdcBalance === BALANCE_ERROR_NUMBER) {
            continue;
        }

        if(usdcBalance > 0) {
            let isNotValidId = message_id === "from site";
            let senderSubject = is_from_site? 'Email Receipt' : subject;
            
            await sendEmail({
                to: from_email,
                subject: senderSubject ?? "USDC Refund",
                inReplyTo: isNotValidId? undefined : message_id,
                references: isNotValidId? undefined : message_id,
                text: `${to_email} has failed to respond within the time limit. Please claim the refund through this link ${tiplink_url}.\n\nPlease make sure it's a Tiplink URL, you will not be asked to deposit any funds.\n\nRegards,\nSollinked.`,
            });

            let users = await userController.find({ id: user_id });
            if(sent_message_id && users && users[0].email_address) {
                await sendEmail({
                    to: users[0].email_address,
                    subject: subject ?? "Email Refunded",
                    inReplyTo: sent_message_id,
                    references: sent_message_id,
                    text: `This email has expired, the funds had been returned to the sender.`,
                });
            }
        }

        await mailController.update(mail.key, { value_usd: 0 });
    }
}