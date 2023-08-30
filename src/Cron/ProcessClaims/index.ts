import * as mailController from '../../Controllers/mailController';
import { getAddressUSDCBalance } from '../../Token';

export const processClaims = async() => {
    let mails = await mailController.find({
        is_processed: true,
        has_responded: true,
        is_claimed: false,
    });

    // no mails
    if(!mails) {
        return;
    }

    for(const [index, mail] of mails.entries()) {
        let tokenBalance = await getAddressUSDCBalance(mail.tiplink_public_key);
        if(tokenBalance > 0) {
            continue;
        }

        // mark as claimed
        await mailController.update(mail.key, { is_claimed: true });
    } 
}