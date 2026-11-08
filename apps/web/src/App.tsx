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
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const ConfirmEmailPage = lazy(() => import('@/pages/auth/ConfirmEmailPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const UniversesPage = lazy(() => import('@/pages/UniversesPage'));
const UniverseDetailPage = lazy(() => import('@/pages/UniverseDetailPage'));
const LegalPage = lazy(() => import('@/pages/legal/LegalPage'));
const PremiumPage = lazy(() => import('@/pages/PremiumPage'));
const QuizPage = lazy(() => import('@/pages/QuizPage'));
const TopicPage = lazy(() => import('@/pages/TopicPage'));
const EventRoomPage = lazy(() => import('@/pages/EventRoomPage'));
const DailyPage = lazy(() => import('@/pages/games/DailyPage'));
const SpeedPage = lazy(() => import('@/pages/games/SpeedPage'));
const HangmanPage = lazy(() => import('@/pages/games/HangmanPage'));
const SurvivalPage = lazy(() => import('@/pages/games/SurvivalPage'));
const SubscriptionPage = lazy(() => import('@/pages/account/SubscriptionPage'));
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'));
const AdminUserPage = lazy(() => import('@/pages/admin/AdminUserPage'));
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
      { path: '/verify-email', element: s(<VerifyEmailPage />) },
      { path: '/confirm-email', element: <RequireAuth>{s(<ConfirmEmailPage />)}</RequireAuth> },
      { path: '/universes', element: s(<UniversesPage />) },
      { path: '/universes/:slug', element: s(<UniverseDetailPage />) },
      { path: '/universes/:slug/forum/:topicId', element: s(<TopicPage />) },
      { path: '/universes/:slug/quizzes/:quizId', element: <RequireAuth>{s(<QuizPage />)}</RequireAuth> },
      { path: '/universes/:slug/games/daily', element: <RequireAuth>{s(<DailyPage />)}</RequireAuth> },
      { path: '/universes/:slug/games/speed', element: <RequireAuth>{s(<SpeedPage />)}</RequireAuth> },
      { path: '/universes/:slug/games/hangman', element: <RequireAuth>{s(<HangmanPage />)}</RequireAuth> },
      { path: '/universes/:slug/games/survival', element: <RequireAuth>{s(<SurvivalPage />)}</RequireAuth> },
      { path: '/universes/:slug/events/:eventId', element: <RequireAuth>{s(<EventRoomPage />)}</RequireAuth> },
      { path: '/dashboard', element: <RequireAuth>{s(<DashboardPage />)}</RequireAuth> },
      { path: '/premium', element: s(<PremiumPage />) },
      { path: '/account/subscription', element: <RequireAuth>{s(<SubscriptionPage />)}</RequireAuth> },
      { path: '/admin', element: <RequireAuth>{s(<AdminPage />)}</RequireAuth> },
      { path: '/admin/users/:id', element: <RequireAuth>{s(<AdminUserPage />)}</RequireAuth> },
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
