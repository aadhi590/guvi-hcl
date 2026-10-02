import { BrowserRouter, Route, Routes } from "react-router-dom";
import GrainOverlay from "./components/GrainOverlay";
import RequireAuth from "./components/RequireAuth";
import CreatePollPage from "./pages/CreatePollPage";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ManagePollPage from "./pages/ManagePollPage";
import SignupPage from "./pages/SignupPage";
import VotePage from "./pages/VotePage";

function App() {
  return (
    <BrowserRouter>
      <GrainOverlay />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/create"
          element={
            <RequireAuth>
              <CreatePollPage />
            </RequireAuth>
          }
        />
        <Route
          path="/polls/:id/manage"
          element={
            <RequireAuth>
              <ManagePollPage />
            </RequireAuth>
          }
        />
        <Route path="/polls/:id" element={<VotePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
