import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '@/routes/paths';

export function SettingsBillingPage(): JSX.Element {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(PATHS.BILLING, { replace: true });
  }, [navigate]);
  return <></>;
}
