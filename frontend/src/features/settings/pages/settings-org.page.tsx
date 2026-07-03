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
                  Permanently delete this organisation and all its data. This action is irreversible.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  // Trigger a confirmation dialog — implemented when the offboarding flow is built
                  alert('Contact support@orionsoft.com to delete your organisation.');
                }}
              >
                Delete Organisation
              </button>
            </div>
          </section>
        )}
      </div>
    </SettingsLayout>
  );
}
