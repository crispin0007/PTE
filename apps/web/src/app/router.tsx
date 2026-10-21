import { createHashRouter } from 'react-router';
import { Layout } from './Layout.tsx';
import { About } from './pages/About.tsx';
import { More } from './pages/More.tsx';
import { NotFound } from './pages/NotFound.tsx';
import { Practice } from './pages/Practice.tsx';
import { Progress } from './pages/Progress.tsx';
import { QuestionPage } from './pages/QuestionPage.tsx';
import { Today } from './pages/Today.tsx';
import { TypePage } from './pages/TypePage.tsx';

// Hash routes work on GitHub Pages and any static host without server rewrites.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Today /> },
      { path: '/progress', element: <Progress /> },
      { path: '/more', element: <More /> },
      { path: '/practice', element: <Practice /> },
      { path: '/practice/:type', element: <TypePage /> },
      { path: '/practice/:type/:id', element: <QuestionPage /> },
      { path: '/about', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
