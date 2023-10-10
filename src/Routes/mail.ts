import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as mailController from '../Controllers/mailController';
import * as webhookController from '../Controllers/webhookController';
import { TipLink } from '@tiplink/api';
import { getMailCredentials, getTokensTransferredToUser, sendSOLTo, sleep } from '../../utils';
import { createEmailForwarder, sendEmail } from '../Mail';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { USDC_ADDRESS } from '../Constants';

export const routes = Router();
routes.post('/new/:username', async(req, res) => {
    let data = req.body;
    let {replyToEmail} = data;
    let { domain } = getMailCredentials();

    if(!data || !replyToEmail) {
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
    // we process emails here
    const tiplink = await TipLink.create();

    // save from, to, messageId and tiplink url to db
    let result = await mailController.create({
        user_id: user.id,
        from_email: replyToEmail,
        to_email: `${username}@${domain}`,
        message_id: "from site",
        tiplink_url: tiplink.url.toString(),
        tiplink_public_key: tiplink.keypair.publicKey.toBase58(),
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

routes.post('/payment/:username', async(req, res) => {
    let data = req.body;
    let {replyToEmail, subject, message, txHash, mailId} = data;

    if(!data || !replyToEmail || !subject || !message || !txHash || !mailId) {
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
                console.log('process payment', 'no tier');
                // user didn't set tiers, all emails are ineligible
                break;
            }
    
            // process tiers
            // tiers are ordered by value_usd descending
            for(const [index, tier] of tiers.entries()) {
                if(valueUsd < parseFloat(tier.value_usd)) {
                    continue;
                }
    
                let sent_message_id = await sendEmail({
                    to: user.email_address!,
                    subject: `${subject ?? "No Subject"} (${valueUsd} USDC)`,
                    text: `${message}`,
                    replyTo: `${mail.from_email}, ${bcc_to_email}`
                });
    
                let processed_at = moment().format('YYYY-MM-DDTHH:mm:ssZ');
                let expiry_date = moment().add(tier.respond_days, 'd').format('YYYY-MM-DDTHH:mm:ssZ');
                let utc_expiry_date = moment().utc().add(tier.respond_days, 'd').format('YYYY-MM-DD HH:mm');

                // receipt
                await sendEmail({
                    to: mail.from_email,
                    subject: `Email Receipt`,
                    text: `Email has been sent to ${user.username}. You will be refunded if they don't reply by ${utc_expiry_date} UTC.` + `\n\n---- Copy of message -----\n\n${message}`,
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
                    sent_message_id,
                });
    
                await sendSOLTo(true, mail.tiplink_public_key, 0.003);
    
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