import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as mailingListController from '../Controllers/mailingListController';
import * as mailingListPriceTierController from '../Controllers/mailingListPriceTierController';
import * as mailingListSubscriberController from '../Controllers/mailingListSubscriberController';
import * as mailingListBroadcastController from '../Controllers/mailingListBroadcastController';
import axios from 'axios';
import moment from 'moment';
import { getSphereKey, getSphereWalletId, getSubscriptionFee } from '../../utils';
import { USDC_ADDRESS } from '../Constants';

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
        let productRes = await axios.post('https://api.spherepay.co/v1/product', {
                name: `${user.display_name ?? user.username}'s Mail Subscription`,
                description: `Receive emails from ${user.display_name ?? user.username} as long as you're subscribed to this product.`,
            },
            {
                headers: {
                'Authorization': `Bearer ${getSphereKey()}` 
                }
            });
    
        if(!productRes.data.ok || !productRes.data.data || !productRes.data.data.product) {
            return res.status(500).send("Unable to create product");
        }
        let walletRes = await axios.post('https://api.spherepay.co/v1/wallet', {
                address: user.address,
                network: 'sol',
                nickname: `${user.username} Wallet`,
            },
            {
                headers: {
                'Authorization': `Bearer ${getSphereKey()}` 
                }
            });
    
        if(!walletRes.data.ok || !walletRes.data.data || !walletRes.data.data.wallet) {
            return res.status(500).send("Unable to create wallet");
        }

        product = productRes.data.data.product;
        wallet = walletRes.data.data.wallet;
    }

    catch (e){
        console.log(e);
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

            let priceRet = null;
            let paymentLinkRet = null;
    
            try {
                let priceRes = await axios.post('https://api.spherepay.co/v1/price', {
                        name: `${user!.display_name ?? user!.username} - ${price.name}`,
                        description: `Receive ${price.name} emails from ${user!.display_name ?? user!.username} as long as you're subscribed to this product.`,
                        product: list.product_id,
                        type: "recurring",
                        currency: USDC_ADDRESS,
                        network: "sol",
                        taxBehavior: "exclusive",
                        billingSchema: "perUnit",
                        //unitAmount: (price.amount * USDC_DECIMALS).toString(), // 500000000
                        unitAmountDecimal: (price.amount * subscriptionFee).toFixed(5), // 5, * 1.05 cause of 5% service charge
                        //tierType: null,
                        //tiers: null,
                        recurring: {
                            type: "delegated",
                            interval: "month",
                            intervalCount: price.charge_every, // per month
                            usageAggregation: "sum",
                            usageType: "licensed",
                            defaultLength: price.prepay_month,
                            // usageDefaultQuantity: "",
                        }
                    }, 
                    {
                        headers: {
                          'Authorization': `Bearer ${getSphereKey()}` 
                        }
                    }
                );
            
                if(!priceRes.data.ok || !priceRes.data.data || !priceRes.data.data.price) {
                    console.log('unable to create price');
                    return;
                }
                priceRet = priceRes.data.data.price;
                
                // create sphere payment link
                let paymentLinkRes = await axios.post('https://api.spherepay.co/v1/paymentLink', {
                        lineItems: [{
                            price: priceRet.id,
                            quantity: 1,
                            quantityMutable: false,
                        }],
                        wallets: [
                            {
                                id: list.wallet_id,
                                shareBps: 9524, // 95%
                            },
                            {
                                id: getSphereWalletId(),
                                shareBps: 10000 - 9524, // 5%
                            }
                        ],
                        requiresEmail: true,
                    }, 
                    {
                        headers: {
                        'Authorization': `Bearer ${getSphereKey()}` 
                        }
                    }
                );
            
                if(!paymentLinkRes.data.ok || !paymentLinkRes.data.data || !paymentLinkRes.data.data.paymentLink) {
                    console.log('unable to create payment link');
                    return;
                }
        
                paymentLinkRet = paymentLinkRes.data.data.paymentLink;
            }
        
            catch (e: any){
                console.log('unable to create price');
                return;
            }
            
            await mailingListPriceTierController.create({ 
                mailing_list_id: list.id,
                price_id: priceRet.id, // id from sphere
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

// for webhook
routes.post('/subscribe', async(req, res) => {
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
            console.log(`Unable to get payment: ${payment.id}`);
            return res.status(400).send("Unable to get payment");;
        }

        let paymentRet = paymentRes.data.data.payment;
        if(paymentRet.type !== "subscription") {
            console.log(`Payment is not subscription: ${payment.id}`);
            return res.status(400).send("Payment is not subscription");;
        }

        if(paymentRet.status !== "succeeded") {
            console.log(`Payment failed: ${payment.id}`);
            return res.status(400).send("Payment failed");;
        }

        let paymentLink = paymentRet.paymentLink;
        if(!paymentLink) {
            console.log(`Missing payment link: ${payment.id}`);
            return res.status(400).send("Payment link missing");;
        }

        let customer = paymentRet.customer;
        if(!customer || !customer.solanaPubKey) {
            console.log(`Missing customer: ${payment.id}`);
            return res.status(400).send("customer missing");;
        }

        let lineItems = paymentLink.lineItems;
        if(!lineItems || lineItems.length === 0) {
            console.log(`Missing lineItems: ${payment.id}`);
            return res.status(400).send("lineItems missing");;
        }

        let lineItem = lineItems[0];
        let price = lineItem.price;
        if(!price) {
            console.log(`Missing price: ${payment.id}`);
            return res.status(400).send("price missing");;
        }

        let priceTiers = await mailingListPriceTierController.find({ price_id: price.id }, true);
        if(!priceTiers || priceTiers.length === 0) {
            console.log(`Unable to find priceTier: ${payment.id}`);
            return res.status(500).send("Unable to find priceTier");;
        }

        let priceTier = priceTiers[0];

        if(!paymentRet.personalInfo || !paymentRet.personalInfo.email) {
            console.log(`Unable to find email: ${payment.id}`);
            return res.status(500).send("Unable to find email");;
        }

        let email = paymentRet.personalInfo.email;
        let users = await userController.find({ address: customer.solanaPubKey });
        let user_id = 0;
        if(!users || users.length === 0) {
            if(!paymentRet.personalInfo) {
                console.log(`Unable to create cause there is no email: ${payment.id}`);
                return res.status(500).send("Unable to create user");;
            }
            let result = await userController.create({
                address: customer.solanaPubKey,
                username: customer.solanaPubKey,
                calendar_advance_days: 100,
                email_address: email,
            });
            if(!result) {
                console.log(`Unable to create user: ${payment.id}`);
                return res.status(500).send("Unable to create user");;
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
    }

    catch {
        console.log('unable to create subscriber');
        return;
    }

    return res.send("Success");
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