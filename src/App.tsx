import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Sites from "@/pages/Sites";
import Sessions from "@/pages/Sessions";
import Keys from "@/pages/Keys";
import MagicOnboard from "@/pages/MagicOnboard";

export default function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sites" element={<Sites />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/keys" element={<Keys />} />
          <Route path="/magic" element={<MagicOnboard />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}
