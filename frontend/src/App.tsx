import { BrowserRouter, Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { ReviewDetail } from "./pages/ReviewDetail";
import { Reviewers } from "./pages/Reviewers";
import { Docs } from "./pages/Docs";
import { Knowledge } from "./pages/Knowledge";
import { Memory } from "./pages/Memory";
import { Settings } from "./pages/Settings";
import { SignInPage } from "./pages/SignIn";
import { SignUpPage } from "./pages/SignUp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="review/:id" element={<ReviewDetail />} />
          <Route path="reviewers" element={<Reviewers />} />
          <Route path="docs" element={<Docs />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="memory" element={<Memory />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
