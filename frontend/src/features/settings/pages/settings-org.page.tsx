import { Loader2 } from 'lucide-react';
import { SettingsLayout } from '../components/settings-layout';
import { useOrganizationProfile } from '@/features/organizations/hooks/use-organization';
import { CompanyProfileForm } from '@/features/organizations/components/company-profile-form';
import { LogoUpload } from '@/features/organizations/components/logo-upload';
import { ScopingQuestionnaire } from '@/features/organizations/components/scoping-questionnaire';
import { DataExport } from '@/features/organizations/components/data-export';
import { DeleteOrganization } from '@/features/organizations/components/delete-organization';

export function SettingsOrgPage(): JSX.Element {
  const { data: org, isLoading, isError } = useOrganizationProfile();

  return (
    <SettingsLayout>
      <div className="space-y-6">
        {/* Data portability. Placed on the organisation page rather than buried
            in an admin corner: being able to leave with your records is a
            property of the organisation, and customers evaluating us will look
            for it. */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Your Data</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Export everything you have stored here, at any time.
            </p>
          </div>
          <div className="p-6">
            <DataExport />
          </div>
        </section>

        {/* Compliance scope. Revisitable because the answers go stale — taking
            card payments or opening an EU office changes what applies. */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Compliance Scope</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              How your organisation operates, and the frameworks that follow from it. Update this
              whenever the business changes.
            </p>
          </div>
          <div className="p-6">
            <ScopingQuestionnaire variant="settings" />
          </div>
        </section>

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
            {/* Owners can now do this themselves. It previously said deletion
                was "handled manually" and pointed at an email address — which
                was not a safeguard but a missing feature, and left the product
                unable to honour an erasure request without someone running SQL
                by hand. */}
            <DeleteOrganization organizationName={org.name} />
          </section>
        )}
      </div>
    </SettingsLayout>
  );
}
