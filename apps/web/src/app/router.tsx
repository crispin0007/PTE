import { createHashRouter } from 'react-router';
import { Layout } from './Layout.tsx';
import { About } from './pages/About.tsx';
import { Home } from './pages/Home.tsx';
import { NotFound } from './pages/NotFound.tsx';
import { Practice } from './pages/Practice.tsx';
import { QuestionPage } from './pages/QuestionPage.tsx';
import { TypePage } from './pages/TypePage.tsx';

// Hash routes work on GitHub Pages and any static host without server rewrites.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/practice', element: <Practice /> },
      { path: '/practice/:type', element: <TypePage /> },
      { path: '/practice/:type/:id', element: <QuestionPage /> },
      { path: '/about', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
