import LoginPage from  '../pageobjects/login.page';
import SecurePage from '../pageobjects/secure.page';
import tyAssert from '../utils/ty-assert';
import * as make from '../utils/make';
import { dj } from '../utils/log-and-die';

import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';

describe('My Login application', () => {
    it('should enjoy adding numbers', async () => {
        const maja = make.memberMaja();
        dj("maja: ", maja);

        tyAssert.not(4 + 1 === 77788);
        tyAssert.includes("a small cat", "kitten")
        await 1 + 3;
    });

    it('should login with valid credentials', async () => {
        await LoginPage.open();

        await LoginPage.login('tomsmith', 'SuperSecretPassword!');
        await expect(SecurePage.flashAlert).toBeExisting();
        await expect(SecurePage.flashAlert).toHaveTextContaining(
            'You logged into a secure area!');
    });
});


