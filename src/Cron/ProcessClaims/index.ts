import * as mailController from '../../Controllers/mailController';
import { getAddressUSDCBalance } from '../../Token';

const CHECK_BALANCE_COUNT = 3;
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

        // errored
        if(tokenBalance === null) {
            // reset count if previously we find it's 0
            await mailController.update(mail.key, { claim_balance_verify_count: 0 });
            continue;
        }

        if(tokenBalance > 0) {
            // reset count if previously we find it's 0
            await mailController.update(mail.key, { claim_balance_verify_count: 0 });
            continue;
        }

        // if it's 0 and check balance count is less than required then add 1 to the count
        if(mail.claim_balance_verify_count < CHECK_BALANCE_COUNT) {
            await mailController.update(mail.key, { claim_balance_verify_count: mail.claim_balance_verify_count + 1 });
            return;
        }
        // mark as claimed
        await mailController.update(mail.key, { is_claimed: true });
    } 
}