import { createHashRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './Layout';
import { HomePage } from './pages/HomePage';
import { TrackPage } from './pages/TrackPage';
import { ProgressPage } from './pages/ProgressPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Hash URLs work on GitHub Pages without a server-side fallback route.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: ':track', element: <TrackPage /> },
      {
        path: ':track/:slug',
        // Split out the editor and exercise code so the home page stays small.
        lazy: async () => ({ Component: (await import('./pages/LessonPage')).LessonPage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export const App = () => <RouterProvider router={router} />;
