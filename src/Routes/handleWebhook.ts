import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as mailingListController from '../Controllers/mailingListController';
import * as mailingListPriceTierController from '../Controllers/mailingListPriceTierController';
import * as mailingListSubscriberController from '../Controllers/mailingListSubscriberController';
import * as mailingListBroadcastController from '../Controllers/mailingListBroadcastController';
import * as contentController from '../Controllers/contentController';
import * as contentPassController from '../Controllers/contentPassController';
import * as contentCNFTController from '../Controllers/contentCNFTController';
import * as contentPaymentController from '../Controllers/contentPaymentController';
import axios from 'axios';
import moment from 'moment';
import { createContentPass, createSpherePaymentLink, createSpherePrice, createSphereProduct, getDappDomain, getSphereKey, getSphereWalletId, getSubscriptionFee, sendTokensTo } from '../../utils';
import { USDC_ADDRESS, USDC_DECIMALS } from '../Constants';
import DB from '../DB';

const {
    subscriptionFee,
    subscriptionRatio,
} = getSubscriptionFee();
export const routes = Router();

const processSubscription = async(payment: any, paymentRet: any) => {
    let paymentLink = paymentRet.paymentLink;
    if(!paymentLink) {
        let db = new DB();
        await db.log('handleWebhook', '/sphere', `Missing payment link: ${payment.id}`);
        return "Payment link missing";
    }

    let customer = paymentRet.customer;
    if(!customer || !customer.solanaPubKey) {
        let db = new DB();
        await db.log('handleWebhook', '/sphere', `Missing customer: ${payment.id}`);
        return "customer missing";
    }

    let lineItems = paymentLink.lineItems;
    if(!lineItems || lineItems.length === 0) {
        let db = new DB();
        await db.log('handleWebhook', '/sphere', `Missing lineItems: ${payment.id}`);
        return "lineItems missing";
    }

    let lineItem = lineItems[0];
    let price = lineItem.price;
    if(!price) {
        let db = new DB();
        await db.log('handleWebhook', '/sphere', `Missing price: ${payment.id}`);
        return "price missing";
    }

    let priceTiers = await mailingListPriceTierController.find({ price_id: price.id }, true);
    if(!priceTiers || priceTiers.length === 0) {
        let db = new DB();
        await db.log('handleWebhook', '/sphere', `Unable to find priceTier: ${payment.id}`);
        return "Unable to find priceTier";
    }

    let priceTier = priceTiers[0];

    if(!paymentRet.personalInfo || !paymentRet.personalInfo.email) {
        let db = new DB();
        await db.log('handleWebhook', '/sphere', `Unable to find email: ${payment.id}`);
        return "Unable to find email";
    }

    let email = paymentRet.personalInfo.email;
    let users = await userController.find({ address: customer.solanaPubKey });
    let user_id = 0;
    if(!users || users.length === 0) {
        if(!paymentRet.personalInfo) {
            let db = new DB();
            await db.log('handleWebhook', '/sphere', `Unable to create cause there is no email: ${payment.id}`);
            return "Unable to create user";
        }
        let result = await userController.create({
            address: customer.solanaPubKey,
            username: customer.solanaPubKey,
            calendar_advance_days: 100,
            email_address: email,
        });
        if(!result) {
            let db = new DB();
            await db.log('handleWebhook', '/sphere', `Unable to create user: ${payment.id}`);
            return "Unable to create user";
        }
        user_id = result.id;
    }

    else {
        user_id = users[0].id;
    }

    await mailingListSubscriberController.create({
        mailing_list_price_tier_id: priceTier.id,
        user_id,
        price_id: price.id,
        value_usd: priceTier.amount,
        expiry_date: moment().add(priceTier.charge_every, 'M').format('YYYY-MM-DDTHH:mm:ssZ'),
        email_address: email,
    });

    return "";
}

