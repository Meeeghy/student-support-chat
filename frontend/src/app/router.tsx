import { createBrowserRouter } from 'react-router-dom'
import LoginPage from '../pages/LoginPage'
import StudentInboxPage from '../pages/StudentInboxPage'
import SalesInboxPage from '../pages/SalesInboxPage'
import ManagerQueuePage from '../pages/ManagerQueuePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LoginPage />,
  },
  {
    path: '/student',
    element: <StudentInboxPage />,
  },
  {
    path: '/sales',
    element: <SalesInboxPage />,
  },
  {
    path: '/manager',
    element: <ManagerQueuePage />,
  }
])
