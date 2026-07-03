import { SettingsLayout } from '../components/settings-layout';
import { Lock } from 'lucide-react';

export function SettingsSsoPage(): JSX.Element {
  return (
    <SettingsLayout>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Single Sign-On (SSO)</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Configure SAML 2.0 or OIDC SSO for your organisation.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">SSO Configuration</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            SAML 2.0 and OIDC SSO configuration is available on the Enterprise plan.
            Contact sales to enable SSO for your organisation.
          </p>
          <a
            href="mailto:sales@orionsoft.com"
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </SettingsLayout>
  );
}
