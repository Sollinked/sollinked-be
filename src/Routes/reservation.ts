import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as userReservationController from '../Controllers/userReservationController';
import * as userReservationSettingController from '../Controllers/userReservationSettingController';
import _ from 'lodash';
import { RESERVATION_STATUS_AVAILABLE, VERIFY_MESSAGE } from '../Constants';
import { verifySignature } from '../../utils';

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

    console.log(settings);

    return res.send({
        success: true,
        message: "Success",
        data: {
            reservations,
            settings,
        },
    });
});

// create reservation
routes.post('/:user_id', async(req, res) => {
    let {  } = req.body;
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

    console.log(settings);

    return res.send({
        success: true,
        message: "Success",
        data: {
            reservations,
            settings,
        },
    });
});

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
    let reservations = await userReservationController.find({ date });

    if(!reservations || reservations.length === 0) {
        await userReservationController.create({
            user_id,
            date: data.date,
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
        date: data.date,
        reservation_price: data.reservation_price ?? 0,
        status
    });

    return res.send({
        success: true,
        message: "Success",
    });
});