import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as mailController from '../Controllers/mailController';
import * as webhookController from '../Controllers/webhookController';
import { TipLink } from '@tiplink/api';
import { getMailCredentials, getTokensTransferredToUser, isValidMail, sendSOLTo, sleep } from '../../utils';
import { createEmailForwarder, getEmailByMessageId, getEmailByReceiver, sendEmail } from '../Mail';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { USDC_ADDRESS } from '../Constants';
import DB from '../DB';
import { ThreadMail } from '../Models/mail';

export const routes = Router();
routes.post('/new/:username', async(req, res) => {
    let data = req.body;
    let { address, subject, emailMessage } = data;
    let { domain } = getMailCredentials();

    if(!data) {
        return res.status(400).send("Invalid Params");
    }

    let fromUser = await userController.findByAddress(address)
    if(!fromUser) {
        return res.status(401).send("Unauthorized");
    }

    if(!fromUser.email_address || !isValidMail(fromUser.email_address)) {
        return res.status(400).send("Invalid email address");
    }

    let {username} = req.params;
    if(!username) {
        return res.status(400).send("No username");
    }

    let user = await userController.viewByUsername(username);
    if(!user) {
        return res.status(404).send("No user");
    }
    // we process emails here
    const tiplink = await TipLink.create();

    // save from, to, messageId and tiplink url to db
    let result = await mailController.create({
        user_id: user.id,
        from_user_id: fromUser.id,
        from_email: fromUser.email_address,
        to_email: `${username}@${domain}`,
        message_id: "from site",
        tiplink_url: tiplink.url.toString(),
        tiplink_public_key: tiplink.keypair.publicKey.toBase58(),
        is_from_site: true,
        subject,
        message: emailMessage,
    });

    if(!result) {
        return res.status(500).send("Server Error");
    }

    return res.send({
        success: true,
        message: "Success",
        data: {
            mailId: result.id,
            depositTo: tiplink.keypair.publicKey.toBase58(),
        },
    });
});


// deprecated
// now uses cron
routes.post('/payment/:username', async(req, res) => {
    let data = req.body;
    let {replyToEmail, subject, emailMessage, txHash, mailId} = data;

    if(!data || !replyToEmail || !subject || !emailMessage || !txHash || !mailId) {
        return res.status(400).send("Invalid Params");
    }

    let {username} = req.params;
    if(!username) {
        return res.status(400).send("No username");
    }

    let user = await userController.viewByUsername(username);
    if(!user) {
        return res.status(404).send("No user");
    }

    mailId = Number(mailId);
    let mail = await mailController.view(mailId);
    if(!mail) {
        return res.status(404).send("Unable to get mail id");
    }

    let retries = 0;
    let uuid = uuidv4();
    let credentials = getMailCredentials();
    let bcc_to_email = `${uuid}@${credentials.domain}`;

    while(retries < 10) {
        try {
            let valueUsd = await getTokensTransferredToUser(txHash, mail.tiplink_public_key, USDC_ADDRESS);
            let tiers = user.tiers;

            if(!tiers) {
                
                await DB.log('mail', '/payment/:username', `No tier`);
                // user didn't set tiers, all emails are ineligible
                break;
            }
    
            // process tiers
            // tiers are ordered by value_usd descending
            for(const [index, tier] of tiers.entries()) {
                if(valueUsd < parseFloat(tier.value_usd)) {
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
                    to: user.email_address!,
                    subject: `${subject ?? "No Subject"}`,
                    text: `Paid: ${valueUsd} USDC\nExpiry Date: ${utc_expiry_date} UTC\nSender: ${mail.from_email}\n\n${emailMessage}`,
                    replyTo: `${bcc_to_email}`
                });

                // receipt
                let email_receipt_id = await sendEmail({
                    to: mail.from_email,
                    subject: `Email Receipt`,
                    text: `Email has been sent to ${user.username}. You will be refunded if they don't reply by ${utc_expiry_date} UTC.` + `\n\n---- Copy of message -----\n\n${emailMessage}`,
                });
    
                // create a forwarder for responses
                // delete this forwarder once done
                await createEmailForwarder(uuid);
    
                // update the mail to contain the necessary info
                await mailController.update(mailId, { 
                    processed_at,
                    expiry_date,
                    value_usd: valueUsd,
                    is_processed: true,
                    bcc_to_email,
                    message_id: email_receipt_id,
                    sent_message_id,
                    subject: subject ?? "No Subject"
                });
    
                await webhookController.executeByUserId(mail.user_id, {
                    payer: mail.from_email,
                    amount: valueUsd,
                    expiry_date: utc_expiry_date + " UTC",
                    bcc_to: bcc_to_email,
                });
    
                // dont process the rest of the tiers
                break;
            }
            
            // break while loop
            break;
        }

        catch (e: any){
            if(e.message === "Old Tx") {
                return res.status(400).send("Old Tx");
            }

            
            await DB.log('mail', '/payment/:username', e.toString());

            retries++;
            await sleep(2000); //sleep 2s
            continue;
        }
    }

    if(retries >= 10) {
        return res.status(500).send("Server Error");
    }

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/threads/:username', async(req, res) => {
    let data = req.body;
    let { address } = data;

    if(!data) {
        return res.status(400).send("Invalid Params");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(401).send("Unauthorized");
    }

    let {username} = req.params;
    if(!username) {
        return res.status(400).send("No username");
    }

    let toUser = await userController.viewByUsername(username);
    if(!toUser) {
        return res.status(404).send("No user");
    }

    let mails = await mailController.find({ user_id: toUser.id, from_user_id: user.id });
    if(!mails) {
        return res.send({
            success: true,
            message: "Success",
            data: [],
        });
    }

    let ret: ThreadMail[] = [];
    let { domain } = getMailCredentials();
    
    for(let mail of mails) {
        // unable to retrieve this
        if(mail.message_id === "from site" && (!mail.message || !mail.subject)) {
            continue;
        }

        if(!mail.message || !mail.subject) {
            let message_id = mail.sent_message_id ?? mail.message_id;
            try {
                let email = await getEmailByMessageId(message_id, message_id.includes(domain));
                let message = email.textAsHtml ?? "";
                mail.message = message;
                let subject = email.subject ?? "";
                mail.subject = subject;
                await mailController.update(mail.key, { message, subject })
            }

            catch {
                continue;
            }
        }
    
        if(!mail.reply_message && mail.bcc_to_email && mail.has_responded) {
            try {
                let email = await getEmailByReceiver(mail.bcc_to_email);
                let reply_message = email.textAsHtmlWithoutHistory ?? "";
                mail.reply_message = reply_message;
                await mailController.update(mail.key, { reply_message });

            }

            catch {
                continue;
            }
        }
    
        let isExpired = !mail.has_responded && moment(mail.expiry_date).isBefore(moment());
        ret.push({
            id: mail.key,
            created_at: mail.created_at,
            responded_at: mail.responded_at,
            subject: mail.subject,
            message: mail.message,
            reply_message: mail.reply_message,
            value_usd: mail.value_usd,
            tiplink_url: isExpired? mail.tiplink_url : undefined,
            is_processed: mail.is_processed,
        });
    }

    ret = ret.sort((a,b) => a.id > b.id? -1 : 1);
    return res.send({
        success: true,
        message: "Success",
        data: ret,
    });
});

