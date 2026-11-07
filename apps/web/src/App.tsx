import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppLayout } from '@/components/Layout';
import { FullPageLoader } from '@/components/states';
import LandingPage from '@/pages/LandingPage';

// Route-level code splitting: only the landing ships in the initial bundle.
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallbackPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const UniversesPage = lazy(() => import('@/pages/UniversesPage'));
const UniverseDetailPage = lazy(() => import('@/pages/UniverseDetailPage'));
const LegalPage = lazy(() => import('@/pages/legal/LegalPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const s = (el: React.ReactNode) => <Suspense fallback={<FullPageLoader />}>{el}</Suspense>;

export const routes = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: s(<LoginPage />) },
      { path: '/register', element: s(<RegisterPage />) },
      { path: '/forgot-password', element: s(<ForgotPasswordPage />) },
      { path: '/reset-password', element: s(<ResetPasswordPage />) },
      { path: '/auth/callback', element: s(<AuthCallbackPage />) },
      { path: '/universes', element: s(<UniversesPage />) },
      { path: '/universes/:slug', element: s(<UniverseDetailPage />) },
      { path: '/dashboard', element: <RequireAuth>{s(<DashboardPage />)}</RequireAuth> },
      { path: '/legal/terms', element: s(<LegalPage doc="terms" />) },
      { path: '/legal/privacy', element: s(<LegalPage doc="privacy" />) },
      { path: '*', element: s(<NotFoundPage />) },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
