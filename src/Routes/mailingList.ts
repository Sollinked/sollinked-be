import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as mailingListController from '../Controllers/mailingListController';
import * as mailingListPriceTierController from '../Controllers/mailingListPriceTierController';
import * as mailingListSubscriberController from '../Controllers/mailingListSubscriberController';
import * as mailingListBroadcastController from '../Controllers/mailingListBroadcastController';
import axios from 'axios';
import moment from 'moment';
import { createSpherePaymentLink, createSpherePrice, createSphereProduct, getSphereKey, getSphereWalletId, getSubscriptionFee } from '../../utils';
import { USDC_ADDRESS } from '../Constants';
import DB from '../DB';

const {
    subscriptionFee,
    subscriptionRatio,
} = getSubscriptionFee();
export const routes = Router();
routes.post('/', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let lists = await mailingListController.find({ user_id: user.id });
    if(lists && lists.length > 0) {
        return res.status(400).send("Mailing list had already been created");
    }

    // create product in sphere
    let product = null;
    let wallet = null;
    try {
        let name = `${user.display_name ?? user.username}'s Mail Subscription`;
        let description = `Receive emails from ${user.display_name ?? user.username} as long as you're subscribed to this product.`;
        let receiverAddress = user.address;
        let receiverWalletName = `${user.username} Wallet`;
        let sphereRes = await createSphereProduct(name, description, receiverAddress, receiverWalletName);

        if(!sphereRes) {
            return res.status(500).send("Unable to create subscription");
        }

        product = sphereRes.product;
        wallet = sphereRes.wallet;

        if(!wallet) {
            return res.status(500).send("Unable to create wallet");
        }
    }

    catch (e: any){
        let db = new DB();
        await db.log('mailingList', '/', e.toString());
        return res.status(500).send("Unable to create product");
    }
    
    let result = await mailingListController.create({
        user_id: user.id,
        product_id: product.id,
        wallet_id: wallet.id,
    });

    if(!result) {
        return res.status(500).send("Server Error");
    }

    return res.send({
        success: true,
        message: "Success",
    });
});

// update pricelist
routes.post('/priceList', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address) {
        return res.status(400).send("Invalid params");
    }

    if(!data.prices) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    // create product in sphere
    let lists = await mailingListController.find({ user_id: user.id });
    if(!lists || lists.length === 0) {
        return res.status(404).send("Missing mailing list");
    }

    let list = lists[0];

    await Promise.all(
        data.prices.map(async(price: any) => {
            // update only
            if(price.id) {
                await mailingListPriceTierController.update(price.id, { 
                    name: price.name, 
                    description: price.description, 
                    is_active: price.is_active 
                });
                return;
            }

            let priceRet: any = null;
            let paymentLinkRet: any = null;
    
            try {
                let name = `${user!.display_name ?? user!.username} - ${price.name}`;
                let description = `Receive ${price.name} emails from ${user!.display_name ?? user!.username} as long as you're subscribed to this product.`;
                let productId = list.product_id;
                let currency = USDC_ADDRESS;
                let amount = (price.amount * subscriptionFee).toFixed(5); // 5, * 1.05 cause of 5% service charge
                let type: "recurring" | "oneTime" = "recurring";
                let intervalCount = price.charge_every;
                let defaultLength = price.prepay_month;
                let priceRet = await createSpherePrice(
                    name,
                    description,
                    productId,
                    type,
                    currency,
                    amount,
                    intervalCount,
                    defaultLength
                );  

                if(!priceRet) {
                    return res.status(500).send("Unable to create price");
                }
                
                let priceId = priceRet.id;
                let wallets: {
                    id: string,
                    shareBps: number,
                }[] = [
                    {
                        id: list.wallet_id,
                        shareBps: 9524, // 95%
                    },
                    {
                        id: getSphereWalletId(),
                        shareBps: 10000 - 9524, // 5%
                    }
                ];
                let requiresEmail = true;
                paymentLinkRet = await createSpherePaymentLink(
                    priceId,
                    wallets,
                    requiresEmail,
                )

                if(!paymentLinkRet) {
                    return res.status(500).send("Unable to create payment link");
                }
            }
        
            catch (e: any){
                let db = new DB();
                await db.log('mailingList', '/priceList', `Unable to create price\n\n${e.toString()}`);
                return;
            }
            
            await mailingListPriceTierController.create({ 
                mailing_list_id: list.id,
                price_id: priceRet!.id, // id from sphere
                paymentlink_id: paymentLinkRet.id,
                name: price.name, 
                description: price.description, 
                amount: price.amount,
                currency: USDC_ADDRESS,
                charge_every: price.charge_every,
                prepay_month: price.prepay_month,
             });
        })
    )

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/retry/:id', async(req, res) => {
    let data = req.body;
    let { id } = req.params;
    if(!data) {
        return res.status(400).send("No data");
    }

    if(!id) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }


    let broadcast = await mailingListBroadcastController.view(Number(id));
    if(!broadcast) {
        return res.status(404).send("Missing broadcast");
    }

    if(broadcast.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }

    await mailingListBroadcastController.retryBroadcast(Number(id));

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/broadcast', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.tier_ids || !data.title || !data.content) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let emails: string[] = await mailingListPriceTierController.getUniqueEmailsForTiers(data.tier_ids, user.id);

    if(emails.length === 0) {
        return res.status(400).send('No subscribers found');
    }

    // create a broadcast entry with the unique emails
    let broadcastRes = await mailingListBroadcastController.createAndBroadcast({
        user_id: user.id,
        title: data.title,
        content: data.content,
        is_executing: false,
    }, emails);

    if(!broadcastRes) {
        return res.status(500).send("Unable to broadcast");
    }

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/saveDraft', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.title || !data.content) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let params: any = {
        user_id: user.id,
        title: data.title,
        content: data.content,
        is_executing: false,
        is_draft: true,
    };
    // create a broadcast entry with the unique emails
    if(data.tier_ids) {
        params.tier_ids = data.tier_ids;
    }

    let broadcastRes = await mailingListBroadcastController.create(params);

    if(!broadcastRes) {
        return res.status(500).send("Unable to save draft");
    }

    return res.send({
        success: true,
        message: "Success",
        data: broadcastRes.id,
    });
});

