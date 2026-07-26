import { BrowserRouter, Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HelpLayout } from "./components/help/HelpLayout";
import { HelpArticle } from "./components/help/HelpArticle";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { ReviewDetail } from "./pages/ReviewDetail";
import { Reviewers } from "./pages/Reviewers";
import { Docs } from "./pages/Docs";
import { Knowledge } from "./pages/Knowledge";
import { Memory } from "./pages/Memory";
import { Settings } from "./pages/Settings";
import { Help } from "./pages/Help";
import { SignInPage } from "./pages/SignIn";
import { SignUpPage } from "./pages/SignUp";

import gettingStarted from "./docs/getting-started.md?raw";
import slack from "./docs/slack.md?raw";
import discord from "./docs/discord.md?raw";
import github from "./docs/github.md?raw";
import reviews from "./docs/reviews.md?raw";
import knowledge from "./docs/knowledge.md?raw";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="help" element={<HelpLayout />}>
          <Route index element={<Help />} />
          <Route path="slack" element={<HelpArticle content={slack} />} />
          <Route path="discord" element={<HelpArticle content={discord} />} />
          <Route path="github" element={<HelpArticle content={github} />} />
          <Route path="reviews" element={<HelpArticle content={reviews} />} />
          <Route path="knowledge" element={<HelpArticle content={knowledge} />} />
        </Route>
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