const processOneTimePayment = async(payment: any, paymentRet: any) => {
    let paymentLink = paymentRet.paymentLink;
    if(!paymentLink) {
        let db = new DB();
        await db.log('handleWebhook', 'processOneTimePayment', `Missing payment link: ${payment.id}`);
        return "Payment link missing";
    }

    let customer = paymentRet.customer;
    if(!customer || !customer.solanaPubKey) {
        let db = new DB();
        await db.log('handleWebhook', 'processOneTimePayment', `Missing customer: ${payment.id}`);
        return "customer missing";
    }

    let users = await userController.find({ address: customer.solanaPubKey });
    let user_id = 0;
    if(!users || users.length === 0) {
        if(!paymentRet.personalInfo) {
            let db = new DB();
            await db.log('handleWebhook', 'processOneTimePayment', `Unable to create cause there is no email: ${payment.id}`);
            return "Unable to create user";
        }
        let result = await userController.create({
            address: customer.solanaPubKey,
            username: customer.solanaPubKey,
            calendar_advance_days: 100,
        });
        if(!result) {
            let db = new DB();
            await db.log('handleWebhook', 'processOneTimePayment', `Unable to create user: ${payment.id}`);
            return "Unable to create user";
        }
        user_id = result.id;
    }

    else {
        user_id = users[0].id;
    }

    let contents = await contentController.find({ paymentlink_id: paymentLink.id });
    if(contents && contents.length > 0) {
        let content = contents[0];

        // create payment history
        await contentPaymentController.create({
            user_id: user_id,
            content_id: content.id,
            value_usd: content.value_usd,
            tx_hash: payment.id,
            type: "single"
        });

        // send payment to user
        let contentCreator = await userController.view(content.user_id);
        if(!contentCreator) {
            let db = new DB();
            await db.log('handleWebhook', 'processOneTimePayment', `Unable to find content creator: ${content.user_id} for content: ${content.id}`);
        }

        if(contentCreator) {
            await sendTokensTo(contentCreator.address, USDC_ADDRESS, USDC_DECIMALS, content.value_usd);
        }

        return "";
    }

    let contentPasses = await contentPassController.find({ paymentlink_id: paymentLink.id });
    if(contentPasses && contentPasses.length > 0) {
        let contentPass = contentPasses[0];

        // create payment history
        await contentPaymentController.create({
            user_id: user_id,
            content_id: contentPass.id,
            value_usd: contentPass.value_usd,
            tx_hash: payment.id,
            type: "pass"
        });

        let contentCreator = await userController.view(contentPass.user_id);
        if(!contentCreator) {
            return "Unable to find user.";
        }
        let passRes = await createContentPass({
            image: contentCreator.profile_picture ?? getDappDomain() + "/logo.png",
            receiverAddress: customer.solanaPubKey,
            attributes: {
                "Content Creator": contentCreator.username,
                "Type": contentPass.name
            },
        });

        if(!passRes || !passRes.mintAddress) {
            let db = new DB();
            await db.log('handleWebhook', 'processOneTimePayment', `Unable to mint pass, below is passRes\n\n${passRes}`);
            return "Unable to mint pass!";
        }

        // send usdc to the content creator
        await sendTokensTo(contentCreator.address, USDC_ADDRESS, USDC_DECIMALS, contentPass.value_usd);

        // create a log in db
        let { mintAddress, nftId } = passRes;
        await contentCNFTController.create({
            mint_address: mintAddress,
            nft_id: nftId,
            content_pass_id: contentPass.id,
        });
    }

    return "";
}

// for webhook
routes.post('/sphere', async(req, res) => {
    let data = req.body;
    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.data) {
        return res.status(400).send("Invalid params");
    }

    if(!data.data.payment || !data.data.payment.id) {
        return res.status(400).send("Missing payment object");
    }

    // verify from sphere
    let payment = data.data.payment;
    try {
        let paymentRes = await axios.get(`https://api.spherepay.co/v1/payment/${payment.id}`, 
        {
            headers: {
              'Authorization': `Bearer ${getSphereKey()}` 
            }
        });
            
        if(!paymentRes.data.ok || !paymentRes.data.data || !paymentRes.data.data.payment) {
            let db = new DB();
            await db.log('handleWebhook', '/sphere', `Unable to get payment: ${payment.id}`);
            return res.status(400).send("Unable to get payment");
        }

        let paymentRet = paymentRes.data.data.payment;
        if(paymentRet.status !== "succeeded") {
            console.log('payment status is not succeeded');
            let db = new DB();
            await db.log('handleWebhook', '/sphere', `Payment failed: ${payment.id}`);
            return res.status(400).send("Payment failed");
        }

        if(paymentRet.type === "subscription") {
            let errorMessage = await processSubscription(payment, paymentRet);
            if(errorMessage !== "") {
                console.log(errorMessage);
                return res.status(400).send("Payment failed");
            }
        }

        else {
            let errorMessage = await processOneTimePayment(payment, paymentRet);
            if(errorMessage !== "") {
                console.log(errorMessage);
                return res.status(400).send("Payment failed");
            }
        }
    
    }

    catch {
        let db = new DB();
        await db.log('handleWebhook', '/sphere', 'Unable to create subscriber');
        return;
    }

    return res.send("Success");
});