import { BrowserRouter, Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { ReviewDetail } from "./pages/ReviewDetail";
import { Reviewers } from "./pages/Reviewers";
import { Docs } from "./pages/Docs";
import { Memory } from "./pages/Memory";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="review/:id" element={<ReviewDetail />} />
          <Route path="reviewers" element={<Reviewers />} />
          <Route path="docs" element={<Docs />} />
          <Route path="memory" element={<Memory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
