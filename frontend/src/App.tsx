import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import AppPage from "./pages/AppPage";
import MobileCapture from "./pages/MobileCapture";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AppPage />} />
        <Route path="/mobile" element={<MobileCapture />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