routes.post('/thread/:id', async(req, res) => {
    let data = req.body;
    let { address, toUserId } = data;

    if(!data) {
        return res.status(400).send("Invalid Params");
    }
    
    if(!toUserId) {
        return res.status(400).send("Invalid Params");
    }

    let {id} = req.params;
    if(!id) {
        return res.status(400).send("No id");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(401).send("Unauthorized");
    }

    let idInt = Number(id);
    let mail = await mailController.view(idInt);
    if(!mail) {
        return res.status(404).send("Missing email");
    }

    if(mail.from_user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }

    if(mail.user_id !== toUserId) {
        return res.status(401).send("Unauthorized");
    }

    if(!mail.message) {
        let email = await getEmailByMessageId(mail.message_id);
        let message = email.text ?? "";
        mail.message = message;
        await mailController.update(idInt, { message })
    }

    if(!mail.reply_message && mail.bcc_to_email && mail.has_responded) {
        let email = await getEmailByReceiver(mail.bcc_to_email);
        let reply_message = email.textAsHtmlWithoutHistory ?? "";
        mail.reply_message = reply_message;
        await mailController.update(idInt, { reply_message })
    }

    let isExpired = moment(mail.expiry_date).isBefore(moment());

    return res.send({
        success: true,
        message: "Success",
        data: {
            id: mail.key,
            created_at: mail.created_at,
            responded_at: mail.responded_at,
            subject: mail.subject,
            message: mail.message,
            reply_message: mail.reply_message,
            value_usd: mail.value_usd,
            tiplink_url: isExpired? mail.tiplink_url : undefined,
            is_processed: mail.is_processed,
        },
    });
});

routes.get('/payment/:id', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("Invalid Params");
    }

    let {id} = req.params;
    if(!id) {
        return res.status(400).send("No id");
    }

    let idInt = Number(id);
    let mail = await mailController.view(idInt);
    if(!mail) {
        return res.status(404).send("Missing email");
    }

    // restart cron process
    if(!mail.is_processed) {
        await mailController.update(idInt, {
           created_at: moment().format('YYYY-MM-DDTHH:mm:ssZ'), 
        });
    }

    let user = await userController.view(mail.user_id);
    if(!user) {
        return res.status(404).send("Missing user");
    }

    return res.send({
        success: true,
        message: "Success",
        data: {
            tiplink_public_key: mail.tiplink_public_key,
            is_processed: mail.is_processed,
            tiers: user.tiers ?? [],
            username: user.username,
            display_name: user.display_name,
            holiday_mode: user.holiday_mode,
            is_verified: user.is_verified,
        },
    });
});