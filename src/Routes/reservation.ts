import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as userReservationController from '../Controllers/userReservationController';
import * as userReservationSettingController from '../Controllers/userReservationSettingController';
import _ from 'lodash';
import { RESERVATION_STATUS_AVAILABLE, RESERVATION_STATUS_PENDING, VERIFY_MESSAGE } from '../Constants';
import { verifySignature } from '../../utils';
import moment from 'moment';
import { TipLink } from '@tiplink/api';
import { v4 as uuidv4 } from 'uuid';

export const routes = Router();

// get reservations
routes.get('/:user_id', async(req, res) => {
    let { user_id } = req.params;

    if(!user_id) {
        return res.status(400).send("No data");
    }

    let id = parseInt(user_id);
    let user = await userController.view(id);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }


    let reservations = await userReservationController.findForUser(id, true);
    let settings = await userReservationSettingController.find({ user_id });

    return res.send({
        success: true,
        message: "Success",
        data: {
            reservations,
            settings,
            display_name: user.display_name ?? "",
            calendar_advance_days: user.calendar_advance_days,
        },
    });
});

// update reservation
routes.post('/update', async(req, res) => {
    let data = req.body;
    let {address, signature, date, status} = data;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!address || !signature || !date || status === undefined ) {
        return res.status(400).send("Invalid params");
    }

    let verified = verifySignature(address, signature, VERIFY_MESSAGE);
    if(!verified) {
        return res.status(401).send("Unauthorized");
    }

    // cant save address
    data = _.omit(data, ['address', 'signature']);

    if(Object.keys(data).length === 0){
        return res.send({
            success: false,
            message: "No new updates",
        });
    }

    let users = await userController.find({ address });
    if(!users || users.length === 0) {
        return res.send({
            success: false,
            message: "Unable to find user",
        });
    }

    let user_id = users[0].id;
    let reservations = await userReservationController.find({ date: moment(data.date).utc().format('YYYY-MM-DD HH:mm:ss') });

    if(!reservations || reservations.length === 0) {
        await userReservationController.create({
            user_id,
            date: moment(data.date).utc().format('YYYY-MM-DD HH:mm:ss'),
            reservation_price: data.reservation_price ?? 0,
            status
        });

        return res.send({
            success: true,
            message: "Success",
        });
    }

    // date is currently being booked / booked
    if(reservations[0].status > RESERVATION_STATUS_AVAILABLE) { 
        return res.send({
            success: false,
            message: "Slot is uneditable",
        });
    }

    await userReservationController.update(reservations[0].id, {
        date: moment(data.date).utc().format('YYYY-MM-DD HH:mm:ss'),
        reservation_price: data.reservation_price ?? 0,
        status
    });

    return res.send({
        success: true,
        message: "Success",
    });
});

// create reservation
routes.post('/new/:user_id', async(req, res) => {
    let { date, title, email } = req.body;
    let { user_id } = req.params;

    if(!user_id) {
        return res.status(400).send("No data");
    }

    if(!date) {
        return res.status(400).send("Invalid Params");
    }

    let id = parseInt(user_id);
    let user = await userController.view(id);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let reservations = await userReservationController.find({
        user_id: id,
        date,
    });

    let day = moment(date).utc().day();
    let hour = moment(date).utc().hour();

    let settings = await userReservationSettingController.find({ user_id, day, hour });
    let presetPrice = settings?.[0]?.reservation_price ?? 0;
    let uuid = uuidv4();

    // if has custom reservation
    if(reservations && reservations.length > 0) {
        if(reservations[0].status !== RESERVATION_STATUS_AVAILABLE) {
            return res.send({
                success: false,
                message: "Date is unavailable.",
            });
        }

        let tiplink = await TipLink.create();
        let value_usd = reservations[0].reservation_price ?? presetPrice;
        await userReservationController.update(reservations[0].id, { 
            value_usd,
            tiplink_url: tiplink.url.toString(),
            tiplink_public_key: tiplink.keypair.publicKey.toBase58(),
            reserved_at: moment().format('YYYY-MM-DDTHH:mm:ssZ'),
            reserve_email: email ?? "",
            reserve_title: title ?? "",
            status: RESERVATION_STATUS_PENDING,
            uuid,
        });

        return res.send({
            success: true,
            message: "Success",
            data: {
                public_key: tiplink.keypair.publicKey.toBase58(),
                value_usd,
                uuid,
            },
        });
    }

    // use preset
    if(!settings || settings.length === 0) {
        return res.status(404).send({
            success: false,
            message: "Unable to find preset date",
        });
    }

    let tiplink = await TipLink.create();
    await userReservationController.create({ 
        user_id, 
        date, 
        value_usd: presetPrice,
        tiplink_url: tiplink.url.toString(),
        tiplink_public_key: tiplink.keypair.publicKey.toBase58(),
        reserved_at: moment().format('YYYY-MM-DDTHH:mm:ssZ'),
        reserve_email: email ?? "",
        reserve_title: title ?? "",
        status: RESERVATION_STATUS_PENDING,
        uuid,
    });
    return res.send({
        success: true,
        message: "Success",
        data: {
            public_key: tiplink.keypair.publicKey.toBase58(),
            value_usd: presetPrice,
            uuid,
        },
    });
});