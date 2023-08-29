import * as userController from '../../Controllers/userController';
import * as userReservationController from '../../Controllers/userReservationController';
import moment from 'moment';
import { getAddressUSDCBalance } from '../../Token';
import { RESERVATION_STATUS_AVAILABLE, RESERVATION_STATUS_CANCELLED, RESERVATION_STATUS_CLAIMED, RESERVATION_STATUS_PAID, RESERVATION_STATUS_PENDING } from '../../Constants';

export const processReservationPayments = async() => {
    let reservedAfter = moment().add(-18, 'm').format('YYYY-MM-DDTHH:mm:ssZ')
    let reservations = await userReservationController.findAfter({
        status: RESERVATION_STATUS_PENDING,
    }, reservedAfter);

    // no mails
    if(!reservations) {
        console.log('process reservation payment', 'no unprocessed reservations');
        return;
    }

    for(const [index, reservation] of reservations.entries()) {
        let tokenBalance = await getAddressUSDCBalance(reservation.tiplink_public_key!);
        if(tokenBalance === 0) {
            console.log('no balance yet');
            continue;
        }

        if(tokenBalance < reservation.value_usd!) {
            console.log('need more deposits');
            continue;
        }

        console.log(tokenBalance);
        await userReservationController.update(reservation.id, {
            status: RESERVATION_STATUS_PAID,
        });
    } 
}

export const processExpiredReservationPayments = async() => {
    let reservedBefore = moment().add(-20, 'm').format('YYYY-MM-DDTHH:mm:ssZ')
    let reservations = await userReservationController.findBefore({
        status: RESERVATION_STATUS_PENDING,
    }, reservedBefore);

    // no mails
    if(!reservations) {
        console.log('process expired reservation payment', 'no unprocessed expired reservations');
        return;
    }

    for(const [index, reservation] of reservations.entries()) {
        let tokenBalance = await getAddressUSDCBalance(reservation.tiplink_public_key!);

        // paid
        if(tokenBalance >= reservation.value_usd!) {
            console.log({tokenBalance, reservation_price: reservation.reservation_price})
            await userReservationController.update(reservation.id, {
                status: RESERVATION_STATUS_PAID,
            });
            continue;
        }

        await userReservationController.update(reservation.id, {
            status: RESERVATION_STATUS_CANCELLED,
        });

        // has custom price
        // create another one to replace the blocked one
        if(reservation.reservation_price) {
            await userReservationController.create({
                user_id: reservation.user_id,
                status: RESERVATION_STATUS_AVAILABLE,
                reservation_price: reservation.reservation_price,
                date: moment(reservation.date).format('YYYY-MM-DDTHH:mm:ssZ'),
            });
        }
    } 
}


export const processReservationClaims= async() => {
    let reservations = await userReservationController.find({
        status: RESERVATION_STATUS_CLAIMED,
    });

    // no mails
    if(!reservations) {
        console.log('process reservation claim', 'no unprocessed paid reservations');
        return;
    }

    for(const [index, reservation] of reservations.entries()) {
        let tokenBalance = await getAddressUSDCBalance(reservation.tiplink_public_key!);

        // not claimed
        if(tokenBalance > 0) {
            continue;
        }

        await userReservationController.update(reservation.id, {
            status: RESERVATION_STATUS_CLAIMED,
        });
    } 
}