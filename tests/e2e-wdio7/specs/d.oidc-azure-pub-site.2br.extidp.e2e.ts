import { addOidcAzureTestSteps } from './d.oidc-azure-impl';

describe(`oidc-azure-pub-site.2br.extidp  TyTE2EOIDCAZ02`, () => {
  addOidcAzureTestSteps({ loginRequired: false });
});
