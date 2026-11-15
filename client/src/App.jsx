import { Suspense, lazy } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell, RequireAuth } from './components/AppShell.jsx';
import { PublicLayout } from './components/PublicLayout.jsx';
import { ToastHost } from './components/toast.jsx';
import { ConfirmHost } from './components/Modal.jsx';
import Scout from './components/Scout.jsx';
import Landing from './pages/Landing.jsx';
import { Skeleton } from './components/ui.jsx';
import { PageExtras, RouteMeta } from './components/SiteExtras.jsx';

const page = (loader) => lazy(loader);
const Pricing = page(() => import('./pages/Pricing.jsx'));
const Contact = page(() => import('./pages/Contact.jsx'));
const ContactThanks = page(() => import('./pages/ContactThanks.jsx'));
const Privacy = page(() => import('./pages/Privacy.jsx'));
const Terms = page(() => import('./pages/Terms.jsx'));
const Cookies = page(() => import('./pages/Cookies.jsx'));
const Login = page(() => import('./pages/Login.jsx'));
const Register = page(() => import('./pages/Register.jsx'));
const Verify = page(() => import('./pages/Verify.jsx'));
const Forgot = page(() => import('./pages/Forgot.jsx'));
const Reset = page(() => import('./pages/Reset.jsx'));
const Dashboard = page(() => import('./pages/Dashboard.jsx'));
const Profile = page(() => import('./pages/Profile.jsx'));
const ProfileView = page(() => import('./pages/ProfileView.jsx'));
const Notifications = page(() => import('./pages/Notifications.jsx'));
const Requests = page(() => import('./pages/Requests.jsx'));
const Discover = page(() => import('./pages/Discover.jsx'));
const Mentors = page(() => import('./pages/Mentors.jsx'));
const Projects = page(() => import('./pages/Projects.jsx'));
const ProjectNew = page(() => import('./pages/ProjectNew.jsx'));
const Project = page(() => import('./pages/Project.jsx'));
const Agreement = page(() => import('./pages/Agreement.jsx'));
const Workspace = page(() => import('./pages/Workspace.jsx'));
const Support = page(() => import('./pages/Support.jsx'));
const Subscription = page(() => import('./pages/Subscription.jsx'));
const Compensation = page(() => import('./pages/Compensation.jsx'));
const Admin = page(() => import('./pages/Admin.jsx'));

const ANY = ['student', 'researcher', 'mentor', 'admin'], MEMBER = ['student', 'researcher', 'mentor'];
const guard = (el, roles) => <RequireAuth roles={roles}>{el}</RequireAuth>;
const Fallback = () => <div className="page-pad" style={{ padding: 24 }}><Skeleton n={3} /></div>;

function NotFound() {
  const loc = useLocation();
  return <main id="main" className="auth-main" style={{ minHeight: '60vh' }}><div className="auth-card"><h1>Page not found</h1><p className="muted">There is no page at <span className="mono">{loc.pathname}</span>.</p><a className="btn primary" href="/">Go to the home page</a></div></main>;
}

export default function App() {
  return (
    <>
      <RouteMeta /><PageExtras />
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/contact-thanks" element={<ContactThanks />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/cookies" element={<Cookies />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<Reset />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={guard(<Dashboard />)} />
            <Route path="/profile" element={guard(<Profile />)} />
            <Route path="/profile-view" element={guard(<ProfileView />)} />
            <Route path="/notifications" element={guard(<Notifications />)} />
            <Route path="/requests" element={guard(<Requests />, MEMBER)} />
            <Route path="/discover" element={guard(<Discover />, MEMBER)} />
            <Route path="/mentors" element={guard(<Mentors />, MEMBER)} />
            <Route path="/projects" element={guard(<Projects />, MEMBER)} />
            <Route path="/project-new" element={guard(<ProjectNew />, MEMBER)} />
            <Route path="/project" element={guard(<Project />, ANY)} />
            <Route path="/agreement" element={guard(<Agreement />, ANY)} />
            <Route path="/workspace" element={guard(<Workspace />, ANY)} />
            <Route path="/support" element={guard(<Support />, ['student', 'researcher', 'admin'])} />
            <Route path="/subscription" element={guard(<Subscription />, ['student'])} />
            <Route path="/compensation" element={guard(<Compensation />, ['researcher', 'admin'])} />
            <Route path="/admin" element={guard(<Admin />, ['admin'])} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ToastHost /><ConfirmHost /><Scout />
    </>
  );
}
