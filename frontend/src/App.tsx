import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConversationProvider } from "@elevenlabs/react";
import Landing from "./pages/Landing";
import AppPage from "./pages/AppPage";
import MobileCapture from "./pages/MobileCapture";
import CameraPage from "./pages/CameraPage";
import LiveViewPage from "./pages/LiveViewPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/app"
          element={
            <ConversationProvider>
              <AppPage />
            </ConversationProvider>
          }
        />
        <Route path="/mobile" element={<MobileCapture />} />
        <Route path="/camera/:roomCode" element={<CameraPage />} />
        <Route path="/view" element={<LiveViewPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
