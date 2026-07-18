import { Loader2 } from 'lucide-react';
import { SettingsLayout } from '../components/settings-layout';
import { useOrganizationProfile } from '@/features/organizations/hooks/use-organization';
import { CompanyProfileForm } from '@/features/organizations/components/company-profile-form';
import { LogoUpload } from '@/features/organizations/components/logo-upload';

export function SettingsOrgPage(): JSX.Element {
  const { data: org, isLoading, isError } = useOrganizationProfile();

  return (
    <SettingsLayout>
      <div className="space-y-6">
        {/* Card */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Organisation Profile</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Update your organisation's details. These appear across all ComplianceCore reports.
            </p>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : isError ? (
              <p className="text-sm text-rose-600">
                Failed to load organisation profile. Please refresh.
              </p>
            ) : org ? (
              <div className="space-y-6">
                {/* Logo */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                    Logo
                  </h3>
                  <LogoUpload currentLogoUrl={org.logoUrl} orgName={org.name} />
                </div>

                <hr className="border-slate-200" />

                {/* Form */}
                <CompanyProfileForm organization={org} />
              </div>
            ) : null}
          </div>
        </section>

        {/* Danger Zone */}
        {org && (
          <section className="rounded-xl border border-rose-200 bg-white shadow-sm">
            <div className="border-b border-rose-200 px-6 py-4">
              <h2 className="text-base font-semibold text-rose-700">Danger Zone</h2>
            </div>
            <div className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-slate-900">Delete Organisation</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanently deleting an organisation and all its data is handled manually to
                  prevent accidental loss. Email{' '}
                  <a href="mailto:support@orionsoft.com" className="text-indigo-600 hover:underline">
                    support@orionsoft.com
                  </a>{' '}
                  to request deletion.
                </p>
              </div>
              <button
                type="button"
                disabled
                title="Contact support@orionsoft.com to delete your organisation"
                className="cursor-not-allowed rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400"
              >
                Contact Support
              </button>
            </div>
          </section>
        )}
      </div>
    </SettingsLayout>
  );
}