routes.post('/updateDraft/:id', async(req, res) => {
    let data = req.body;
    let { id } = req.params;
    if(!data) {
        return res.status(400).send("No data");
    }

    if(!id) {
        return res.status(400).send("Invalid params");
    }

    if(!data.title || !data.content) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }


    let broadcast = await mailingListBroadcastController.view(Number(id));
    if(!broadcast) {
        return res.status(404).send("Missing broadcast");
    }

    if(broadcast.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }

    let params: any = { 
        title: data.title,
        content: data.content,
    };

    if(data.tier_ids) {
        params.tier_ids = data.tier_ids;
    }

    await mailingListBroadcastController.update(Number(id), params);

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/broadcastDraft/:id', async(req, res) => {
    let data = req.body;
    let { id } = req.params;
    if(!data) {
        return res.status(400).send("No data");
    }

    if(!id) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let broadcast = await mailingListBroadcastController.view(Number(id));
    if(!broadcast) {
        return res.status(404).send("Missing broadcast");
    }

    if(broadcast.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }

    let emails: string[] = await mailingListPriceTierController.getUniqueEmailsForTiers(data.tier_ids, user.id);
    if(emails.length === 0) {
        return res.status(400).send('No subscribers found');
    }

    await mailingListBroadcastController.update(Number(id), { is_draft: false });
    await mailingListBroadcastController.broadcast(Number(id), emails);

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/testDraft/:id', async(req, res) => {
    let data = req.body;
    let { id } = req.params;
    if(!data) {
        return res.status(400).send("No data");
    }

    if(!id) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let broadcast = await mailingListBroadcastController.view(Number(id));
    if(!broadcast) {
        return res.status(404).send("Missing broadcast");
    }

    if(broadcast.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }

    await mailingListBroadcastController.testDraft(Number(id));

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/resend', async(req, res) => {
    let data = req.body;
    let { subscriber_id, broadcast_id } = data;
    if(!data || !subscriber_id || !broadcast_id) {
        return res.status(400).send("No data");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let subscriber = await mailingListSubscriberController.view(Number(subscriber_id));
    if(!subscriber) {
        return res.status(404).send("Missing subscription");
    }

    if(subscriber.user_id !== user.id) {
        let db = new DB();
        await db.log('mailingList', '/resend', 'Wrong subscriber');
        return res.status(401).send("Unauthorized");
    }

    if(moment(subscriber.expiry_date).isBefore(moment())) {
        return res.status(400).send("Expired");
    }

    if(!subscriber.price_tier) {
        let db = new DB();
        await db.log('mailingList', '/resend', 'No subscriber');
        return res.status(401).send("Unauthorized");
    }

    if(subscriber.price_tier.past_broadcasts.filter(x => x.id === Number(broadcast_id)).length === 0) {
        let db = new DB();
        await db.log('mailingList', '/resend', 'Price tier doesnt contain broadcast id');
        return res.status(401).send("Unauthorized");
    }

    await mailingListBroadcastController.broadcast(Number(broadcast_id), [subscriber.email_address]);

    return res.send({
        success: true,
        message: "Success",
    });
});

// it is actually get draft
routes.post('/draft/:id', async(req, res) => {
    let data = req.body;
    let { id } = req.params;
    if(!data) {
        return res.status(400).send("No data");
    }

    if(!id) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }


    let broadcast = await mailingListBroadcastController.view(Number(id));
    if(!broadcast) {
        return res.status(404).send("Missing broadcast");
    }

    if(broadcast.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }

    return res.send({
        success: true,
        message: "Success",
        data: broadcast
    });
});

// public function
routes.get('/:username', async function(req, res) {
    let { username } = req.params;

    if(!username) {
        return res.status(400).send("No data");
    }

    let user = await userController.viewByUsername(username);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }


    let list = await mailingListController.findByUserId(user.id, true);

    return res.send({
        success: true,
        message: "Success",
        data: {
            list,
            display_name: user.display_name ?? "",
        },
    });
});